const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const https = require("node:https");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const RESEARCH_ROOT = path.join(PROJECT_ROOT, "data", "raw", "research");
const MAX_REDIRECTS = 3;
// Une page HTML peut atteindre 5 MB, mais le texte sauvegardé reste limité.
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 20_000;
const REQUEST_TIMEOUT_MS = 30_000;

const runResult = {
  slug: "",
  url: "",
  outputFile: "",
  downloadedBytes: 0,
  title: "",
  errors: [],
};

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("-");
}

function getUniqueLogPath(logsDirectory, timestamp) {
  const baseName = `${timestamp}-fetch-source`;
  let logPath = path.join(logsDirectory, `${baseName}.md`);
  let suffix = 2;

  while (fs.existsSync(logPath)) {
    logPath = path.join(logsDirectory, `${baseName}-${suffix}.md`);
    suffix += 1;
  }

  return logPath;
}

function toProjectRelative(filePath) {
  return path.relative(PROJECT_ROOT, filePath).split(path.sep).join("/");
}

function parseArguments(argumentsList) {
  const positionalArguments = [];
  let force = false;

  for (const argument of argumentsList) {
    if (argument === "--force") {
      force = true;
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(`Option inconnue : ${argument}`);
    }

    positionalArguments.push(argument);
  }

  if (!positionalArguments[0]) {
    throw new Error(
      "Slug absent. Exemple : node scripts/fetch-source.js comfyui-beginner-guide https://example.com"
    );
  }

  if (!positionalArguments[1]) {
    throw new Error("URL absente.");
  }

  if (positionalArguments.length > 2) {
    throw new Error("Trop d'arguments. Place l'URL entre guillemets si nécessaire.");
  }

  const slug = positionalArguments[0].trim();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      "Slug invalide. Utilise uniquement des lettres minuscules, chiffres et tirets."
    );
  }

  return { slug, url: positionalArguments[1].trim(), force };
}

function parseWebUrl(value) {
  let parsedUrl;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error("URL invalide.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Protocole non accepté. Utilise seulement http:// ou https://.");
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("Les identifiants intégrés dans l'URL ne sont pas acceptés.");
  }

  return parsedUrl;
}

function createSlug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildOutputFilename(sourceUrl) {
  const hostname = sourceUrl.hostname.replace(/^www\./i, "");
  const pathname = decodeURIComponent(sourceUrl.pathname);
  const baseName = createSlug(`${hostname} ${pathname}`) || "source-web";

  return `${baseName}.md`;
}

function decodeHtml(value) {
  const namedEntities = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    laquo: "«",
    lt: "<",
    nbsp: " ",
    quot: '"',
    raquo: "»",
  };

  return value
    .replace(/&#(\d+);/g, (_, number) =>
      String.fromCodePoint(Number(number))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, number) =>
      String.fromCodePoint(Number.parseInt(number, 16))
    )
    .replace(/&([a-z]+);/gi, (entity, name) =>
      Object.hasOwn(namedEntities, name.toLowerCase())
        ? namedEntities[name.toLowerCase()]
        : entity
    );
}

function cleanInlineText(value) {
  return decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function extractMetaDescription(html) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];

  for (const tag of metaTags) {
    const nameMatch = tag.match(
      /\b(?:name|property)\s*=\s*(["'])(.*?)\1/i
    );

    if (
      !nameMatch ||
      !["description", "og:description"].includes(
        nameMatch[2].trim().toLowerCase()
      )
    ) {
      continue;
    }

    const contentMatch = tag.match(/\bcontent\s*=\s*(["'])(.*?)\1/i);

    if (contentMatch) {
      return cleanInlineText(contentMatch[2]);
    }
  }

  return "";
}

function extractPageContent(html) {
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? cleanInlineText(titleMatch[1])
    : "Titre non disponible";
  const description = extractMetaDescription(html);
  const cleanedHtml = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|nav|footer|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,
      " "
    )
    .replace(
      /<\/?(?:article|aside|blockquote|br|div|figcaption|figure|h[1-6]|header|li|main|p|pre|section|table|td|th|tr|ul|ol)\b[^>]*>/gi,
      "\n"
    )
    .replace(/<[^>]*>/g, " ");
  const text = decodeHtml(cleanedHtml)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARACTERS);

  if (!text) {
    throw new Error("Aucun texte exploitable n'a pu être extrait de la page.");
  }

  return { title, description, text };
}

// Télécharge une seule URL explicite et ses redirections HTTP.
// Le script ne suit aucun lien de la page et ne devient donc pas un crawler.
function downloadPage(sourceUrl, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const client = sourceUrl.protocol === "https:" ? https : http;
    const request = client.get(
      sourceUrl,
      {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Encoding": "identity",
          "User-Agent": "Knowledge-Hub-Local-Source-Fetch/1.0",
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (response) => {
        const statusCode = response.statusCode || 0;
        const location = response.headers.location;

        if (statusCode >= 300 && statusCode < 400 && location) {
          response.resume();

          if (redirectCount >= MAX_REDIRECTS) {
            reject(
              new Error(`Nombre maximal de redirections dépassé (${MAX_REDIRECTS}).`)
            );
            return;
          }

          let redirectUrl;

          try {
            redirectUrl = parseWebUrl(new URL(location, sourceUrl).toString());
          } catch (error) {
            reject(error);
            return;
          }

          downloadPage(redirectUrl, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`Page inaccessible : erreur HTTP ${statusCode}.`));
          return;
        }

        const contentType = String(response.headers["content-type"] || "");

        if (
          !contentType.toLowerCase().includes("text/html") &&
          !contentType.toLowerCase().includes("application/xhtml+xml")
        ) {
          response.resume();
          reject(
            new Error(
              `Content-Type non HTML refusé : ${contentType || "inconnu"}.`
            )
          );
          return;
        }

        const announcedLength = Number(response.headers["content-length"]);

        if (
          Number.isFinite(announcedLength) &&
          announcedLength > MAX_RESPONSE_BYTES
        ) {
          response.resume();
          reject(
            new Error(
              `Réponse trop grosse : limite maximale de ${MAX_RESPONSE_BYTES} octets.`
            )
          );
          return;
        }

        const chunks = [];
        let downloadedBytes = 0;

        response.on("data", (chunk) => {
          downloadedBytes += chunk.length;

          if (downloadedBytes > MAX_RESPONSE_BYTES) {
            request.destroy(
              new Error(
                `Réponse trop grosse : limite maximale de ${MAX_RESPONSE_BYTES} octets.`
              )
            );
            return;
          }

          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve({
            finalUrl: sourceUrl,
            html: Buffer.concat(chunks).toString("utf8"),
            contentType,
            downloadedBytes,
          });
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(
        new Error("La page ne répond pas dans le délai de 30 secondes.")
      );
    });

    request.on("error", (error) => {
      if (
        ["ENOTFOUND", "ENETUNREACH", "EAI_AGAIN", "ECONNREFUSED"].includes(
          error.code
        )
      ) {
        reject(new Error("Page inaccessible ou accès internet indisponible."));
        return;
      }

      reject(error);
    });
  });
}

function escapeMarkdownInline(value) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function buildMarkdown(download, extracted) {
  const date = new Date().toISOString();

  return `# Source récupérée - ${escapeMarkdownInline(extracted.title)}

## Métadonnées

- URL : ${download.finalUrl.toString()}
- Domaine : ${download.finalUrl.hostname}
- Date de récupération : ${date}
- Content-Type : ${download.contentType}
- Taille téléchargée : ${download.downloadedBytes} octets
- Statut : fetched
- Validation humaine : à faire

## Description

${extracted.description || "À compléter."}

## Texte extrait

${extracted.text}

## Notes

À compléter.

## À vérifier

- Vérifier que l'extraction n'a pas supprimé des informations importantes.
- Vérifier la fiabilité de la source.
`;
}

function updateNotesFile(notesPath, title, localPath) {
  const entry = `- ${escapeMarkdownInline(title)} — \`${localPath}\``;
  let content = fs.existsSync(notesPath)
    ? fs.readFileSync(notesPath, "utf8")
    : "";

  if (content.includes(entry)) {
    return;
  }

  const sectionMatch = /^## Sources récupérées\s*$/m.exec(content);

  if (sectionMatch) {
    const insertionStart = sectionMatch.index + sectionMatch[0].length;
    const nextSection = /^##\s+/m.exec(content.slice(insertionStart));
    const insertionIndex = nextSection
      ? insertionStart + nextSection.index
      : content.length;
    const before = content.slice(0, insertionIndex).trimEnd();
    const after = content.slice(insertionIndex).trimStart();

    content = `${before}\n\n${entry}\n\n${after}`.trimEnd() + "\n";
  } else {
    content = `${content.trimEnd()}\n\n## Sources récupérées\n\n${entry}\n`;
  }

  fs.writeFileSync(notesPath, content, "utf8");
}

function writeRunLog() {
  const logsDirectory = path.join(PROJECT_ROOT, "logs", "runs");
  const timestamp = formatTimestamp(new Date());
  const logPath = getUniqueLogPath(logsDirectory, timestamp);
  const errors =
    runResult.errors.length > 0
      ? runResult.errors.map((error) => `- ${error}`).join("\n")
      : "- Aucune";
  const commandArguments = process.argv
    .slice(2)
    .map((argument) => JSON.stringify(argument))
    .join(" ");
  const command = `node scripts/fetch-source.js${
    commandArguments ? ` ${commandArguments}` : ""
  }`;

  const logContent = `# Récupération contrôlée d'une source web

## Slug

\`${runResult.slug || "Non défini"}\`

## URL

${runResult.url || "Non définie"}

## Fichier créé

\`${runResult.outputFile || "Non créé"}\`

## Taille téléchargée

${runResult.downloadedBytes} octets

## Limites utilisées

- HTML téléchargé : ${MAX_RESPONSE_BYTES} octets maximum (5 MB)
- Texte extrait : ${MAX_EXTRACTED_CHARACTERS} caractères maximum

## Titre extrait

${runResult.title || "Non extrait"}

## Erreurs

${errors}

## Commande exécutée

\`${command.replace(/`/g, "")}\`

## Confidentialité

- Le texte complet extrait n'est pas enregistré dans ce log.
- Aucun cookie n'est envoyé ni stocké par le script.
`;

  fs.mkdirSync(logsDirectory, { recursive: true });
  fs.writeFileSync(logPath, logContent, "utf8");
  console.log(`Log créé : ${toProjectRelative(logPath)}`);
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const sourceUrl = parseWebUrl(options.url);
    const topicDirectory = path.join(RESEARCH_ROOT, options.slug);

    runResult.slug = options.slug;
    runResult.url = sourceUrl.toString();

    if (!fs.existsSync(topicDirectory)) {
      throw new Error(
        `Dossier de recherche absent : ${toProjectRelative(topicDirectory)}`
      );
    }

    if (!fs.statSync(topicDirectory).isDirectory()) {
      throw new Error("Le chemin du sujet ne désigne pas un dossier.");
    }

    const fetchedDirectory = path.join(topicDirectory, "fetched");
    const filename = buildOutputFilename(sourceUrl);
    const outputPath = path.join(fetchedDirectory, filename);

    if (fs.existsSync(outputPath) && !options.force) {
      throw new Error(
        "Le fichier de sortie existe déjà. Utilise --force pour le remplacer."
      );
    }

    const download = await downloadPage(sourceUrl);
    const extracted = extractPageContent(download.html);
    const markdown = buildMarkdown(download, extracted);

    fs.mkdirSync(fetchedDirectory, { recursive: true });
    fs.writeFileSync(outputPath, markdown, {
      encoding: "utf8",
      flag: options.force ? "w" : "wx",
    });

    const localPath = toProjectRelative(outputPath);
    const notesPath = path.join(topicDirectory, "notes.md");

    updateNotesFile(notesPath, extracted.title, localPath);

    runResult.outputFile = localPath;
    runResult.downloadedBytes = download.downloadedBytes;
    runResult.title = extracted.title;

    console.log(`Slug : ${options.slug}`);
    console.log(`URL : ${sourceUrl.toString()}`);
    console.log(`Fichier créé : ${localPath}`);
    console.log(`Titre extrait : ${extracted.title}`);
    console.log(`Taille téléchargée : ${download.downloadedBytes} octets`);
    console.log(
      "Rappel : le contenu extrait et la fiabilité de la source doivent être validés manuellement."
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue.";

    runResult.errors.push(message);
    console.error(`Erreur : ${message}`);
    process.exitCode = 1;
  } finally {
    try {
      writeRunLog();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue.";

      console.error(`Erreur lors de la création du log : ${message}`);
      process.exitCode = 1;
    }
  }
}

main();

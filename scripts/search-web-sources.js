const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const RESEARCH_ROOT = path.join(PROJECT_ROOT, "data", "raw", "research");
const SEARCH_ENGINE = "DuckDuckGo HTML";
const SEARCH_HOST = "html.duckduckgo.com";
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

const runResult = {
  query: "",
  slug: "",
  directory: "",
  limit: DEFAULT_LIMIT,
  dryRun: false,
  foundCount: 0,
  addedCount: 0,
  duplicateCount: 0,
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
  const baseName = `${timestamp}-search-web-sources`;
  let logPath = path.join(logsDirectory, `${baseName}.md`);
  let suffix = 2;

  while (fs.existsSync(logPath)) {
    logPath = path.join(logsDirectory, `${baseName}-${suffix}.md`);
    suffix += 1;
  }

  return logPath;
}

function createSlug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toProjectRelative(filePath) {
  return path.relative(PROJECT_ROOT, filePath).split(path.sep).join("/");
}

// Accepte une requête, --limit et --dry-run dans n'importe quel ordre.
function parseArguments(argumentsList) {
  const queryParts = [];
  let limit = DEFAULT_LIMIT;
  let dryRun = false;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (argument === "--limit") {
      const value = argumentsList[index + 1];
      const parsedLimit = Number(value);

      if (!value || !Number.isInteger(parsedLimit)) {
        throw new Error("L'option --limit doit être suivie d'un nombre entier.");
      }

      if (parsedLimit < 1 || parsedLimit > MAX_LIMIT) {
        throw new Error(`La limite doit être comprise entre 1 et ${MAX_LIMIT}.`);
      }

      limit = parsedLimit;
      index += 1;
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(`Option inconnue : ${argument}`);
    }

    queryParts.push(argument);
  }

  const query = queryParts.join(" ").replace(/\s+/g, " ").trim();

  if (!query) {
    throw new Error(
      'Requête manquante. Exemple : node scripts/search-web-sources.js "ComfyUI beginner guide"'
    );
  }

  return { query, limit, dryRun };
}

function buildTemplates(topic) {
  return {
    "research-plan.md": `# Plan de recherche - ${topic}

## Objectif

À compléter.

## Questions à traiter

- À compléter.

## Périmètre

À compléter.

## Critères de validation

- Les sources sont conservées dans \`sources.md\`.
- Les informations incertaines sont marquées \`À vérifier\`.
- La fiche finale doit être validée manuellement avant indexation.

## Prochaine action

Ajouter des sources dans \`sources.md\`.
`,
    "sources.md": `# Sources - ${topic}

## Sources candidates

<!--
Format conseillé :

### Source 1

- URL :
- Titre :
- Type :
- Statut : à lire / lu / ignoré
- Fiabilité : à vérifier / moyenne / bonne
- Notes :
-->

## Sources retenues

À compléter.

## Sources ignorées

À compléter.
`,
    "notes.md": `# Notes - ${topic}

## Notes brutes

À compléter.

## Points importants

- À compléter.

## À vérifier

- À compléter.

## Idées de fiches possibles

- À compléter.
`,
  };
}

function createFileIfMissing(filePath, content) {
  if (fs.existsSync(filePath)) {
    if (!fs.statSync(filePath).isFile()) {
      throw new Error(
        `Le chemin existe mais n'est pas un fichier : ${toProjectRelative(filePath)}`
      );
    }

    return;
  }

  fs.writeFileSync(filePath, content, { encoding: "utf8", flag: "wx" });
}

function prepareResearchDirectory(topic, slug, dryRun) {
  const topicDirectory = path.join(RESEARCH_ROOT, slug);
  const templates = buildTemplates(topic);

  fs.mkdirSync(topicDirectory, { recursive: true });
  createFileIfMissing(
    path.join(topicDirectory, "research-plan.md"),
    templates["research-plan.md"]
  );
  createFileIfMissing(
    path.join(topicDirectory, "notes.md"),
    templates["notes.md"]
  );

  const sourcesPath = path.join(topicDirectory, "sources.md");

  // Un dry-run ne crée ni ne modifie sources.md.
  if (!dryRun) {
    createFileIfMissing(sourcesPath, templates["sources.md"]);
  }

  return { topicDirectory, sourcesPath };
}

function decodeHtml(value) {
  const namedEntities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
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

function cleanTitle(html) {
  return decodeHtml(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

// DuckDuckGo peut placer l'URL finale dans le paramètre uddg.
function extractDestinationUrl(rawHref) {
  const decodedHref = decodeHtml(rawHref).trim();
  const absoluteHref = decodedHref.startsWith("//")
    ? `https:${decodedHref}`
    : decodedHref;

  try {
    const parsedUrl = new URL(absoluteHref, "https://html.duckduckgo.com");
    const destination = parsedUrl.searchParams.get("uddg");
    const resultUrl = destination ? new URL(destination) : parsedUrl;

    if (!["http:", "https:"].includes(resultUrl.protocol)) {
      return null;
    }

    return resultUrl.toString();
  } catch {
    return null;
  }
}

function parseSearchResults(html, limit) {
  const results = [];
  const seenUrls = new Set();
  const resultPattern =
    /<a\b[^>]*class=["'][^"']*\bresult__a\b[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = resultPattern.exec(html)) !== null && results.length < limit) {
    const url = extractDestinationUrl(match[1]);
    const title = cleanTitle(match[2]);

    if (!url || !title || seenUrls.has(url)) {
      continue;
    }

    seenUrls.add(url);
    results.push({ title, url });
  }

  if (results.length === 0) {
    if (/no results|aucun résultat/i.test(html)) {
      throw new Error("Aucun résultat trouvé.");
    }

    throw new Error(
      "La réponse HTML du moteur de recherche est impossible à parser."
    );
  }

  return results;
}

// Télécharge uniquement la page de résultats, jamais les pages candidates.
function requestSearchPage(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          Accept: "text/html",
          "User-Agent": "Knowledge-Hub-Local-Source-Search/1.0",
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (response) => {
        const statusCode = response.statusCode || 0;
        const location = response.headers.location;

        if (
          statusCode >= 300 &&
          statusCode < 400 &&
          location &&
          redirectCount < 3
        ) {
          response.resume();

          const redirectUrl = new URL(location, url);

          if (
            !["html.duckduckgo.com", "duckduckgo.com"].includes(
              redirectUrl.hostname
            )
          ) {
            reject(new Error("Redirection inattendue du moteur de recherche."));
            return;
          }

          requestSearchPage(redirectUrl, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(
            new Error(
              `Moteur de recherche inaccessible : erreur HTTP ${statusCode}.`
            )
          );
          return;
        }

        const contentType = String(response.headers["content-type"] || "");

        if (!contentType.toLowerCase().includes("text/html")) {
          response.resume();
          reject(
            new Error(
              "La réponse du moteur de recherche n'est pas une page HTML."
            )
          );
          return;
        }

        let responseBody = "";
        let responseBytes = 0;

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBytes += Buffer.byteLength(chunk);

          if (responseBytes > MAX_RESPONSE_BYTES) {
            request.destroy(
              new Error("La réponse du moteur de recherche est trop volumineuse.")
            );
            return;
          }

          responseBody += chunk;
        });
        response.on("end", () => resolve(responseBody));
      }
    );

    request.on("timeout", () => {
      request.destroy(
        new Error("Le moteur de recherche ne répond pas dans le délai prévu.")
      );
    });

    request.on("error", (error) => {
      if (
        ["ENOTFOUND", "ENETUNREACH", "EAI_AGAIN"].includes(error.code)
      ) {
        reject(
          new Error(
            "Accès internet indisponible ou moteur de recherche introuvable."
          )
        );
        return;
      }

      reject(error);
    });
  });
}

function extractExistingUrls(markdown) {
  const urls = markdown.match(/https?:\/\/[^\s<>()]+/gi) || [];

  return new Set(
    urls.map((url) => url.replace(/[.,;:!?]+$/g, ""))
  );
}

function formatCandidate(result, query) {
  return `### Source candidate - ${result.title}

- URL : ${result.url}
- Titre : ${result.title}
- Type : web
- Moteur : ${SEARCH_ENGINE}
- Requête : ${query}
- Statut : à lire
- Fiabilité : à vérifier
- Notes : Source candidate trouvée automatiquement. À valider manuellement.
`;
}

function insertCandidates(markdown, candidates) {
  const headingPattern = /^## Sources candidates\s*$/m;
  const headingMatch = headingPattern.exec(markdown);

  if (!headingMatch) {
    throw new Error(
      "La section ## Sources candidates est absente de sources.md."
    );
  }

  const contentStart = headingMatch.index + headingMatch[0].length;
  const nextHeadingMatch = /^##\s+/m.exec(markdown.slice(contentStart));
  const insertionIndex = nextHeadingMatch
    ? contentStart + nextHeadingMatch.index
    : markdown.length;
  const before = markdown.slice(0, insertionIndex).trimEnd();
  const after = markdown.slice(insertionIndex).trimStart();
  const candidateBlock = candidates.join("\n").trim();

  return `${before}\n\n${candidateBlock}\n\n${after}`.trimEnd() + "\n";
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
  const command = `node scripts/search-web-sources.js${
    commandArguments ? ` ${commandArguments}` : ""
  }`;

  const logContent = `# Recherche de sources web candidates

## Requête

${runResult.query || "Non définie"}

## Slug

\`${runResult.slug || "Non défini"}\`

## Dossier

\`${runResult.directory || "Non créé"}\`

## Moteur utilisé

${SEARCH_ENGINE}

## Limite utilisée

${runResult.limit}

## Résultats trouvés

${runResult.foundCount}

## Sources ajoutées

${runResult.addedCount}

## Doublons ignorés

${runResult.duplicateCount}

## Dry-run

${runResult.dryRun ? "oui" : "non"}

## Erreurs

${errors}

## Commande exécutée

\`${command.replace(/`/g, "")}\`

## Confidentialité

- Le contenu complet des pages web n'est pas enregistré dans ce log.
- Seule la page de résultats du moteur est consultée par le script.
`;

  fs.mkdirSync(logsDirectory, { recursive: true });
  fs.writeFileSync(logPath, logContent, "utf8");
  console.log(`Log créé : ${toProjectRelative(logPath)}`);
}

async function main() {
  console.log(
    "Attention : cette recherche envoie la requête au moteur de recherche web. N'utilise pas de données privées dans ta requête."
  );

  try {
    const options = parseArguments(process.argv.slice(2));
    const slug = createSlug(options.query);

    if (!slug) {
      throw new Error(
        "La requête doit contenir au moins une lettre ou un chiffre."
      );
    }

    runResult.query = options.query;
    runResult.slug = slug;
    runResult.limit = options.limit;
    runResult.dryRun = options.dryRun;

    const { topicDirectory, sourcesPath } = prepareResearchDirectory(
      options.query,
      slug,
      options.dryRun
    );

    runResult.directory = toProjectRelative(topicDirectory);

    const searchUrl = new URL(`https://${SEARCH_HOST}/html/`);
    searchUrl.searchParams.set("q", options.query);

    const html = await requestSearchPage(searchUrl);
    const results = parseSearchResults(html, options.limit);
    runResult.foundCount = results.length;

    const sourcesContent = fs.existsSync(sourcesPath)
      ? fs.readFileSync(sourcesPath, "utf8")
      : "";
    const existingUrls = extractExistingUrls(sourcesContent);
    const newResults = results.filter((result) => {
      if (existingUrls.has(result.url)) {
        runResult.duplicateCount += 1;
        return false;
      }

      existingUrls.add(result.url);
      return true;
    });

    if (options.dryRun) {
      console.log("\nSources trouvées :");
      for (const result of newResults) {
        console.log(`- ${result.title}`);
        console.log(`  ${result.url}`);
      }
    } else if (newResults.length > 0) {
      const candidates = newResults.map((result) =>
        formatCandidate(result, options.query)
      );
      const updatedSources = insertCandidates(sourcesContent, candidates);

      fs.writeFileSync(sourcesPath, updatedSources, "utf8");
      runResult.addedCount = newResults.length;
    }

    console.log(`Requête : ${options.query}`);
    console.log(`Slug : ${slug}`);
    console.log(`Dossier utilisé : ${runResult.directory}`);
    console.log(`Résultats trouvés : ${runResult.foundCount}`);
    console.log(`Nouvelles sources ajoutées : ${runResult.addedCount}`);
    console.log(`Doublons ignorés : ${runResult.duplicateCount}`);
    console.log(
      "Rappel : les sources candidates doivent être vérifiées manuellement."
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

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  generateNoteDirect,
} = require("./mvp/generate-note-direct-with-ollama");
const {
  ALLOWED_TOPICS,
  cleanSourceText,
  createSlug,
  extractFetchedSource,
  finalizeGeneratedNote,
  findFetchedFileForUrl,
} = require("./mvp/research-mvp");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const KNOWLEDGE_ROOT = path.join(PROJECT_ROOT, "knowledge");
const RESEARCH_ROOT = path.join(PROJECT_ROOT, "data", "raw", "research");
const DEFAULT_LIMIT = 5;

function parseArguments(argumentsList) {
  const queryParts = [];
  let requestedTopic = "";
  let limit = DEFAULT_LIMIT;
  let force = false;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--force") {
      force = true;
      continue;
    }

    if (argument === "--topic" || argument === "--limit") {
      const value = argumentsList[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error(`Une valeur est requise après ${argument}.`);
      }

      if (argument === "--topic") {
        requestedTopic = value;
      } else {
        limit = Number.parseInt(value, 10);
      }

      index += 1;
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(`Option inconnue : ${argument}`);
    }

    queryParts.push(argument);
  }

  const query = queryParts.join(" ").trim();

  if (!query) {
    throw new Error("Une requête utilisateur est obligatoire.");
  }

  if (requestedTopic && !ALLOWED_TOPICS.has(requestedTopic)) {
    throw new Error(
      `Topic invalide. Valeurs : ${[...ALLOWED_TOPICS].join(", ")}.`
    );
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
    throw new Error("--limit doit être compris entre 1 et 10.");
  }

  return {
    query,
    slug: createSlug(query),
    requestedTopic,
    limit,
    force,
  };
}

function runScript(script, args) {
  const result = spawnSync(
    process.execPath,
    [path.join(PROJECT_ROOT, script), ...args],
    {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      shell: false,
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error || result.status !== 0) {
    throw new Error(
      `${script} a échoué : ${
        result.error ? result.error.message : `code ${result.status}`
      }`
    );
  }
}

function readSelectedSource(researchDirectory) {
  const selectedPath = path.join(researchDirectory, "selected-source.md");

  if (!fs.existsSync(selectedPath)) {
    return null;
  }

  const content = fs.readFileSync(selectedPath, "utf8");
  const titleMatch = content.match(/^- Titre\s*:\s*(.+)$/m);
  const urlMatch = content.match(/^- URL\s*:\s*(https?:\/\/\S+)$/m);
  const adequate = /^- Niveau d'adéquation\s*:\s*adequate$/m.test(content);

  if (!titleMatch || !urlMatch || !adequate) {
    return null;
  }

  const fetchedPath = findFetchedFileForUrl(
    researchDirectory,
    urlMatch[1].trim()
  );

  if (!fetchedPath) {
    return null;
  }

  return {
    title: titleMatch[1].trim(),
    url: urlMatch[1].trim(),
    fetchedPath,
    reused: true,
  };
}

function prepareSource(options) {
  const researchDirectory = path.join(RESEARCH_ROOT, options.slug);
  const reusable = readSelectedSource(researchDirectory);

  if (reusable) {
    console.log("Source adéquate existante réutilisée sans modifier data/raw/.");
    return reusable;
  }

  runScript("scripts/search-web-sources.js", [
    options.query,
    "--limit",
    String(options.limit),
  ]);
  runScript("scripts/validate-sources.js", [options.slug]);
  runScript("scripts/select-and-fetch-best-source.js", [
    options.slug,
    "--check-adequacy",
    "--max-attempts",
    String(options.limit),
  ]);

  const selected = readSelectedSource(researchDirectory);

  if (!selected) {
    throw new Error(
      "La sélection n'a pas produit de source adéquate et récupérée."
    );
  }

  return { ...selected, reused: false };
}

function verifyIndex(note) {
  const indexPath = path.join(
    PROJECT_ROOT,
    "data",
    "processed",
    "knowledge-index.json"
  );
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const relativePath = path
    .relative(PROJECT_ROOT, note.destination)
    .split(path.sep)
    .join("/");
  const entry = Array.isArray(index.files)
    ? index.files.find((item) => item.path === relativePath)
    : null;

  if (!entry) {
    throw new Error("La fiche générée est absente de l'index.");
  }

  return entry;
}

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

function writeRunLog(result) {
  const logsDirectory = path.join(PROJECT_ROOT, "logs", "runs");
  const logPath = path.join(
    logsDirectory,
    `${formatTimestamp(new Date())}-run-research-mvp.md`
  );
  const content = `# Run: research MVP

## Objectif du run

Produire une fiche Markdown brouillon avec le pipeline direct et local du MVP.

## Fichiers lus

- \`AGENTS.md\`
- \`README.md\`
- \`PROJECT_STATUS.md\`
- \`${result.sourcePath || "Aucune source récupérée"}\`

## Fichiers créés

- \`${result.outputPath || "Aucun"}\`

## Fichiers modifiés

- \`data/processed/knowledge-index.json\` si le run a réussi

## Erreurs rencontrées

- ${result.error || "Aucune"}

## Décisions prises

- Réutilisation d'une source adéquate existante lorsqu'elle est disponible.
- Un seul appel Ollama principal, avec au plus une réparation.
- Validation avant écriture atomique et indexation.
- Statut final conservé à \`draft\`.

## Commandes exécutées

- \`${process.argv.map((argument) => JSON.stringify(argument)).join(" ")}\`

## Provider IA utilisé

- Provider : \`ollama\`
- Modèle : \`${result.model}\`
`;

  fs.mkdirSync(logsDirectory, { recursive: true });
  fs.writeFileSync(logPath, content, "utf8");
  return logPath;
}

async function main() {
  const result = {
    model: process.env.OLLAMA_MODEL || "qwen2.5:7b",
    sourcePath: "",
    outputPath: "",
    error: "",
  };

  try {
    const options = parseArguments(process.argv.slice(2));
    const selected = prepareSource(options);
    const relativeSourcePath = path
      .relative(PROJECT_ROOT, selected.fetchedPath)
      .split(path.sep)
      .join("/");
    result.sourcePath = relativeSourcePath;
    const fetchedMarkdown = fs.readFileSync(selected.fetchedPath, "utf8");
    const source = extractFetchedSource(
      fetchedMarkdown,
      relativeSourcePath
    );
    const cleanedSource = cleanSourceText(source.text, {
      query: options.query,
    });
    const context = {
      query: options.query,
      sourceUrl: source.url,
      cleanedSource,
      requestedTopic: options.requestedTopic,
      updated: new Date().toISOString().slice(0, 10),
    };
    const generatedMarkdown = await generateNoteDirect({
      query: options.query,
      sourceTitle: source.title,
      sourceUrl: source.url,
      sourcePath: relativeSourcePath,
      cleanedSource,
      requestedTopic: options.requestedTopic,
      updated: context.updated,
    });
    const note = finalizeGeneratedNote({
      generatedMarkdown,
      context,
      knowledgeRoot: KNOWLEDGE_ROOT,
      force: options.force,
    });

    result.outputPath = path
      .relative(PROJECT_ROOT, note.destination)
      .split(path.sep)
      .join("/");

    runScript("scripts/index-knowledge.js", []);
    const indexEntry = verifyIndex(note);

    console.log("\nMVP terminé");
    console.log(`Source : ${result.sourcePath}`);
    console.log(`Fiche : ${result.outputPath}`);
    console.log(`Topic : ${note.topic}`);
    console.log(`Tags : ${note.tags.join(", ")}`);
    console.log(`Index : entrée présente (${indexEntry.path})`);
    console.log("Statut : draft, validation humaine requise.");
  } catch (error) {
    result.error =
      error instanceof Error ? error.message : "Erreur inconnue.";
    console.error(`Erreur MVP : ${result.error}`);
    process.exitCode = 1;
  } finally {
    const logPath = writeRunLog(result);
    console.log(
      `Log MVP : ${path.relative(PROJECT_ROOT, logPath).split(path.sep).join("/")}`
    );
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArguments,
  prepareSource,
  readSelectedSource,
  verifyIndex,
};

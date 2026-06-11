const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const indexPath = path.join(
  projectRoot,
  "data",
  "processed",
  "knowledge-index.json"
);
const runsDirectory = path.join(projectRoot, "logs", "runs");

const runResult = {
  query: "",
  all: false,
  topic: "",
  tag: "",
  resultCount: 0,
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

// Évite d'écraser un log créé pendant la même seconde.
function createUniqueLogPath(date) {
  const timestamp = formatTimestamp(date);
  const baseName = `${timestamp}-search-knowledge`;
  let logPath = path.join(runsDirectory, `${baseName}.md`);
  let suffix = 2;

  while (fs.existsSync(logPath)) {
    logPath = path.join(runsDirectory, `${baseName}-${suffix}.md`);
    suffix += 1;
  }

  return logPath;
}

// Facilite les comparaisons sans tenir compte de la casse ni des accents.
function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseArguments(argumentsList) {
  const options = {
    queryParts: [],
    all: false,
    topic: "",
    tag: "",
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--all") {
      options.all = true;
      continue;
    }

    if (argument === "--topic" || argument === "--tag") {
      const value = argumentsList[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error(`Une valeur est requise après ${argument}.`);
      }

      if (argument === "--topic") {
        options.topic = value;
      } else {
        options.tag = value;
      }

      index += 1;
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(`Option inconnue : ${argument}`);
    }

    options.queryParts.push(argument);
  }

  return {
    query: options.queryParts.join(" ").trim(),
    all: options.all,
    topic: options.topic,
    tag: options.tag,
  };
}

function readIndex() {
  if (!fs.existsSync(indexPath)) {
    throw new Error(
      "Index introuvable. Lance d'abord : node scripts/index-knowledge.js"
    );
  }

  let index;

  try {
    index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  } catch {
    throw new Error("Index invalide : le fichier JSON ne peut pas être lu.");
  }

  if (!index || !Array.isArray(index.files)) {
    throw new Error("Index invalide : la liste des fiches est absente.");
  }

  return index.files;
}

function matchesQuery(entry, query) {
  if (!query) {
    return true;
  }

  const searchableValues = [
    entry.title,
    entry.topic,
    entry.filename,
    entry.slug,
    entry.source_id,
    ...(Array.isArray(entry.tags) ? entry.tags : []),
    ...(Array.isArray(entry.headings) ? entry.headings : []),
  ];
  const normalizedQuery = normalize(query);

  return searchableValues.some((value) =>
    normalize(value).includes(normalizedQuery)
  );
}

function matchesTopic(entry, topic) {
  return !topic || normalize(entry.topic) === normalize(topic);
}

function matchesTag(entry, tag) {
  if (!tag) {
    return true;
  }

  const tags = Array.isArray(entry.tags) ? entry.tags : [];

  return tags.some((entryTag) => normalize(entryTag) === normalize(tag));
}

function getMainHeadings(entry) {
  const headings = Array.isArray(entry.headings) ? entry.headings : [];
  const mainHeadings = headings.filter((heading) => /^#{1,2}\s/.test(heading));

  return mainHeadings.slice(0, 8);
}

function displayEntry(entry, index) {
  const tags =
    Array.isArray(entry.tags) && entry.tags.length > 0
      ? entry.tags.join(", ")
      : "aucun";
  const headings = getMainHeadings(entry);

  console.log(`\n${index + 1}. ${entry.title || "Sans titre"}`);
  console.log(`   Topic : ${entry.topic || "non renseigné"}`);
  console.log(`   Tags : ${tags}`);
  console.log(`   Status : ${entry.status || "non renseigné"}`);
  console.log(`   Confidence : ${entry.confidence || "non renseignée"}`);
  console.log(`   Fichier : ${entry.path || entry.filename || "inconnu"}`);
  console.log("   Headings principales :");

  if (headings.length === 0) {
    console.log("   - aucune");
    return;
  }

  for (const heading of headings) {
    console.log(`   - ${heading}`);
  }
}

function escapeLogValue(value) {
  return String(value || "Aucun")
    .replace(/`/g, "'")
    .replace(/\r?\n/g, " ");
}

// Le log garde les critères et le résultat, jamais le contenu des fiches.
function writeRunLog() {
  fs.mkdirSync(runsDirectory, { recursive: true });

  const logPath = createUniqueLogPath(new Date());
  const errors =
    runResult.errors.length > 0
      ? runResult.errors.map((error) => `- ${error}`).join("\n")
      : "- Aucune";
  const filters = [
    `- Toutes les fiches : ${runResult.all ? "oui" : "non"}`,
    `- Topic : \`${escapeLogValue(runResult.topic)}\``,
    `- Tag : \`${escapeLogValue(runResult.tag)}\``,
  ].join("\n");
  const commandArguments = [
    runResult.all ? "--all" : "",
    runResult.topic ? `--topic "${escapeLogValue(runResult.topic)}"` : "",
    runResult.tag ? `--tag "${escapeLogValue(runResult.tag)}"` : "",
    runResult.query ? `"${escapeLogValue(runResult.query)}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const logContent = `# Recherche locale dans Knowledge Hub

## Objectif du run

Rechercher des fiches dans l'index JSON local de Knowledge Hub.

## Query utilisée

\`${escapeLogValue(runResult.query)}\`

## Filtres utilisés

${filters}

## Nombre de résultats

${runResult.resultCount}

## Erreurs rencontrées

${errors}

## Commandes exécutées

- \`node scripts/search-knowledge.js${commandArguments ? ` ${commandArguments}` : ""}\`

## Confidentialité

- Le contenu complet des fiches n'est pas enregistré dans ce log.
`;

  fs.writeFileSync(logPath, logContent, "utf8");
  console.log(
    `\nLog créé : ${path.relative(projectRoot, logPath).split(path.sep).join("/")}`
  );
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));

    runResult.query = options.query;
    runResult.all = options.all;
    runResult.topic = options.topic;
    runResult.tag = options.tag;

    if (!options.all && !options.query && !options.topic && !options.tag) {
      throw new Error(
        "Ajoute une recherche, --all, --topic ou --tag."
      );
    }

    const entries = readIndex();
    const results = entries.filter(
      (entry) =>
        matchesTopic(entry, options.topic) &&
        matchesTag(entry, options.tag) &&
        (options.all || matchesQuery(entry, options.query))
    );

    runResult.resultCount = results.length;

    if (results.length === 0) {
      console.log("Aucun résultat trouvé.");
      return;
    }

    console.log(`${results.length} résultat(s) trouvé(s) :`);
    results.forEach(displayEntry);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue.";

    runResult.errors.push(message);
    console.error(message);
    process.exitCode = 1;
  } finally {
    try {
      writeRunLog();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue.";

      console.error(`Impossible d'écrire le log : ${message}`);
      process.exitCode = 1;
    }
  }
}

main();

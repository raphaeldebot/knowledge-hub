const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const RESEARCH_ROOT = path.join(PROJECT_ROOT, "data", "raw", "research");

const runResult = {
  topic: "",
  slug: "",
  directory: "",
  createdFiles: [],
  existingFiles: [],
  errors: [],
};

// Produit la date utilisée dans le nom du log.
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
function getUniqueLogPath(logsDirectory, timestamp) {
  const baseName = `${timestamp}-create-research-topic`;
  let logPath = path.join(logsDirectory, `${baseName}.md`);
  let suffix = 2;

  while (fs.existsSync(logPath)) {
    logPath = path.join(logsDirectory, `${baseName}-${suffix}.md`);
    suffix += 1;
  }

  return logPath;
}

// Transforme un sujet en nom de dossier simple et sûr.
function createSlug(topic) {
  return topic
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toProjectRelative(filePath) {
  return path.relative(PROJECT_ROOT, filePath).split(path.sep).join("/");
}

function formatList(items, emptyMessage) {
  return items.length > 0
    ? items.map((item) => `- \`${item}\``).join("\n")
    : `- ${emptyMessage}`;
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

// Crée un fichier seulement s'il n'existe pas déjà.
function createFileIfMissing(filePath, content) {
  if (fs.existsSync(filePath)) {
    if (!fs.statSync(filePath).isFile()) {
      throw new Error(
        `Le chemin existe mais n'est pas un fichier : ${toProjectRelative(filePath)}`
      );
    }

    runResult.existingFiles.push(toProjectRelative(filePath));
    return;
  }

  fs.writeFileSync(filePath, content, { encoding: "utf8", flag: "wx" });
  runResult.createdFiles.push(toProjectRelative(filePath));
}

// Le log ne contient pas le contenu des fichiers de recherche.
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
  const command = `node scripts/create-research-topic.js${
    commandArguments ? ` ${commandArguments}` : ""
  }`;

  const logContent = `# Création d'un dossier de recherche

## Sujet

${runResult.topic || "Non défini"}

## Slug

\`${runResult.slug || "Non défini"}\`

## Dossier

\`${runResult.directory || "Non créé"}\`

## Fichiers créés

${formatList(runResult.createdFiles, "Aucun")}

## Fichiers déjà existants

${formatList(runResult.existingFiles, "Aucun")}

## Erreurs

${errors}

## Commande exécutée

\`${command.replace(/`/g, "")}\`

## Confidentialité

- Aucun contenu de source n'est enregistré dans ce log.
- Aucune donnée n'est envoyée vers un service externe.
`;

  fs.mkdirSync(logsDirectory, { recursive: true });
  fs.writeFileSync(logPath, logContent, "utf8");
  console.log(`Log créé : ${toProjectRelative(logPath)}`);
}

function main() {
  try {
    const topic = process.argv.slice(2).join(" ").trim();

    if (!topic) {
      throw new Error(
        "Sujet manquant. Exemple : node scripts/create-research-topic.js comfyui"
      );
    }

    const slug = createSlug(topic);

    if (!slug) {
      throw new Error(
        "Le sujet doit contenir au moins une lettre ou un chiffre."
      );
    }

    const topicDirectory = path.join(RESEARCH_ROOT, slug);
    const directoryAlreadyExists = fs.existsSync(topicDirectory);

    runResult.topic = topic;
    runResult.slug = slug;
    runResult.directory = toProjectRelative(topicDirectory);

    fs.mkdirSync(topicDirectory, { recursive: true });

    const templates = buildTemplates(topic);

    for (const [filename, content] of Object.entries(templates)) {
      createFileIfMissing(path.join(topicDirectory, filename), content);
    }

    console.log(`Sujet : ${topic}`);
    console.log(`Slug : ${slug}`);
    console.log(
      `Dossier ${directoryAlreadyExists ? "réutilisé" : "créé"} : ${
        runResult.directory
      }`
    );
    console.log(
      `Fichiers créés : ${
        runResult.createdFiles.join(", ") || "aucun"
      }`
    );
    console.log(
      `Fichiers déjà existants : ${
        runResult.existingFiles.join(", ") || "aucun"
      }`
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

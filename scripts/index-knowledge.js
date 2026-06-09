const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const knowledgeDirectory = path.join(projectRoot, "knowledge");
const processedDirectory = path.join(projectRoot, "data", "processed");
const runsDirectory = path.join(projectRoot, "logs", "runs");
const indexPath = path.join(processedDirectory, "knowledge-index.json");

const indexedFields = [
  "title",
  "topic",
  "level",
  "tags",
  "source_type",
  "source_id",
  "confidence",
  "status",
  "updated",
];

function toProjectPath(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

function formatRunTimestamp(date) {
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ];

  return parts.join("-");
}

function createUniqueRunLogPath(date) {
  const timestamp = formatRunTimestamp(date);
  const baseName = `${timestamp}-index-knowledge`;
  let logPath = path.join(runsDirectory, `${baseName}.md`);
  let suffix = 2;

  while (fs.existsSync(logPath)) {
    logPath = path.join(runsDirectory, `${baseName}-${suffix}.md`);
    suffix += 1;
  }

  return logPath;
}

function findMarkdownFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(entryPath));
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".md") {
      files.push(entryPath);
    }
  }

  return files.sort((first, second) => first.localeCompare(second));
}

function removeMatchingQuotes(value) {
  const trimmedValue = value.trim();
  const firstCharacter = trimmedValue[0];
  const lastCharacter = trimmedValue[trimmedValue.length - 1];

  if (
    trimmedValue.length >= 2 &&
    ((firstCharacter === '"' && lastCharacter === '"') ||
      (firstCharacter === "'" && lastCharacter === "'"))
  ) {
    return trimmedValue.slice(1, -1);
  }

  return trimmedValue;
}

function parseTags(value) {
  const trimmedValue = value.trim();

  if (!trimmedValue.startsWith("[") || !trimmedValue.endsWith("]")) {
    return trimmedValue ? [removeMatchingQuotes(trimmedValue)] : [];
  }

  const listContent = trimmedValue.slice(1, -1).trim();

  if (!listContent) {
    return [];
  }

  return listContent
    .split(",")
    .map((tag) => removeMatchingQuotes(tag))
    .filter(Boolean);
}

function parseFrontmatter(markdown) {
  const normalizedMarkdown = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = normalizedMarkdown.split("\n");

  if (lines[0].trim() !== "---") {
    return { values: {}, content: normalizedMarkdown, valid: false };
  }

  const closingDelimiterIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---"
  );

  if (closingDelimiterIndex === -1) {
    return { values: {}, content: normalizedMarkdown, valid: false };
  }

  const values = {};

  for (const line of lines.slice(1, closingDelimiterIndex)) {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (!indexedFields.includes(key)) {
      continue;
    }

    values[key] = key === "tags" ? parseTags(rawValue) : removeMatchingQuotes(rawValue);
  }

  return {
    values,
    content: lines.slice(closingDelimiterIndex + 1).join("\n"),
    valid: true,
  };
}

function extractHeadings(content) {
  const headings = [];
  let insideCodeBlock = false;

  for (const line of content.replace(/\r\n/g, "\n").split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      insideCodeBlock = !insideCodeBlock;
      continue;
    }

    if (!insideCodeBlock && /^#{1,6}\s+\S/.test(line)) {
      headings.push(line.trim());
    }
  }

  return headings;
}

function createIndexEntry(filePath, markdown) {
  const filename = path.basename(filePath);
  const parsed = parseFrontmatter(markdown);
  const values = parsed.values;

  return {
    path: toProjectPath(filePath),
    filename,
    slug: path.basename(filename, path.extname(filename)),
    title: values.title || "",
    topic: values.topic || "",
    level: values.level || "",
    tags: Array.isArray(values.tags) ? values.tags : [],
    source_type: values.source_type || "",
    source_id: values.source_id || "",
    confidence: values.confidence || "",
    status: values.status || "",
    updated: values.updated || "",
    headings: extractHeadings(parsed.content),
  };
}

function buildRunLog({
  startedAt,
  filesRead,
  outputWritten,
  errors,
  invalidFrontmatterFiles,
  skippedFiles,
}) {
  const lines = [
    "# Run: index knowledge",
    "",
    "## Objectif du run",
    "",
    "Indexer localement les fiches Markdown du dossier `knowledge/`.",
    "",
    "## Fichiers lus",
    "",
  ];

  if (filesRead.length === 0) {
    lines.push("- Aucun fichier Markdown trouvé");
  } else {
    lines.push(...filesRead.map((file) => `- \`${file}\``));
  }

  lines.push("", "## Fichiers ignorés", "");

  if (skippedFiles.length === 0) {
    lines.push("- Aucun");
  } else {
    lines.push(...skippedFiles.map((file) => `- \`${file}\``));
  }

  lines.push(
    "",
    "## Fichier créé ou modifié",
    "",
    `- \`${outputWritten}\``,
    "",
    "## Erreurs rencontrées",
    ""
  );

  if (errors.length === 0) {
    lines.push("- Aucune");
  } else {
    lines.push(...errors.map((error) => `- ${error}`));
  }

  lines.push("", "## Décisions prises", "");

  if (filesRead.length === 0) {
    lines.push("- Création d'un index vide car aucune fiche Markdown n'a été trouvée.");
  } else {
    lines.push("- Classement déterministe des fiches par chemin.");
  }

  lines.push("- Exclusion de `knowledge/_template.md`.");
  lines.push("- Utilisation exclusive des modules Node.js natifs `fs` et `path`.");
  lines.push("- Conservation de toutes les données en local.");

  if (invalidFrontmatterFiles.length > 0) {
    lines.push(
      `- Valeurs de frontmatter laissées vides pour : ${invalidFrontmatterFiles
        .map((file) => `\`${file}\``)
        .join(", ")}.`
    );
  }

  lines.push(
    "",
    "## Commandes exécutées",
    "",
    "- `node scripts/index-knowledge.js`",
    "",
    "## Informations du run",
    "",
    `- Début : ${startedAt.toISOString()}`,
    `- Fiches indexées : ${filesRead.length}`,
    ""
  );

  return lines.join("\n");
}

function main() {
  const startedAt = new Date();
  const filesRead = [];
  const errors = [];
  const invalidFrontmatterFiles = [];
  const skippedFiles = [];
  const entries = [];

  fs.mkdirSync(processedDirectory, { recursive: true });
  fs.mkdirSync(runsDirectory, { recursive: true });

  const templatePath = path.join(knowledgeDirectory, "_template.md");
  const markdownFiles = findMarkdownFiles(knowledgeDirectory).filter((filePath) => {
    if (path.resolve(filePath) === path.resolve(templatePath)) {
      skippedFiles.push(toProjectPath(filePath));
      return false;
    }

    return true;
  });

  for (const filePath of markdownFiles) {
    const projectPath = toProjectPath(filePath);

    try {
      const markdown = fs.readFileSync(filePath, "utf8");
      const parsed = parseFrontmatter(markdown);

      filesRead.push(projectPath);

      if (!parsed.valid) {
        invalidFrontmatterFiles.push(projectPath);
      }

      entries.push(createIndexEntry(filePath, markdown));
    } catch (error) {
      errors.push(`Lecture impossible de \`${projectPath}\` : ${error.message}`);
    }
  }

  const index = {
    generated_at: new Date().toISOString(),
    total_files: entries.length,
    files: entries,
  };

  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  const logPath = createUniqueRunLogPath(startedAt);
  const log = buildRunLog({
    startedAt,
    filesRead,
    outputWritten: toProjectPath(indexPath),
    errors,
    invalidFrontmatterFiles,
    skippedFiles,
  });

  fs.writeFileSync(logPath, log, "utf8");

  console.log(`Index créé : ${toProjectPath(indexPath)}`);
  console.log(`Fiches indexées : ${entries.length}`);
  console.log(`Log créé : ${toProjectPath(logPath)}`);
}

try {
  main();
} catch (error) {
  try {
    fs.mkdirSync(runsDirectory, { recursive: true });

    const failedAt = new Date();
    const logPath = createUniqueRunLogPath(failedAt);
    const log = [
      "# Run: index knowledge",
      "",
      "## Objectif du run",
      "",
      "Indexer localement les fiches Markdown du dossier `knowledge/`.",
      "",
      "## Fichiers lus",
      "",
      "- Aucun ou lecture interrompue",
      "",
      "## Fichiers ignorés",
      "",
      "- Aucun ou traitement interrompu",
      "",
      "## Fichier créé ou modifié",
      "",
      "- Aucun ou écriture interrompue",
      "",
      "## Erreurs rencontrées",
      "",
      `- ${error.message}`,
      "",
      "## Décisions prises",
      "",
      "- Arrêt propre du script après une erreur non récupérable.",
      "",
      "## Commandes exécutées",
      "",
      "- `node scripts/index-knowledge.js`",
      "",
    ].join("\n");

    fs.writeFileSync(logPath, log, "utf8");
  } catch (logError) {
    console.error(`Impossible d'écrire le log d'erreur : ${logError.message}`);
  }

  console.error(`Échec de l'indexation : ${error.message}`);
  process.exitCode = 1;
}

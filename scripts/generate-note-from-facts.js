const fs = require("node:fs");
const path = require("node:path");
const { atomicWriteFile } = require("./lib/atomic-file");
const { validateFactsDocument } = require("./lib/facts-contract");
const {
  renderFactsMarkdown,
  validateMarkdownAgainstFacts,
} = require("./lib/markdown-from-facts");

const PROJECT_ROOT = path.resolve(__dirname, "..");

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

function uniqueLogPath(directory, suffix) {
  const timestamp = formatTimestamp(new Date());
  let candidate = path.join(directory, `${timestamp}-${suffix}.md`);
  let counter = 2;

  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${timestamp}-${suffix}-${counter}.md`);
    counter += 1;
  }

  return candidate;
}

function toProjectPath(filePath) {
  return path.relative(PROJECT_ROOT, filePath).split(path.sep).join("/");
}

function isInsideDirectory(filePath, directory) {
  const relative = path.relative(directory, filePath);

  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function parseArguments(argumentsList) {
  const options = {
    input: "",
    output: "",
    force: false,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--force") {
      options.force = true;
      continue;
    }

    if (argument === "--input" || argument === "--output") {
      const value = argumentsList[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error(`Une valeur est requise après ${argument}.`);
      }

      options[argument === "--input" ? "input" : "output"] = value;
      index += 1;
      continue;
    }

    throw new Error(`Option inconnue : ${argument}`);
  }

  if (!options.input || !options.output) {
    throw new Error("Les options --input et --output sont obligatoires.");
  }

  return options;
}

function resolveProjectPath(value, label) {
  const resolved = path.resolve(PROJECT_ROOT, value);

  if (
    resolved !== PROJECT_ROOT &&
    !resolved.startsWith(`${PROJECT_ROOT}${path.sep}`)
  ) {
    throw new Error(`${label} doit rester dans le projet.`);
  }

  return resolved;
}

function getValidationPath(inputPath) {
  return path.join(path.dirname(inputPath), "final-validation.json");
}

function buildValidationReport({
  inputPath,
  outputPath,
  validation,
  written,
}) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    input: toProjectPath(inputPath),
    output: toProjectPath(outputPath),
    errors: validation.errors,
    warnings: validation.warnings,
    written,
  };
}

function generateValidatedMarkdown(document, sourceId) {
  const facts = validateFactsDocument(document);
  const markdown = renderFactsMarkdown(facts, { sourceId });
  const validation = validateMarkdownAgainstFacts(markdown, facts);

  if (validation.errors.length > 0) {
    throw new Error(
      `Validation finale bloquante : ${validation.errors.join(" | ")}`
    );
  }

  return { markdown, validation };
}

function writeErrorLog(message, inputPath, outputPath) {
  const directory = path.join(PROJECT_ROOT, "logs", "errors");
  fs.mkdirSync(directory, { recursive: true });
  const logPath = uniqueLogPath(directory, "generate-note-from-facts-error");
  const content = `# Erreur de génération depuis les faits

- Date : ${new Date().toISOString()}
- Étape : génération et validation Markdown
- Input : \`${inputPath}\`
- Output : \`${outputPath}\`
- Erreur : ${message}
- Effet : le fichier final existant est conservé et l'indexation doit être interrompue.
`;

  fs.writeFileSync(logPath, content, "utf8");
}

function writeRunLog(result) {
  const directory = path.join(PROJECT_ROOT, "logs", "runs");
  fs.mkdirSync(directory, { recursive: true });
  const logPath = uniqueLogPath(directory, "generate-note-from-facts");
  const content = `# Génération Markdown depuis les faits

## Objectif du run

Générer et valider une fiche adaptative depuis un contrat JSON source-grounded.

## Fichiers lus

- \`${result.input || "Non disponible"}\`

## Fichiers créés ou modifiés

- \`${result.output || "Aucun"}\`
- \`${result.validation || "Aucun"}\`

## Erreurs rencontrées

- ${result.error || "Aucune"}

## Décisions prises

- Le rendu Markdown est déterministe.
- Les erreurs factuelles bloquent l'écriture finale.
- Les avertissements sont consignés sans bloquer.
- L'écriture finale utilise un fichier temporaire puis un renommage.

## Commandes exécutées

- \`${result.command}\`

## Provider IA utilisé

- Aucun pour cette étape.

## Modèle utilisé

- Aucun.

## Résultat

- Statut : ${result.success ? "succès" : "erreur"}
- Avertissements : ${result.warningCount}
`;

  fs.writeFileSync(logPath, content, "utf8");
}

function main() {
  const result = {
    input: "",
    output: "",
    validation: "",
    command: [process.execPath, ...process.argv.slice(1)].join(" "),
    warningCount: 0,
    success: false,
    error: "",
  };

  try {
    const options = parseArguments(process.argv.slice(2));
    const inputPath = resolveProjectPath(options.input, "Le fichier input");
    const outputPath = resolveProjectPath(options.output, "Le fichier output");
    const knowledgeDirectory = path.join(PROJECT_ROOT, "knowledge");

    if (!isInsideDirectory(outputPath, knowledgeDirectory)) {
      throw new Error("Le fichier output doit rester dans knowledge/.");
    }

    if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile()) {
      throw new Error(`Fichier de faits absent : ${toProjectPath(inputPath)}`);
    }

    const document = JSON.parse(fs.readFileSync(inputPath, "utf8"));
    const generated = generateValidatedMarkdown(
      document,
      toProjectPath(inputPath)
    );
    const validationPath = getValidationPath(inputPath);
    const pendingValidationReport = buildValidationReport({
      inputPath,
      outputPath,
      validation: generated.validation,
      written: false,
    });

    atomicWriteFile(
      validationPath,
      `${JSON.stringify(pendingValidationReport, null, 2)}\n`,
      { force: true }
    );
    atomicWriteFile(outputPath, generated.markdown, {
      force: options.force,
    });
    const completedValidationReport = buildValidationReport({
      inputPath,
      outputPath,
      validation: generated.validation,
      written: true,
    });
    atomicWriteFile(
      validationPath,
      `${JSON.stringify(completedValidationReport, null, 2)}\n`,
      { force: true }
    );

    result.input = toProjectPath(inputPath);
    result.output = toProjectPath(outputPath);
    result.validation = toProjectPath(validationPath);
    result.warningCount = generated.validation.warnings.length;
    result.success = true;

    console.log(`Fiche générée : ${result.output}`);
    console.log(`Validation : ${result.validation}`);
    console.log(`Avertissements : ${result.warningCount}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue.";

    result.error = message;
    writeErrorLog(
      message,
      result.input || "Non disponible",
      result.output || "Non disponible"
    );
    console.error(`Erreur : ${message}`);
    process.exitCode = 1;
  } finally {
    writeRunLog(result);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildValidationReport,
  generateValidatedMarkdown,
  getValidationPath,
  main,
  parseArguments,
};

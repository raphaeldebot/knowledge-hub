const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { validateFactsDocument } = require("./lib/facts-contract");
const {
  validateMarkdownAgainstFacts,
} = require("./lib/markdown-from-facts");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const DEFAULT_MODEL = "qwen3:14b";

const runResult = {
  query: "",
  slug: "",
  topic: "",
  output: "",
  model: DEFAULT_MODEL,
  limit: DEFAULT_LIMIT,
  force: false,
  dryRun: false,
  result: "Erreur",
  exitCode: 1,
  failedStep: "Aucune",
  errors: [],
  steps: [],
  totalDurationMs: 0,
  sourcesAttempted: 0,
  finalAdequacyLevel: "Non disponible",
  finalAdequacyScore: null,
  finalSelectionMode: "Non disponible",
  adequacyWarning: "Aucun",
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
  const baseName = `${timestamp}-run-research-pipeline`;
  let logPath = path.join(logsDirectory, `${baseName}.md`);
  let suffix = 2;

  while (fs.existsSync(logPath)) {
    logPath = path.join(logsDirectory, `${baseName}-${suffix}.md`);
    suffix += 1;
  }

  return logPath;
}

// Produit un slug simple et stable à partir de la requête.
function createSlug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidPathSegment(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

// Lit la requête et les options sans dépendance externe.
function parseArguments(argumentsList) {
  const options = {
    queryParts: [],
    topic: "",
    output: "",
    limit: DEFAULT_LIMIT,
    model: DEFAULT_MODEL,
    force: false,
    dryRun: false,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--force") {
      options.force = true;
      continue;
    }

    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (
      argument === "--topic" ||
      argument === "--output" ||
      argument === "--limit" ||
      argument === "--model"
    ) {
      const value = argumentsList[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error(`Une valeur est requise après ${argument}.`);
      }

      if (argument === "--topic") {
        options.topic = value;
      } else if (argument === "--output") {
        options.output = value;
      } else if (argument === "--model") {
        options.model = value;
      } else {
        const parsedLimit = Number.parseInt(value, 10);

        if (
          !Number.isInteger(parsedLimit) ||
          parsedLimit < 1 ||
          parsedLimit > MAX_LIMIT
        ) {
          throw new Error(
            `--limit doit être un entier compris entre 1 et ${MAX_LIMIT}.`
          );
        }

        options.limit = parsedLimit;
      }

      index += 1;
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(`Option inconnue : ${argument}`);
    }

    options.queryParts.push(argument);
  }

  const query = options.queryParts.join(" ").trim();

  if (!query) {
    throw new Error("Une phrase de recherche est obligatoire.");
  }

  if (!options.topic) {
    throw new Error("L'option --topic est obligatoire.");
  }

  if (!isValidPathSegment(options.topic)) {
    throw new Error(
      "--topic doit contenir seulement des lettres minuscules, chiffres et tirets."
    );
  }

  const slug = createSlug(query);

  if (!slug) {
    throw new Error("La phrase de recherche ne permet pas de créer un slug.");
  }

  const output = options.output || slug;

  if (!isValidPathSegment(output)) {
    throw new Error(
      "--output doit contenir seulement des lettres minuscules, chiffres et tirets."
    );
  }

  if (!options.model.trim()) {
    throw new Error("--model ne peut pas être vide.");
  }

  return {
    query,
    slug,
    topic: options.topic,
    output,
    limit: options.limit,
    model: options.model.trim(),
    force: options.force,
    dryRun: options.dryRun,
  };
}

function quoteArgument(value) {
  return /^[a-zA-Z0-9_./:-]+$/.test(value)
    ? value
    : JSON.stringify(value);
}

function formatCommand(script, args, model) {
  const environmentPrefix = model
    ? `OLLAMA_MODEL=${quoteArgument(model)} `
    : "";
  const commandArguments = [script, ...args].map(quoteArgument).join(" ");

  return `${environmentPrefix}node ${commandArguments}`;
}

function buildSteps(options) {
  const forceArgument = options.force ? ["--force"] : [];
  const factsPath = `data/raw/research/${options.slug}/extracted-facts.json`;
  const outputPath = `knowledge/${options.topic}/${options.output}.md`;

  return [
    {
      name: "Recherche des sources",
      script: "scripts/search-web-sources.js",
      args: [options.query, "--limit", String(options.limit)],
      useModel: false,
    },
    {
      name: "Validation locale des sources",
      script: "scripts/validate-sources.js",
      args: [options.slug, ...forceArgument],
      useModel: false,
    },
    {
      name: "Sélection, récupération et contrôle d'adéquation",
      script: "scripts/select-and-fetch-best-source.js",
      args: [
        options.slug,
        "--check-adequacy",
        "--max-attempts",
        String(options.limit),
        ...forceArgument,
      ],
      useModel: false,
    },
    {
      name: "Extraction JSON locale avec Ollama",
      script: "scripts/extract-facts-with-ollama.js",
      args: [
        options.slug,
        "--topic",
        options.topic,
        "--only-selected",
        ...forceArgument,
      ],
      useModel: true,
    },
    {
      name: "Génération et validation atomique de la fiche",
      script: "scripts/generate-note-from-facts.js",
      args: [
        "--input",
        factsPath,
        "--output",
        outputPath,
        ...forceArgument,
      ],
      useModel: false,
    },
    {
      name: "Mise à jour de l'index local",
      script: "scripts/index-knowledge.js",
      args: [],
      useModel: false,
    },
  ].map((step, index) => ({
    ...step,
    number: index + 1,
    status: "Non exécutée",
    exitCode: null,
    durationMs: 0,
  }));
}

function readFinalSelection(slug) {
  const selectedSourcePath = path.join(
    PROJECT_ROOT,
    "data",
    "raw",
    "research",
    slug,
    "selected-source.md"
  );

  if (!fs.existsSync(selectedSourcePath)) {
    throw new Error(
      "selected-source.md est absent après la sélection des sources."
    );
  }

  const content = fs.readFileSync(selectedSourcePath, "utf8");
  const attemptsMatch = content.match(
    /^- Tentatives effectuées\s*:\s*(\d+)$/m
  );
  const levelMatch = content.match(
    /^- Niveau d'adéquation\s*:\s*(adequate)$/m
  );
  const modeMatch = content.match(
    /^- Mode final\s*:\s*(adequate)$/m
  );
  const scoreMatch = content.match(
    /^- Score d'adéquation\s*:\s*(\d{1,3})\/100$/m
  );

  if (!attemptsMatch || !levelMatch || !modeMatch || !scoreMatch) {
    throw new Error(
      "Les informations finales d'adéquation sont absentes de selected-source.md."
    );
  }

  return {
    sourcesAttempted: Number(attemptsMatch[1]),
    level: levelMatch[1],
    score: Number(scoreMatch[1]),
    mode: modeMatch[1],
    warning: "Aucun",
  };
}

function readRequiredFile(relativePath, label) {
  const filePath = path.join(PROJECT_ROOT, relativePath);

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`${label} absent après l'étape : ${relativePath}`);
  }

  const content = fs.readFileSync(filePath, "utf8");

  if (!content.trim()) {
    throw new Error(`${label} vide après l'étape : ${relativePath}`);
  }

  return content;
}

function readRequiredJson(relativePath, label) {
  const content = readRequiredFile(relativePath, label);

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      `${label} contient un JSON invalide : ${
        error instanceof Error ? error.message : "erreur inconnue"
      }`
    );
  }
}

function validateStepArtifact(step, options) {
  const researchRoot = `data/raw/research/${options.slug}`;

  if (step.number === 1) {
    readRequiredFile(`${researchRoot}/sources.md`, "sources.md");
  } else if (step.number === 2) {
    readRequiredFile(
      `${researchRoot}/source-validation.md`,
      "source-validation.md"
    );
  } else if (step.number === 3) {
    const selection = readFinalSelection(options.slug);

    if (selection.level !== "adequate" || selection.mode !== "adequate") {
      throw new Error("La source finale n'est pas adéquate.");
    }
  } else if (step.number === 4) {
    const facts = readRequiredJson(
      `${researchRoot}/extracted-facts.json`,
      "extracted-facts.json"
    );

    validateFactsDocument(facts, {
      query: options.query,
      topic: options.topic,
    });
  } else if (step.number === 5) {
    const outputPath = `knowledge/${options.topic}/${options.output}.md`;
    const markdown = readRequiredFile(outputPath, "Fiche générée");
    const facts = readRequiredJson(
      `${researchRoot}/extracted-facts.json`,
      "extracted-facts.json"
    );
    const validationReport = readRequiredJson(
      `${researchRoot}/final-validation.json`,
      "final-validation.json"
    );
    const validation = validateMarkdownAgainstFacts(markdown, facts);

    if (
      !validationReport.written ||
      !Array.isArray(validationReport.errors) ||
      validationReport.errors.length > 0 ||
      validation.errors.length > 0
    ) {
      throw new Error(
        `La validation finale de la fiche a échoué : ${[
          ...(validationReport.errors || []),
          ...validation.errors,
        ].join(" | ")}`
      );
    }
  } else if (step.number === 6) {
    readRequiredFile(
      "data/processed/knowledge-index.json",
      "knowledge-index.json"
    );
  }
}

function printChildOutput(result) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

function executeStep(step, options) {
  const command = formatCommand(
    step.script,
    step.args,
    step.useModel ? options.model : ""
  );

  console.log(`\n[${step.number}/6] ${step.name}`);
  console.log(`Commande : ${command}`);

  if (options.dryRun) {
    step.status = "Dry-run";
    return;
  }

  const startedAt = Date.now();
  const scriptPath = path.join(PROJECT_ROOT, step.script);
  const environment = step.useModel
    ? { ...process.env, OLLAMA_MODEL: options.model }
    : process.env;
  const result = spawnSync(process.execPath, [scriptPath, ...step.args], {
    cwd: PROJECT_ROOT,
    env: environment,
    encoding: "utf8",
    shell: false,
    maxBuffer: 10 * 1024 * 1024,
  });

  step.durationMs = Date.now() - startedAt;
  printChildOutput(result);

  if (result.error) {
    step.status = "Erreur";
    step.exitCode = 1;
    throw new Error(`${step.name} : ${result.error.message}`);
  }

  step.exitCode = result.status === null ? 1 : result.status;

  if (step.exitCode !== 0) {
    step.status = "Erreur";
    throw new Error(
      `${step.name} a échoué avec le code de sortie ${step.exitCode}.`
    );
  }

  validateStepArtifact(step, options);
  step.status = "Succès";

  if (step.number === 3) {
    const selection = readFinalSelection(options.slug);

    runResult.sourcesAttempted = selection.sourcesAttempted;
    runResult.finalAdequacyLevel = selection.level;
    runResult.finalAdequacyScore = selection.score;
    runResult.finalSelectionMode = selection.mode;
    runResult.adequacyWarning = selection.warning;

    if (selection.mode !== "adequate") {
      console.warn(`Avertissement : ${selection.warning}`);
    }
  }
}

function executePipelineSteps(steps, options, execute = executeStep) {
  for (const step of steps) {
    try {
      execute(step, options);
    } catch (error) {
      runResult.failedStep = `Étape ${step.number} - ${step.name}`;
      throw error;
    }
  }

  return 0;
}

function formatDuration(durationMs) {
  return `${(durationMs / 1000).toFixed(2)} s`;
}

function formatMainCommand() {
  return [process.execPath, ...process.argv.slice(1)]
    .map(quoteArgument)
    .join(" ");
}

function writeRunLog() {
  const logsDirectory = path.join(PROJECT_ROOT, "logs", "runs");
  const timestamp = formatTimestamp(new Date());
  const logPath = getUniqueLogPath(logsDirectory, timestamp);
  const errors =
    runResult.errors.length > 0
      ? runResult.errors.map((error) => `- ${error}`).join("\n")
      : "- Aucune";
  const steps =
    runResult.steps.length > 0
      ? runResult.steps
          .map((step) => {
            const command = formatCommand(
              step.script,
              step.args,
              step.useModel ? runResult.model : ""
            );
            const exitCode =
              step.exitCode === null ? "Non disponible" : step.exitCode;

            return `### Étape ${step.number} - ${step.name}

- Commande : \`${command}\`
- Statut : ${step.status}
- Code de sortie : ${exitCode}
- Durée : ${formatDuration(step.durationMs)}`;
          })
          .join("\n\n")
      : "- Aucune étape préparée";

  const logContent = `# Pipeline de recherche Knowledge Hub

## Objectif du run

Lancer ou prévisualiser le workflow contrôlé allant d'une requête web à des faits JSON validés, puis à une fiche Markdown brouillon indexée localement.

## Paramètres

- Requête : ${runResult.query || "Non disponible"}
- Slug : \`${runResult.slug || "Non disponible"}\`
- Topic : \`${runResult.topic || "Non disponible"}\`
- Output : \`${runResult.output || "Non disponible"}\`
- Modèle Ollama : \`${runResult.model}\`
- Limite de résultats : ${runResult.limit}
- Force : ${runResult.force ? "oui" : "non"}
- Dry-run : ${runResult.dryRun ? "oui" : "non"}

## Étapes

${steps}

## Résultat final

- Résultat : ${runResult.result}
- Code de sortie : ${runResult.exitCode}
- Étape en échec : ${runResult.failedStep}
- Durée totale : ${formatDuration(runResult.totalDurationMs)}
- Sources essayées : ${runResult.sourcesAttempted}
- Niveau d'adéquation final : \`${runResult.finalAdequacyLevel}\`
- Score d'adéquation final : ${runResult.finalAdequacyScore === null ? "Non disponible" : `${runResult.finalAdequacyScore}/100`}
- Mode final : \`${runResult.finalSelectionMode}\`
- Avertissement : ${runResult.adequacyWarning}
- Statut de la fiche : brouillon

## Erreurs rencontrées

${errors}

## Commande exécutée

\`${formatMainCommand()}\`

## Confidentialité

- Le contenu complet des pages web n'est pas enregistré dans ce log.
- Le contenu complet des faits, réponses Ollama et fiches n'est pas enregistré dans ce log.
`;

  fs.mkdirSync(logsDirectory, { recursive: true });
  fs.writeFileSync(logPath, logContent, "utf8");
  console.log(
    `Log créé : ${path.relative(PROJECT_ROOT, logPath).split(path.sep).join("/")}`
  );
}

function writeErrorLog(message) {
  const logsDirectory = path.join(PROJECT_ROOT, "logs", "errors");
  const timestamp = formatTimestamp(new Date());
  const logPath = path.join(
    logsDirectory,
    `${timestamp}-run-research-pipeline-error.md`
  );
  const content = `# Erreur du pipeline de recherche

- Date : ${new Date().toISOString()}
- Étape : ${runResult.failedStep}
- Type : orchestration
- Erreur : ${message}
- Fiche concernée : \`knowledge/${runResult.topic || "<topic>"}/${runResult.output || "<output>"}.md\`
- Effet : les étapes suivantes, dont l'indexation, n'ont pas été exécutées.
`;

  fs.mkdirSync(logsDirectory, { recursive: true });
  fs.writeFileSync(logPath, content, "utf8");
}

function printSummary(options) {
  const outputPath = `knowledge/${options.topic}/${options.output}.md`;

  console.log("\nRésumé du pipeline");
  console.log(`Requête : ${options.query}`);
  console.log(`Slug : ${options.slug}`);
  console.log(`Topic : ${options.topic}`);
  console.log(`Modèle : ${options.model}`);
  console.log(`Fiche : ${outputPath}`);
  console.log(`Sources essayées : ${runResult.sourcesAttempted}`);
  console.log(
    `Niveau d'adéquation final : ${runResult.finalAdequacyLevel}`
  );
  console.log(
    `Score d'adéquation final : ${
      runResult.finalAdequacyScore === null
        ? "Non disponible"
        : `${runResult.finalAdequacyScore}/100`
    }`
  );
  console.log(`Mode final : ${runResult.finalSelectionMode}`);

  if (runResult.adequacyWarning !== "Aucun") {
    console.log(`Avertissement : ${runResult.adequacyWarning}`);
  }

  if (options.dryRun) {
    console.log("Index : non modifié en mode dry-run.");
  } else {
    console.log("Index : mis à jour.");
  }

  console.log(`Durée totale : ${formatDuration(runResult.totalDurationMs)}`);
  console.log(
    "Statut : la fiche générée reste un brouillon à valider humainement."
  );
}

function main() {
  const startedAt = Date.now();

  try {
    const options = parseArguments(process.argv.slice(2));

    Object.assign(runResult, options);
    runResult.steps = buildSteps(options);

    console.log(
      "Attention : la recherche envoie la requête à DuckDuckGo HTML. N'utilise pas de données privées."
    );

    executePipelineSteps(runResult.steps, options);

    runResult.result = options.dryRun ? "Dry-run réussi" : "Succès";
    runResult.exitCode = 0;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue.";

    runResult.errors.push(message);
    runResult.result = "Erreur";
    runResult.exitCode = 1;
    console.error(`\nErreur : ${message}`);
    writeErrorLog(message);
    process.exitCode = 1;
  } finally {
    runResult.totalDurationMs = Date.now() - startedAt;

    if (runResult.exitCode === 0) {
      printSummary(runResult);
    }

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

if (require.main === module) {
  main();
}

module.exports = {
  buildSteps,
  executePipelineSteps,
  readRequiredJson,
  readFinalSelection,
  validateStepArtifact,
};

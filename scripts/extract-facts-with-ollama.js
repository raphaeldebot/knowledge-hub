const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const {
  atomicWriteFile,
} = require("./lib/atomic-file");
const {
  FactsValidationError,
  parseJsonResponse,
  validateEvidence,
  validateFactsDocument,
} = require("./lib/facts-contract");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const RESEARCH_ROOT = path.join(PROJECT_ROOT, "data", "raw", "research");
const OLLAMA_URL = "http://localhost:11434";
const DEFAULT_MODEL = "qwen3:14b";
const REQUEST_TIMEOUT_MS = 120_000;
function buildFactsJsonSchema(evidenceLineIds = []) {
  return {
  type: "object",
  additionalProperties: false,
  required: ["facts", "missingInformation", "warnings"],
  properties: {
    facts: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type",
          "content",
          "evidenceLineId",
          "confidence",
        ],
        properties: {
          type: {
            type: "string",
            enum: [
              "text",
              "command",
              "code",
              "date",
              "quantity",
              "ingredient",
              "step",
              "warning",
              "definition",
            ],
          },
          content: { type: "string", minLength: 1 },
          evidenceLineId: {
            type: "string",
            pattern: "^L[1-9][0-9]*$",
          },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
        },
      },
    },
    missingInformation: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
    warnings: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
  },
  };
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

function parseArguments(argumentsList) {
  const options = {
    slug: "",
    topic: "",
    selectedFile: "",
    onlySelected: false,
    force: false,
    model: process.env.OLLAMA_MODEL || DEFAULT_MODEL,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--force") {
      options.force = true;
      continue;
    }

    if (argument === "--only-selected") {
      options.onlySelected = true;
      continue;
    }

    if (["--file", "--topic", "--model"].includes(argument)) {
      const value = argumentsList[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error(`Une valeur est requise après ${argument}.`);
      }

      if (argument === "--file") {
        options.selectedFile = value;
      } else if (argument === "--topic") {
        options.topic = value;
      } else {
        options.model = value;
      }

      index += 1;
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(`Option inconnue : ${argument}`);
    }

    if (options.slug) {
      throw new Error("Un seul slug est accepté.");
    }

    options.slug = argument;
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.slug)) {
    throw new Error("Slug absent ou invalide.");
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.topic)) {
    throw new Error("L'option --topic est obligatoire et doit être un segment sûr.");
  }

  if (
    options.selectedFile &&
    (path.basename(options.selectedFile) !== options.selectedFile ||
      path.extname(options.selectedFile).toLowerCase() !== ".md")
  ) {
    throw new Error("--file doit désigner un nom de fichier Markdown simple.");
  }

  if (options.selectedFile && options.onlySelected) {
    throw new Error("--file et --only-selected sont incompatibles.");
  }

  return options;
}

function extractSection(markdown, title) {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex(
    (line) => line.trim() === `## ${title}`
  );

  if (headingIndex < 0) {
    return "";
  }

  const content = [];

  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      break;
    }
    content.push(lines[index]);
  }

  return content.join("\n").trim();
}

function extractMetadata(markdown, fallbackTitle) {
  const metadata = extractSection(markdown, "Métadonnées");
  const titleMatch = markdown.match(/^#\s+Source récupérée\s*-\s*(.+)$/m);
  const urlMatch = metadata.match(/^- URL\s*:\s*(.+)$/m);
  const text = extractSection(markdown, "Texte extrait");

  if (!urlMatch || !urlMatch[1].trim()) {
    throw new Error("URL absente de la source récupérée.");
  }

  if (!text) {
    throw new Error('Section "Texte extrait" absente ou vide.');
  }

  return {
    title: titleMatch ? titleMatch[1].trim() : fallbackTitle,
    url: urlMatch[1].trim(),
    text,
  };
}

function readSelectedUrl(selectedSourcePath) {
  const content = fs.readFileSync(selectedSourcePath, "utf8");
  const match = content.match(/^- URL\s*:\s*(.+)$/m);

  if (!match || !match[1].trim()) {
    throw new Error("URL absente de selected-source.md.");
  }

  return match[1].trim();
}

function selectFetchedSource(topicDirectory, options) {
  const fetchedDirectory = path.join(topicDirectory, "fetched");

  if (!fs.existsSync(fetchedDirectory)) {
    throw new Error("Dossier fetched/ absent.");
  }

  if (options.selectedFile) {
    const selectedPath = path.join(fetchedDirectory, options.selectedFile);

    if (!fs.existsSync(selectedPath) || !fs.statSync(selectedPath).isFile()) {
      throw new Error(`Source récupérée introuvable : ${options.selectedFile}`);
    }

    return selectedPath;
  }

  const selectedSourcePath = path.join(topicDirectory, "selected-source.md");

  if (!fs.existsSync(selectedSourcePath)) {
    throw new Error("selected-source.md absent.");
  }

  const selectedUrl = readSelectedUrl(selectedSourcePath);
  const files = fs
    .readdirSync(fetchedDirectory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && path.extname(entry.name).toLowerCase() === ".md"
    );

  for (const file of files) {
    const candidatePath = path.join(fetchedDirectory, file.name);
    const candidate = extractMetadata(
      fs.readFileSync(candidatePath, "utf8"),
      file.name
    );

    if (candidate.url === selectedUrl) {
      return candidatePath;
    }
  }

  throw new Error("Aucun fichier fetched ne correspond à selected-source.md.");
}

function readQuery(topicDirectory, slug) {
  const sourcesPath = path.join(topicDirectory, "sources.md");

  if (fs.existsSync(sourcesPath)) {
    const content = fs.readFileSync(sourcesPath, "utf8");
    const match = content.match(/^- Requête\s*:\s*(.+)$/im);

    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }

  return slug.replace(/-/g, " ");
}

function readAdequacy(topicDirectory) {
  const reportPath = path.join(topicDirectory, "source-adequacy.md");

  if (!fs.existsSync(reportPath)) {
    throw new Error("source-adequacy.md absent.");
  }

  const report = fs.readFileSync(reportPath, "utf8");
  const profileMatch = report.match(
    /^- Profil détecté\s*:\s*`?(technical|recipe|historical|general)`?\s*$/m
  );
  const levelMatch = report.match(
    /^- Niveau\s*:\s*`?(adequate|partial|insufficient)`?\s*$/m
  );
  const missingSection = extractSection(
    report,
    "Informations importantes manquantes"
  );
  const missingInformation = missingSection
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s+(.+)$/))
    .filter(Boolean)
    .map((match) => match[1].trim())
    .filter(
      (item) =>
        !/^aucune information importante manquante/i.test(item)
    );

  if (!profileMatch || !levelMatch) {
    throw new Error("source-adequacy.md est incomplet.");
  }

  if (levelMatch[1] !== "adequate") {
    throw new Error(`Source finale non adequate : ${levelMatch[1]}.`);
  }

  return {
    profile: profileMatch[1],
    level: levelMatch[1],
    missingInformation,
  };
}

function buildExpectedDocument({
  query,
  topic,
  profile,
  source,
  localFile,
}) {
  return {
    schemaVersion: 1,
    query,
    topic,
    profile,
    sources: [
      {
        id: "source-1",
        url: source.url,
        title: source.title,
        localFile,
        adequacy: "adequate",
      },
    ],
  };
}

function buildSourceLines(sourceText) {
  const chunks = [];

  for (const rawLine of sourceText.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();

    if (!line) {
      continue;
    }

    const sentences = line.split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
      if (sentence.length <= 450) {
        chunks.push(sentence);
        continue;
      }

      for (let offset = 0; offset < sentence.length; offset += 400) {
        chunks.push(sentence.slice(offset, offset + 400).trim());
      }
    }
  }

  return chunks
    .filter(Boolean)
    .map((text, index) => ({ id: `L${index + 1}`, text }));
}

function selectRelevantSourceLines(sourceLines, profile, query, limit = 100) {
  const queryTerms = [
    ...new Set(
      query
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length >= 4)
    ),
  ];
  const profilePatterns = {
    recipe: [
      /\b(?:ingrédients?|ingredients?|préparation|preparation|cuisson|portions?|personnes?|four|repos)\b/i,
      /\b\d+(?:[.,]\d+)?\s*(?:g|kg|mg|ml|cl|l|minutes?|min|heures?|h|°\s*c|kcal|portions?|personnes?)\b|\b\d+\s+à\s+\d+\s+(?:portions?|personnes?)\b|\(\s*\d+\s*\)\s*:/i,
      /\b(?:ajouter|battre|cuire|enfourner|faire fondre|fouetter|incorporer|mélanger|melanger|préchauffer|prechauffer|remuer|verser)\b/i,
    ],
    technical: [
      /```|(?:^|\s)(?:git|npm|node|python|pip|docker|ollama|curl)\s+\S+/i,
      /\b(?:commande|configuration|installer|installation|paramètre|parametre|workflow|node|api|code|erreur)\b/i,
    ],
    historical: [
      /\b\d{3,4}\b|\bsiècle\b/i,
      /\b(?:contexte|guerre|révolution|revolution|règne|regne|traité|traite|bataille|empire|république|republique)\b/i,
    ],
    general: [],
  };
  const scored = sourceLines.map((line, index) => {
    const normalized = line.text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const queryScore = queryTerms.filter((term) =>
      normalized.includes(term)
    ).length;
    const profileScore = (profilePatterns[profile] || []).filter((pattern) =>
      pattern.test(line.text)
    ).length;

    return {
      index,
      score: queryScore * 2 + profileScore * 5,
    };
  });
  const selectedIndexes = new Set();

  for (const item of scored
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, Math.max(1, Math.floor(limit / 3)))) {
    selectedIndexes.add(item.index);
    if (item.index > 0) {
      selectedIndexes.add(item.index - 1);
    }
    if (item.index + 1 < sourceLines.length) {
      selectedIndexes.add(item.index + 1);
    }
  }

  if (selectedIndexes.size === 0) {
    return sourceLines.slice(0, limit);
  }

  return [...selectedIndexes]
    .sort((left, right) => left - right)
    .map((index) => sourceLines[index]);
}

function buildExtractionPrompt(expected, sourceLines, knownMissingInformation) {
  const profileInstructions = {
    recipe:
      "Ne t'arrête pas avant d'avoir extrait au minimum deux faits ingredient contenant chacun leur quantité, trois faits step correspondant à des actions culinaires distinctes, et deux faits quantity décrivant la durée, la température, la cuisson, le repos ou les portions.",
    technical:
      "Extrais au minimum un concept ou objectif et une procédure, commande ou exemple exact.",
    historical:
      "Extrais au minimum un fait de contexte, un fait date et un autre fait sur un acteur, lieu, événement ou conséquence.",
    general:
      "Extrais au minimum deux faits utiles parmi les définitions, faits, étapes, dates, quantités et avertissements.",
  };

  return `Tu extrais des faits depuis une source locale pour Knowledge Hub.

Retourne uniquement un objet JSON valide, sans Markdown ni commentaire.
La réponse intermédiaire doit respecter exactement ce contrat minimal :
{
  "facts": [
    {
      "type": "text",
      "content": "fait utile et autonome",
      "evidenceLineId": "L123",
      "confidence": "high"
    }
  ],
  "missingInformation": [],
  "warnings": []
}

Règles :
- Utilise uniquement les lignes entre <source_lines> et </source_lines>.
- evidenceLineId doit être l'identifiant exact d'une ligne fournie.
- Les identifiants valides vont de L1 à L${sourceLines.length}.
- Le script remplacera evidenceLineId par le texte exact de cette ligne.
- Pour les faits autres que command et code, le script utilisera cette ligne exacte comme contenu final.
- Choisis pour chaque fait la ligne qui contient réellement ses mots et ses nombres ; ne réutilise pas la première ligne par défaut.
- Chaque fait doit répondre à la requête ou être nécessaire pour l'expliquer.
- N'invente rien et ne complète aucune information absente.
- N'écris jamais "À compléter" ou "À vérifier".
- Ne critique pas le SEO, le design, la mise en page ou le site.
- N'extrais pas les chemins internes, métadonnées de récupération, menus ou publicités.
- Le script ajoutera lui-même les identifiants fact-1, fact-2 et source-1.
- Les seuls types autorisés sont : text, command, code, date, quantity, ingredient, step, warning, definition.
- Les commandes doivent rester exactes.
- Un fait command doit commencer par un exécutable réel comme git, npm, node, python, docker, ollama ou curl ; un titre de page n'est jamais une commande.
- Les nombres, unités et dates doivent rester fidèles.
- ${profileInstructions[expected.profile]}
- Informations déjà signalées comme manquantes : ${
    knownMissingInformation.length > 0
      ? knownMissingInformation.join(" ; ")
      : "aucune"
  }.

<source_lines>
${sourceLines.map((line) => `${line.id}: ${line.text}`).join("\n")}
</source_lines>`;
}

function buildRepairPrompt({
  invalidResponse,
  validationError,
  extractionPrompt,
}) {
  return `La réponse JSON précédente est invalide.

Erreur de validation :
${validationError}

Corrige-la une seule fois en respectant toutes les règles et retourne uniquement le JSON valide.
Si le contenu d'un fait n'est pas soutenu par sa ligne evidenceLineId, choisis une ligne correcte et recopie les nombres de cette ligne sans les modifier.

Réponse invalide :
<invalid_response>
${invalidResponse}
</invalid_response>

Instructions et source originales :
<original_request>
${extractionPrompt}
</original_request>`;
}

function requestJson(method, pathname, body) {
  const url = new URL(pathname, OLLAMA_URL);
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const request = http.request(
      url,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (response) => {
        let responseBody = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(
              new Error(`Ollama a répondu avec le statut ${response.statusCode}.`)
            );
            return;
          }

          try {
            resolve(JSON.parse(responseBody));
          } catch {
            reject(new Error("Réponse HTTP Ollama non JSON."));
          }
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("Délai Ollama dépassé."));
    });
    request.on("error", reject);
    request.end(payload);
  });
}

function isTransientTransportError(error) {
  return ["ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT"].includes(
    error && error.code
  );
}

async function requestJsonWithRetry(method, pathname, body) {
  try {
    return await requestJson(method, pathname, body);
  } catch (error) {
    if (!isTransientTransportError(error)) {
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    return requestJson(method, pathname, body);
  }
}

function hydrateEvidence(document, sourceLines) {
  const evidenceById = new Map(
    sourceLines.map((line) => [line.id, line.text])
  );
  const invalidEvidence = [];
  const hydratedFacts = Array.isArray(document.facts)
    ? document.facts.map((fact, index) => {
        if (!fact || typeof fact !== "object") {
          return fact;
        }

        const evidence = evidenceById.get(fact.evidenceLineId);

        if (!evidence) {
          invalidEvidence.push(
            `facts[${index}]=${fact.evidenceLineId || "absent"}`
          );
        }

        return {
          id: `fact-${index + 1}`,
          type: fact.type,
          content: ["command", "code"].includes(fact.type)
            ? fact.content
            : evidence || "",
          sourceId: "source-1",
          evidence: evidence || "",
          confidence: fact.confidence,
        };
      })
    : document.facts;

  if (invalidEvidence.length > 0) {
    throw new FactsValidationError([
      `evidenceLineId inconnu ou absent (${invalidEvidence.join(", ")})`,
    ]);
  }

  return { ...document, facts: hydratedFacts };
}

function completeProfileFacts(document, sourceLines) {
  const facts =
    document.profile === "technical"
      ? (document.facts || []).filter(
          (fact) => !["command", "code"].includes(fact.type)
        )
      : [...(document.facts || [])];
  const existingKeys = new Set(
    facts.map((fact) => `${fact.type}\n${fact.evidence}`)
  );
  let addedCount = 0;

  function addFact(type, content, evidence) {
    const key = `${type}\n${evidence}`;

    if (!content || !evidence || existingKeys.has(key)) {
      return;
    }

    facts.push({
      id: "",
      type,
      content,
      sourceId: "source-1",
      evidence,
      confidence: "medium",
    });
    existingKeys.add(key);
    addedCount += 1;
  }

  if (document.profile === "recipe") {
    const ingredientPattern =
      /(?:\(\s*\d+(?:[.,]\d+)?(?:\s*(?:g|kg|mg|ml|cl|l|grammes?|kilogrammes?|millilitres?|centilitres?|litres?))?\s*\)\s*:|\b\d+(?:[.,]\d+)?\s*(?:g|kg|mg|ml|cl|l|grammes?|kilogrammes?|millilitres?|centilitres?|litres?)\b)/i;
    const stepPattern =
      /\b(?:ajout\w*|batt\w*|cui(?:re|sez|sons|sent)|enfourn\w*|fai(?:re|tes?)\s+fondre|fond\w*|fouett\w*|incorpor\w*|m[ée]lang\w*|pr[ée]chauff\w*|remu\w*|vers\w*)\b/i;
    const quantityPattern =
      /\b\d+(?:[.,]\d+)?\s*(?:minutes?|min|heures?|h|portions?|personnes?|°\s*c|kcal)\b|\b\d+\s+à\s+\d+\s+personnes?\b/i;

    for (const line of sourceLines) {
      if (ingredientPattern.test(line.text)) {
        addFact("ingredient", line.text, line.text);
      }
    }

    for (const line of sourceLines
      .filter(
        (item) =>
          !/^#{1,6}\s/.test(item.text) && stepPattern.test(item.text)
      )
      .slice(0, 12)) {
      addFact("step", line.text, line.text);
    }

    for (const line of sourceLines) {
      if (quantityPattern.test(line.text)) {
        addFact("quantity", line.text, line.text);
      }
    }
  } else if (document.profile === "technical") {
    for (const line of sourceLines) {
      const trimmed = line.text.trim();
      const commands = [];

      if (
        /^(?:git|npm|npx|node|python3?|pip|docker|ollama|curl)\s+(?!-\s)\S+/i.test(
          trimmed
        )
      ) {
        commands.push(trimmed);
      }

      for (const match of trimmed.matchAll(
        /`((?:git|npm|npx|node|python3?|pip|docker|ollama|curl)\s+[^`]+)`/gi
      )) {
        commands.push(match[1].trim());
      }

      for (const match of trimmed.matchAll(
        /\bgit\s+rebase\s+(--(?:continue|abort|skip|quit)|[A-Za-z0-9._~/<>{}-]+)/gi
      )) {
        commands.push(match[0].trim());
      }

      for (const command of commands) {
        addFact("command", command, line.text);
      }
    }
  } else if (document.profile === "historical") {
    for (const line of sourceLines) {
      if (
        /\b(?:\d{3,4}|[IVXLCDM]{2,}\s*e?\s+siècle|avant notre ère|après J[.-]?C[.]?)\b/i.test(
          line.text
        )
      ) {
        addFact("date", line.text, line.text);
      }
    }
  }

  const normalizedFacts = facts.map((fact, index) => ({
    ...fact,
    id: `fact-${index + 1}`,
  }));

  return {
    ...document,
    facts: normalizedFacts,
    warnings:
      addedCount > 0
        ? [
            ...(Array.isArray(document.warnings) ? document.warnings : []),
            "Des faits exacts ont été complétés par les règles locales du profil.",
          ]
        : document.warnings,
  };
}

function validateResponse(response, expected, sourceText, sourceLines) {
  const parsed = parseJsonResponse(response);
  const hydrated = hydrateEvidence(
    {
      ...parsed,
      schemaVersion: 1,
      query: expected.query,
      topic: expected.topic,
      profile: expected.profile,
      sources: expected.sources,
    },
    sourceLines
  );
  const completed = completeProfileFacts(hydrated, sourceLines);
  const validated = validateFactsDocument(completed, expected);

  validateEvidence(validated, { "source-1": sourceText });
  return validated;
}

async function extractFactsWithRepair({
  generate,
  prompt,
  expected,
  sourceText,
  sourceLines = buildSourceLines(sourceText),
  onAttempt = () => {},
}) {
  let response = await generate(prompt, 1);

  try {
    const document = validateResponse(
      response,
      expected,
      sourceText,
      sourceLines
    );
    onAttempt({ attempt: 1, success: true, error: "" });
    return { document, attempts: 1 };
  } catch (error) {
    const validationError =
      error instanceof Error ? error.message : "Erreur de validation inconnue.";

    onAttempt({ attempt: 1, success: false, error: validationError });
    response = await generate(
      buildRepairPrompt({
        invalidResponse: response,
        validationError,
        extractionPrompt: prompt,
      }),
      2
    );

    try {
      const document = validateResponse(
        response,
        expected,
        sourceText,
        sourceLines
      );
      onAttempt({ attempt: 2, success: true, error: "" });
      return { document, attempts: 2 };
    } catch (repairError) {
      const message =
        repairError instanceof Error
          ? repairError.message
          : "Erreur de correction inconnue.";

      onAttempt({ attempt: 2, success: false, error: message });
      throw new Error(`Extraction JSON rejetée après correction : ${message}`);
    }
  }
}

function writeLlmLog({ model, attempt, durationMs, success, error }) {
  const directory = path.join(PROJECT_ROOT, "logs", "llm");
  fs.mkdirSync(directory, { recursive: true });
  const logPath = uniqueLogPath(directory, "extract-facts-llm");
  const errorType = error
    ? error.startsWith("Contrat de faits invalide")
      ? "validation"
      : "transport_ou_format"
    : "aucune";
  const content = `# Appel IA local

- Date : ${new Date().toISOString()}
- Étape : extraction JSON des faits
- Provider : ollama
- Modèle : ${model}
- Tentative : ${attempt}
- Durée : ${(durationMs / 1000).toFixed(2)} s
- Statut : ${success ? "succès" : "erreur"}
- Type d'erreur : ${errorType}
- Erreur : ${error || "Aucune"}

Le prompt, la source et la réponse complète ne sont pas enregistrés.
`;

  fs.writeFileSync(logPath, content, "utf8");
}

function writeErrorLog(message, artifactPath) {
  const directory = path.join(PROJECT_ROOT, "logs", "errors");
  fs.mkdirSync(directory, { recursive: true });
  const logPath = uniqueLogPath(directory, "extract-facts-error");
  const content = `# Erreur d'extraction des faits

- Date : ${new Date().toISOString()}
- Étape : extraction JSON
- Type : validation ou appel Ollama
- Artefact concerné : \`${artifactPath}\`
- Erreur : ${message}
- Effet : aucun fichier de faits invalide n'a été écrit.
`;

  fs.writeFileSync(logPath, content, "utf8");
}

function writeRunLog(result) {
  const directory = path.join(PROJECT_ROOT, "logs", "runs");
  fs.mkdirSync(directory, { recursive: true });
  const logPath = uniqueLogPath(directory, "extract-facts-with-ollama");
  const content = `# Extraction structurée des faits

## Objectif du run

Extraire des faits JSON source-grounded depuis une source locale adéquate.

## Fichiers lus

- \`${result.sourceFile || "Non disponible"}\`
- \`${result.adequacyFile || "Non disponible"}\`

## Fichiers créés ou modifiés

- \`${result.outputFile || "Aucun"}\`

## Erreurs rencontrées

- ${result.error || "Aucune"}

## Décisions prises

- \`extracted-facts.json\` est la source de vérité dérivée.
- Une seule tentative de correction JSON est autorisée.
- \`notes.md\` n'est pas modifié.

## Commandes exécutées

- \`${result.command}\`

## Provider IA utilisé

- \`ollama\`

## Modèle utilisé

- \`${result.model}\`

## Résultat

- Statut : ${result.success ? "succès" : "erreur"}
- Tentatives : ${result.attempts}
`;

  fs.writeFileSync(logPath, content, "utf8");
}

async function main() {
  const result = {
    sourceFile: "",
    adequacyFile: "",
    outputFile: "",
    command: [process.execPath, ...process.argv.slice(1)].join(" "),
    model: process.env.OLLAMA_MODEL || DEFAULT_MODEL,
    attempts: 0,
    success: false,
    error: "",
  };

  try {
    const options = parseArguments(process.argv.slice(2));
    const topicDirectory = path.join(RESEARCH_ROOT, options.slug);
    const sourcePath = selectFetchedSource(topicDirectory, options);
    const sourceMarkdown = fs.readFileSync(sourcePath, "utf8");
    const source = extractMetadata(sourceMarkdown, path.basename(sourcePath));
    const adequacy = readAdequacy(topicDirectory);
    const query = readQuery(topicDirectory, options.slug);
    const localFile = toProjectPath(sourcePath);
    const expected = buildExpectedDocument({
      query,
      topic: options.topic,
      profile: adequacy.profile,
      source,
      localFile,
    });
    const allSourceLines = buildSourceLines(source.text);
    const sourceLines = selectRelevantSourceLines(
      allSourceLines,
      adequacy.profile,
      query
    );
    const prompt = buildExtractionPrompt(
      expected,
      sourceLines,
      adequacy.missingInformation
    );
    const outputPath = path.join(topicDirectory, "extracted-facts.json");
    const attempts = [];
    const extraction = await extractFactsWithRepair({
      prompt,
      expected,
      sourceText: source.text,
      sourceLines,
      async generate(generationPrompt, attempt) {
        const startedAt = Date.now();

        try {
          const response = await requestJsonWithRetry("POST", "/api/generate", {
            model: options.model,
            prompt: generationPrompt,
            format: buildFactsJsonSchema(
              sourceLines.map((line) => line.id)
            ),
            stream: false,
            think: false,
            options: {
              temperature: 0,
            },
          });

          if (
            !response ||
            typeof response.response !== "string" ||
            !response.response.trim()
          ) {
            throw new Error("Réponse Ollama vide.");
          }

          attempts.push({
            attempt,
            durationMs: Date.now() - startedAt,
            transportSuccess: true,
          });
          return response.response;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Erreur Ollama inconnue.";

          writeLlmLog({
            model: options.model,
            attempt,
            durationMs: Date.now() - startedAt,
            success: false,
            error: message,
          });
          throw error;
        }
      },
      onAttempt({ attempt, success, error }) {
        const metadata = attempts.find((item) => item.attempt === attempt);

        writeLlmLog({
          model: options.model,
          attempt,
          durationMs: metadata ? metadata.durationMs : 0,
          success,
          error,
        });
      },
    });

    atomicWriteFile(
      outputPath,
      `${JSON.stringify(extraction.document, null, 2)}\n`,
      { force: options.force }
    );

    result.sourceFile = localFile;
    result.adequacyFile = toProjectPath(
      path.join(topicDirectory, "source-adequacy.md")
    );
    result.outputFile = toProjectPath(outputPath);
    result.model = options.model;
    result.attempts = extraction.attempts;
    result.success = true;

    console.log(`Faits extraits : ${result.outputFile}`);
    console.log(`Profil : ${extraction.document.profile}`);
    console.log(`Faits validés : ${extraction.document.facts.length}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue.";
    const artifact =
      result.outputFile ||
      "data/raw/research/<slug>/extracted-facts.json";

    result.error = message;
    writeErrorLog(message, artifact);
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
  buildFactsJsonSchema,
  buildExpectedDocument,
  buildExtractionPrompt,
  buildSourceLines,
  extractFactsWithRepair,
  extractMetadata,
  completeProfileFacts,
  hydrateEvidence,
  main,
  parseArguments,
  selectRelevantSourceLines,
  validateResponse,
};

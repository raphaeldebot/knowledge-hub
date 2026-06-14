const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const {
  ALLOWED_TOPICS,
  cleanSourceText,
} = require("./research-mvp");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const OLLAMA_URL = "http://localhost:11434";
const DEFAULT_MODEL = "qwen2.5:7b";
const REQUEST_TIMEOUT_MS = 180_000;

const STOP_WORDS = new Set([
  "a",
  "afin",
  "au",
  "aux",
  "avec",
  "ce",
  "ces",
  "cette",
  "comment",
  "dans",
  "de",
  "des",
  "du",
  "en",
  "et",
  "faire",
  "il",
  "la",
  "le",
  "les",
  "leur",
  "leurs",
  "ma",
  "mes",
  "mon",
  "ne",
  "ou",
  "par",
  "pas",
  "pour",
  "quand",
  "que",
  "qui",
  "sa",
  "sans",
  "se",
  "ses",
  "son",
  "sur",
  "un",
  "une",
  "utiliser",
  "vos",
  "votre",
]);

const TOPIC_RULES = [
  {
    topic: "cuisine",
    keywords: [
      "recette",
      "cuisine",
      "gateau",
      "chocolat",
      "ingredient",
      "cuisson",
      "four",
      "beurre",
      "farine",
    ],
  },
  {
    topic: "development",
    keywords: [
      "git",
      "javascript",
      "typescript",
      "react",
      "next",
      "node",
      "code",
      "programmation",
      "developpement",
      "api",
      "terminal",
      "commande",
    ],
  },
  {
    topic: "linux",
    keywords: [
      "linux",
      "ubuntu",
      "arch",
      "debian",
      "bash",
      "shell",
      "systemd",
      "kernel",
    ],
  },
  {
    topic: "ai-image",
    keywords: [
      "comfyui",
      "stable diffusion",
      "lora",
      "controlnet",
      "prompt",
      "image ia",
    ],
  },
  {
    topic: "history",
    keywords: [
      "histoire",
      "historique",
      "siecle",
      "guerre",
      "royaume",
      "empire",
      "revolution",
    ],
  },
  {
    topic: "science",
    keywords: [
      "science",
      "physique",
      "chimie",
      "biologie",
      "astronomie",
      "experience",
    ],
  },
  {
    topic: "health",
    keywords: [
      "sante",
      "medical",
      "medicament",
      "symptome",
      "traitement",
      "douleur",
    ],
  },
];

function requestJson(pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);

    const request = http.request(
      new URL(pathname, OLLAMA_URL),
      {
        method: "POST",
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
          if ((response.statusCode || 0) < 200 || response.statusCode >= 300) {
            reject(
              new Error(
                `Ollama a répondu avec le statut ${response.statusCode}.`
              )
            );
            return;
          }

          try {
            resolve(JSON.parse(responseBody));
          } catch {
            reject(new Error("Ollama a renvoyé un JSON invalide."));
          }
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("Délai Ollama dépassé."));
    });

    request.on("error", (error) => {
      if (error.code === "ECONNREFUSED") {
        reject(
          new Error("Ollama ne répond pas sur http://localhost:11434.")
        );
        return;
      }

      reject(error);
    });

    request.write(payload);
    request.end();
  });
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeYaml(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, " ")
    .trim();
}

function escapeMarkdownLabel(value) {
  return String(value || "")
    .replace(/[\[\]]/g, "")
    .replace(/\r?\n/g, " ")
    .trim();
}

function cleanModelResponse(value) {
  let response = String(value || "")
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "")
    .replace(/\r\n/g, "\n")
    .trim();

  // Retire une fence qui entoure toute la réponse.
  const fullFence = response.match(
    /^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/i
  );

  if (fullFence) {
    response = fullFence[1].trim();
  }

  response = response
    .replace(/^```(?:markdown|md|text)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  // Ollama ne doit plus produire de frontmatter.
  // S'il en produit tout de même un, on le retire et on conserve le corps.
  response = response.replace(
    /^---\s*\n[\s\S]*?\n---\s*\n?/,
    ""
  );

  // Retire seulement une courte introduction évidente.
  response = response.replace(
    /^(?:voici|bien sûr|bien sur|d'accord|voici la note|voici une note)[^\n]*\n+/i,
    ""
  );

  // La source sera ajoutée localement pour éviter les URL inventées.
  response = response.replace(
    /\n#{2,3}\s+Sources?\s*\n[\s\S]*$/i,
    ""
  );

  return response.trim();
}

function extractKeywords(value) {
  const words = normalizeText(value)
    .split(/[^a-z0-9+#.-]+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => word.length >= 3)
    .filter((word) => !STOP_WORDS.has(word))
    .filter((word) => !/^\d+$/.test(word));

  return [...new Set(words)];
}

function chooseTopic(input) {
  const requestedTopic = String(input.requestedTopic || "").trim();

  if (requestedTopic && ALLOWED_TOPICS.has(requestedTopic)) {
    return requestedTopic;
  }

  const haystack = normalizeText(
    [
      input.query,
      input.sourceTitle,
      input.cleanedSource.slice(0, 4000),
    ].join("\n")
  );

  let bestTopic = "general";
  let bestScore = 0;

  for (const rule of TOPIC_RULES) {
    if (!ALLOWED_TOPICS.has(rule.topic)) {
      continue;
    }

    const score = rule.keywords.reduce(
      (total, keyword) =>
        total + (haystack.includes(normalizeText(keyword)) ? 1 : 0),
      0
    );

    if (score > bestScore) {
      bestTopic = rule.topic;
      bestScore = score;
    }
  }

  return ALLOWED_TOPICS.has(bestTopic) ? bestTopic : "general";
}

function chooseTags(input, topic) {
  const candidates = extractKeywords(
    `${input.query || ""} ${input.sourceTitle || ""}`
  );

  const tags = [];

  for (const candidate of candidates) {
    if (candidate === topic || candidate.length > 24) {
      continue;
    }

    tags.push(candidate);

    if (tags.length === 5) {
      break;
    }
  }

  if (tags.length < 2 && topic !== "general" && !tags.includes(topic)) {
    tags.push(topic);
  }

  if (tags.length < 2) {
    tags.push("guide");
  }

  return [...new Set(tags)].slice(0, 5);
}

function buildTitle(input) {
  const rawTitle =
    String(input.query || "").trim() ||
    String(input.sourceTitle || "").trim() ||
    "Nouvelle note";

  const title =
    rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

  return title
    .replace(/\bgit\b/gi, "Git")
    .replace(/\blinux\b/gi, "Linux")
    .replace(/\bcomfyui\b/gi, "ComfyUI")
    .trim();
}

function extractSignificantNumbers(value) {
  const matches =
    String(value || "").match(
      /\b\d+(?:[.,]\d+)?\s*(?:%|°\s*[cf]|mg|g|kg|ml|cl|l|mm|cm|km|secondes?|minutes?|heures?|jours?|personnes?)\b|\b(?:19|20)\d{2}\b/gi
    ) || [];

  return matches.map((match) =>
    normalizeText(match)
      .replace(",", ".")
      .replace(/\s+/g, "")
  );
}

function validateBody(body, input) {
  const cleanedBody = cleanModelResponse(body);
  const errors = [];

  if (cleanedBody.length < 120) {
    errors.push("Le corps Markdown est vide ou trop court.");
  }

  const placeholderMatches =
    cleanedBody.match(
      /à compléter|a completer|todo|lorem ipsum|contenu à venir/gi
    ) || [];

  if (placeholderMatches.length >= 2) {
    errors.push("Le corps contient trop de placeholders.");
  }

  const queryKeywords = extractKeywords(input.query).slice(0, 8);
  const normalizedBody = normalizeText(cleanedBody);

  const matchingKeywords = queryKeywords.filter((keyword) =>
    normalizedBody.includes(keyword)
  );

  if (queryKeywords.length > 0 && matchingKeywords.length === 0) {
    errors.push("Le corps ne semble pas répondre à la requête.");
  }

  const sourceForValidation = [
    input.sourceTitle,
    input.cleanedSource,
  ].join("\n");

  const sourceNumbers = new Set(
    extractSignificantNumbers(sourceForValidation)
  );

  const generatedNumbers = extractSignificantNumbers(cleanedBody);
  const inventedNumbers = generatedNumbers.filter(
    (number) => !sourceNumbers.has(number)
  );

  if (inventedNumbers.length > 0) {
  console.warn(
    `Avertissement : nombres non retrouvés exactement dans la source : ${[
      ...new Set(inventedNumbers),
    ].join(", ")}`
  );
  }

  return {
    valid: errors.length === 0,
    errors,
    body: cleanedBody,
  };
}

function buildPrompt(input) {
  return `Transforme la source suivante en une note Markdown claire, pratique et
utile répondant directement à la requête de l'utilisateur.

Règles :
- Utilise uniquement les informations présentes dans la source.
- N'invente aucun fait, nombre, date, quantité, ingrédient, commande ou lien.
- Ignore la navigation, les publicités, les appels commerciaux, les
  commentaires et le contenu manifestement hors sujet.
- Organise librement la note selon le sujet.
- Conserve exactement les commandes, nombres, dates, quantités et étapes utiles.
- Pour un sujet technique, conserve les commandes dans des blocs de code.
- Pour une recette, conserve les ingrédients, les quantités, la préparation et
  la cuisson présents dans la source.
- Ne produis aucun frontmatter YAML.
- Ne produis aucune section Source ou Sources.
- Ne mets pas toute la réponse dans un bloc de code.
- Ne produis aucun raisonnement, commentaire ou explication sur ta réponse.
- Ne mets pas de titre H1 : il sera ajouté automatiquement.
- Commence directement par le contenu de la note avec des sections Markdown.
- Ne crée aucune section vide.
- N'écris jamais "À compléter".

Requête originale :
${input.query}

Titre de la source :
${input.sourceTitle}

Contenu nettoyé de la source :
<source>
${input.cleanedSource}
</source>

Retourne uniquement le corps Markdown de la note.`;
}

function buildRepairPrompt(input, errors) {
  return `${buildPrompt(input)}

La tentative précédente était inutilisable pour les raisons suivantes :
${errors.map((error) => `- ${error}`).join("\n")}

Produis maintenant une note plus directe, suffisamment détaillée et strictement
fondée sur la source.

Retourne uniquement le corps Markdown de la note.`;
}

function buildFinalMarkdown(input, body) {
  const title = buildTitle(input);
  const topic = chooseTopic(input);
  const tags = chooseTags(input, topic);
  const updated =
    input.updated ||
    new Date().toISOString().slice(0, 10);

  let cleanedBody = cleanModelResponse(body);

  // Le titre H1 est ajouté localement.
  cleanedBody = cleanedBody.replace(
    /^\s*#\s+[^\n]+\n+/,
    ""
  );

  const sourceLabel = escapeMarkdownLabel(
    input.sourceTitle || input.sourceUrl
  );

  const sourceUrl = String(input.sourceUrl || "").trim();

  return `---
title: "${escapeYaml(title)}"
topic: "${escapeYaml(topic)}"
level: "beginner"
tags: ${JSON.stringify(tags)}
source_type: "web_saved"
source_id: "${escapeYaml(sourceUrl)}"
confidence: "medium"
status: "draft"
updated: "${escapeYaml(updated)}"
---

# ${title}

${cleanedBody}

## Source

- [${sourceLabel}](${sourceUrl})
`;
}

function validateFinalMarkdown(markdown, input) {
  const errors = [];
  const value = String(markdown || "").trim();

  if (!value.startsWith("---\n")) {
    errors.push("Le frontmatter local est absent.");
  }

  if (!/^title:\s*".+"/m.test(value)) {
    errors.push("Le titre local est absent.");
  }

  if (!/^topic:\s*".+"/m.test(value)) {
    errors.push("Le topic local est absent.");
  }

  if (!/^tags:\s*\[.+\]/m.test(value)) {
    errors.push("Les tags locaux sont absents.");
  }

  if (!value.includes(String(input.sourceUrl || ""))) {
    errors.push("L'URL exacte de la source est absente.");
  }

  const closingFrontmatter = value.indexOf("\n---\n", 4);
  const body =
    closingFrontmatter >= 0
      ? value.slice(closingFrontmatter + 5).trim()
      : "";

  if (body.length < 150) {
    errors.push("La fiche finale est trop courte.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function writeLlmLog({
  model,
  attempt,
  durationMs,
  success,
  error = "",
}) {
  const logsDirectory = path.join(
    PROJECT_ROOT,
    "logs",
    "llm"
  );

  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");

  const timestamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
    String(now.getMilliseconds()).padStart(3, "0"),
  ].join("-");

  const logPath = path.join(
    logsDirectory,
    `${timestamp}-generate-note-direct-mvp.md`
  );

  const content = `# Appel IA local MVP

- Date : ${now.toISOString()}
- Provider : ollama
- Modèle : ${model}
- Type de tâche : génération du corps Markdown
- Tentative : ${attempt}
- Durée approximative : ${(durationMs / 1000).toFixed(2)} s
- Succès : ${success ? "oui" : "non"}
- Erreur : ${error || "Aucune"}

Le prompt, la source et la réponse complète ne sont pas enregistrés.
`;

  fs.mkdirSync(logsDirectory, { recursive: true });
  fs.writeFileSync(logPath, content, "utf8");
}

async function callOllama(prompt, model, attempt) {
  const startedAt = Date.now();

  try {
    const result = await requestJson("/api/generate", {
      model,
      prompt,
      stream: false,
      think: false,
      options: {
        temperature: 0,
      },
    });

    const markdown = cleanModelResponse(
      result && result.response
    );

    writeLlmLog({
      model,
      attempt,
      durationMs: Date.now() - startedAt,
      success: Boolean(markdown),
      error: markdown ? "" : "Réponse vide.",
    });

    return markdown;
  } catch (error) {
    writeLlmLog({
      model,
      attempt,
      durationMs: Date.now() - startedAt,
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Erreur inconnue.",
    });

    throw error;
  }
}

async function generateNoteDirect(
  input,
  dependencies = {}
) {
  const model =
    dependencies.model ||
    process.env.OLLAMA_MODEL ||
    DEFAULT_MODEL;

  const callModel =
    dependencies.callModel || callOllama;

  const firstRaw = await callModel(
    buildPrompt(input),
    model,
    1
  );

  const firstValidation = validateBody(
    firstRaw,
    input
  );

  let body = firstValidation.body;

  // Un deuxième appel n'est autorisé que si le corps lui-même
  // est réellement inutilisable.
  if (!firstValidation.valid) {
    const repairedRaw = await callModel(
      buildRepairPrompt(input, firstValidation.errors),
      model,
      2
    );

    const repairedValidation = validateBody(
      repairedRaw,
      input
    );

    if (!repairedValidation.valid) {
      throw new Error(
        `Réparation Ollama rejetée : ${repairedValidation.errors.join(
          " | "
        )}`
      );
    }

    body = repairedValidation.body;
  }

  const markdown = buildFinalMarkdown(input, body);
  const finalValidation = validateFinalMarkdown(
    markdown,
    input
  );

  if (!finalValidation.valid) {
    throw new Error(
      `Fiche finale locale invalide : ${finalValidation.errors.join(
        " | "
      )}`
    );
  }

  return markdown;
}

async function main() {
  const [inputPath] = process.argv.slice(2);

  if (!inputPath) {
    throw new Error(
      "Usage : node scripts/mvp/generate-note-direct-with-ollama.js <input.json>"
    );
  }

  const absoluteInputPath = path.resolve(
    PROJECT_ROOT,
    inputPath
  );

  const input = JSON.parse(
    fs.readFileSync(absoluteInputPath, "utf8")
  );

  input.cleanedSource = cleanSourceText(
    input.cleanedSource
  );

  const markdown = await generateNoteDirect(input);

  process.stdout.write(`${markdown}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Erreur : ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildFinalMarkdown,
  buildPrompt,
  chooseTags,
  chooseTopic,
  cleanModelResponse,
  generateNoteDirect,
  validateBody,
  validateFinalMarkdown,
};


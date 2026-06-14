const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const {
  ALLOWED_TOPICS,
  canonicalizeMarkdown,
  cleanSourceText,
  validateGeneratedMarkdown,
} = require("./research-mvp");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const OLLAMA_URL = "http://localhost:11434";
const DEFAULT_MODEL = "qwen2.5:7b";
const REQUEST_TIMEOUT_MS = 180_000;

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
              new Error(`Ollama a répondu avec le statut ${response.statusCode}.`)
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
        reject(new Error("Ollama ne répond pas sur http://localhost:11434."));
        return;
      }

      reject(error);
    });
    request.write(payload);
    request.end();
  });
}

function cleanModelResponse(value) {
  let response = String(value || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/\r\n/g, "\n")
    .trim();
  const fencedBlocks = [
    ...response.matchAll(/```(?:markdown|md|yaml)?\s*\n([\s\S]*?)\n```/gi),
  ].map((match) => match[1].trim());
  const usefulFence = fencedBlocks.find(
    (block) =>
      /^---\s*$/m.test(block) &&
      /^title\s*:/im.test(block) &&
      /^topic\s*:/im.test(block)
  );

  if (usefulFence) {
    response = usefulFence;
  } else if (fencedBlocks.length > 0) {
    response = fencedBlocks[0];
  }

  const delimiters = [
    ...response.matchAll(/^---\s*$/gm),
  ].map((match) => match.index);
  let bestStart = -1;
  let bestScore = 0;

  for (let index = 0; index < delimiters.length - 1; index += 1) {
    const block = response.slice(delimiters[index], delimiters[index + 1]);
    const score = ["title", "topic", "source_id"].filter((key) =>
      new RegExp(`^${key}\\s*:`, "im").test(block)
    ).length;

    if (score > bestScore) {
      bestScore = score;
      bestStart = delimiters[index];
    }
  }

  if (bestStart >= 0) {
    response = response.slice(bestStart);
  }

  return response.replace(/\n```\s*$/i, "").trim();
}

function buildPrompt(input) {
  const requestedTopic = input.requestedTopic
    ? `Topic demandé par l'utilisateur : ${input.requestedTopic}`
    : "Choisis automatiquement le topic le plus adapté.";

  return `Crée directement une fiche Markdown utile pour Knowledge Hub.

Règles impératives :
- Utilise uniquement la source fournie. N'invente aucun fait, nombre, ingrédient, commande ou lien.
- Ignore navigation, publicité, nutrition hors sujet, commentaires et appels marketing.
- Réponds uniquement avec la fiche Markdown, sans bloc de code autour.
- Commence par un frontmatter YAML entre deux lignes ---.
- Utilise source_type: "web_saved", confidence: "medium" et status: "draft".
- Utilise exactement cette URL dans source_id et dans une section Sources : ${input.sourceUrl}
- Choisis un topic parmi : ${[...ALLOWED_TOPICS].join(", ")}.
- Produis entre deux et cinq tags simples.
- Ne crée aucune section vide et n'écris jamais "À compléter.".
- Adapte les sections au sujet.
- Pour une recette, conserve les ingrédients, quantités, étapes et cuisson, mais exclue les données nutritionnelles et le texte promotionnel.
- Pour un sujet technique, conserve les commandes exactement comme dans la source.
- La fiche doit répondre directement à la requête originale.

Frontmatter attendu :
---
title: "Titre utile"
topic: "topic"
level: "beginner"
tags: ["tag-1", "tag-2"]
source_type: "web_saved"
source_id: "${input.sourceUrl}"
confidence: "medium"
status: "draft"
updated: "${input.updated}"
---

Requête originale : ${input.query}
${requestedTopic}
Titre de la source : ${input.sourceTitle}
URL : ${input.sourceUrl}
Chemin local : ${input.sourcePath}

Contenu nettoyé de la source :
<source>
${input.cleanedSource}
</source>

Rappel final : commence exactement par le frontmatter YAML demandé, puis écris
la fiche. Ne place aucun texte, commentaire ou raisonnement avant la première
ligne ---.`;
}

function buildRepairPrompt(input, previousMarkdown, errors) {
  return `${buildPrompt(input)}

La première sortie était inutilisable pour ces raisons :
${errors.map((error) => `- ${error}`).join("\n")}

Corrige-la entièrement. Retourne une seule fiche Markdown complète et rien d'autre.

Première sortie :
<previous>
${previousMarkdown}
</previous>`;
}

function writeLlmLog({ model, attempt, durationMs, success, error = "" }) {
  const logsDirectory = path.join(PROJECT_ROOT, "logs", "llm");
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
- Type de tâche : génération directe d'une fiche Markdown
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
      options: {
        temperature: 0,
      },
    });
    const markdown = cleanModelResponse(result && result.response);

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
      error: error instanceof Error ? error.message : "Erreur inconnue.",
    });
    throw error;
  }
}

async function generateNoteDirect(input, dependencies = {}) {
  const model = dependencies.model || process.env.OLLAMA_MODEL || DEFAULT_MODEL;
  const callModel = dependencies.callModel || callOllama;
  const context = {
    query: input.query,
    sourceUrl: input.sourceUrl,
    cleanedSource: input.cleanedSource,
  };
  const first = await callModel(buildPrompt(input), model, 1);
  const firstValidation = validateGeneratedMarkdown(first, context);

  if (firstValidation.valid) {
    return first;
  }

  if (
    firstValidation.parsed.valid &&
    firstValidation.parsed.values.title &&
    firstValidation.parsed.body.length >= 120
  ) {
    const metadataRepair = canonicalizeMarkdown(first, {
      ...context,
      requestedTopic: input.requestedTopic,
      updated: input.updated,
    }).markdown;
    const metadataRepairValidation = validateGeneratedMarkdown(
      metadataRepair,
      context
    );

    if (metadataRepairValidation.valid) {
      return metadataRepair;
    }
  }

  if (!firstValidation.repairable) {
    throw new Error(
      `Sortie Ollama rejetée : ${firstValidation.errors.join(" | ")}`
    );
  }

  const repaired = await callModel(
    buildRepairPrompt(input, first, firstValidation.errors),
    model,
    2
  );
  const repairedValidation = validateGeneratedMarkdown(repaired, context);

  if (repairedValidation.valid) {
    return repaired;
  }

  if (
    repairedValidation.parsed.valid &&
    repairedValidation.parsed.values.title &&
    repairedValidation.parsed.body.length >= 120
  ) {
    const metadataRepair = canonicalizeMarkdown(repaired, {
      ...context,
      requestedTopic: input.requestedTopic,
      updated: input.updated,
    }).markdown;
    const metadataRepairValidation = validateGeneratedMarkdown(
      metadataRepair,
      context
    );

    if (metadataRepairValidation.valid) {
      return metadataRepair;
    }
  }

  if (!repairedValidation.valid) {
    throw new Error(
      `Réparation Ollama rejetée : ${repairedValidation.errors.join(" | ")}`
    );
  }
}

async function main() {
  const [inputPath] = process.argv.slice(2);

  if (!inputPath) {
    throw new Error(
      "Usage : node scripts/mvp/generate-note-direct-with-ollama.js <input.json>"
    );
  }

  const absoluteInputPath = path.resolve(PROJECT_ROOT, inputPath);
  const input = JSON.parse(fs.readFileSync(absoluteInputPath, "utf8"));

  input.cleanedSource = cleanSourceText(input.cleanedSource);
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
  buildPrompt,
  cleanModelResponse,
  generateNoteDirect,
};

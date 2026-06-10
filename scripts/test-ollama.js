const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const OLLAMA_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.2:3b";
const REQUEST_TIMEOUT_MS = 120_000;
const requestedModel = process.env.OLLAMA_MODEL || DEFAULT_MODEL;

const runResult = {
  endpoint: OLLAMA_URL,
  requestedModel,
  availableModels: [],
  result: "Erreur",
  errors: [],
};

// Produit le format demandé pour le nom du fichier de log.
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

// Ajoute -2, -3, etc. si un log portant ce nom existe déjà.
function getUniqueLogPath(logsDirectory, timestamp) {
  const baseName = `${timestamp}-test-ollama`;
  let logPath = path.join(logsDirectory, `${baseName}.md`);
  let suffix = 2;

  while (fs.existsSync(logPath)) {
    logPath = path.join(logsDirectory, `${baseName}-${suffix}.md`);
    suffix += 1;
  }

  return logPath;
}

// Envoie une requête uniquement vers l'API Ollama locale.
function request(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const url = new URL(pathname, OLLAMA_URL);

    const req = http.request(
      url,
      {
        method,
        headers: payload
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(payload),
            }
          : undefined,
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let responseBody = "";

        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          const statusCode = res.statusCode || 0;

          if (statusCode < 200 || statusCode >= 300) {
            reject(
              new Error(
                `Erreur HTTP ${statusCode} pour ${method} ${pathname}.`
              )
            );
            return;
          }

          resolve(responseBody);
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(
        new Error(`Délai dépassé pour ${method} ${pathname}.`)
      );
    });

    req.on("error", (error) => {
      if (error.code === "ECONNREFUSED") {
        reject(
          new Error(
            "Ollama ne répond pas sur le port 11434. Vérifie qu'Ollama est lancé."
          )
        );
        return;
      }

      reject(error);
    });

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

async function requestJson(method, pathname, body) {
  const responseBody = await request(method, pathname, body);

  try {
    return JSON.parse(responseBody);
  } catch {
    throw new Error(`Réponse JSON invalide pour ${method} ${pathname}.`);
  }
}

// Écrit un résumé sans prompt complet ni donnée privée.
function writeRunLog() {
  const projectRoot = path.resolve(__dirname, "..");
  const logsDirectory = path.join(projectRoot, "logs", "runs");
  const timestamp = formatTimestamp(new Date());
  const logPath = getUniqueLogPath(logsDirectory, timestamp);
  const availableModels =
    runResult.availableModels.length > 0
      ? runResult.availableModels.map((model) => `- \`${model}\``).join("\n")
      : "- Aucun modèle disponible ou liste non récupérée";
  const errors =
    runResult.errors.length > 0
      ? runResult.errors.map((error) => `- ${error}`).join("\n")
      : "- Aucune";

  const logContent = `# Test local Ollama

## Objectif du run

Vérifier que Knowledge Hub peut communiquer avec l'API locale Ollama.

## Endpoints testés

- \`${runResult.endpoint}/\`
- \`${runResult.endpoint}/api/tags\`
- \`${runResult.endpoint}/api/generate\`

## Modèle demandé

\`${runResult.requestedModel}\`

## Modèles disponibles

${availableModels}

## Résultat

${runResult.result}

## Erreurs rencontrées

${errors}

## Commandes exécutées

- \`node scripts/test-ollama.js\`
- Avec un autre modèle : \`OLLAMA_MODEL=nom-du-modèle node scripts/test-ollama.js\`

## Provider IA utilisé

- Provider : \`ollama\`
- Modèle : \`${runResult.requestedModel}\`
`;

  fs.mkdirSync(logsDirectory, { recursive: true });
  fs.writeFileSync(logPath, logContent, "utf8");
  console.log(`Log créé : ${path.relative(projectRoot, logPath)}`);
}

async function main() {
  try {
    console.log(`Test de l'API Ollama : ${OLLAMA_URL}`);
    await request("GET", "/");
    console.log("Ollama répond.");

    const tags = await requestJson("GET", "/api/tags");

    if (!tags || !Array.isArray(tags.models)) {
      throw new Error("Réponse invalide : la liste des modèles est absente.");
    }

    runResult.availableModels = tags.models
      .map((model) => model && model.name)
      .filter((name) => typeof name === "string");

    console.log(
      `Modèles disponibles : ${
        runResult.availableModels.join(", ") || "aucun"
      }`
    );
    console.log(`Modèle demandé : ${requestedModel}`);

    if (!runResult.availableModels.includes(requestedModel)) {
      throw new Error(
        `Modèle non trouvé. Lance d'abord : ollama run ${requestedModel}`
      );
    }

    console.log(`Modèle utilisé : ${requestedModel}`);

    const generation = await requestJson("POST", "/api/generate", {
      model: requestedModel,
      prompt: "Réponds uniquement avec le mot OK.",
      stream: false,
    });

    if (
      !generation ||
      typeof generation.response !== "string" ||
      generation.response.trim() === ""
    ) {
      throw new Error(
        "Réponse invalide : le texte généré par Ollama est absent."
      );
    }

    console.log(`Réponse reçue : ${generation.response.trim()}`);
    console.log("Succès : la communication locale avec Ollama fonctionne.");
    runResult.result = "Succès";
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue.";

    runResult.errors.push(message);
    runResult.result = "Erreur";
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

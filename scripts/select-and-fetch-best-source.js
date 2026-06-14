const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");
const { atomicWriteFile } = require("./shared/atomic-file");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const RESEARCH_ROOT = path.join(PROJECT_ROOT, "data", "raw", "research");
const FETCH_SCRIPT = path.join(PROJECT_ROOT, "scripts", "fetch-source.js");
const ADEQUACY_SCRIPT = path.join(
  PROJECT_ROOT,
  "scripts",
  "check-source-adequacy.js"
);
const DEFAULT_MAX_ATTEMPTS = 5;
const MAX_ATTEMPTS = 10;

const DECISION_PRIORITY = {
  garder: 0,
  "garder mais verifier": 1,
};

const LEVEL_PRIORITY = {
  prioritaire: 0,
  utile: 1,
  secondaire: 2,
};

const TYPE_PRIORITY = {
  official_doc: 0,
  github: 1,
  tutorial: 2,
  blog: 3,
  forum: 4,
  video: 5,
  unknown: 6,
};

const GENERIC_QUERY_WORDS = new Set([
  "official",
  "documentation",
  "docs",
  "guide",
  "tutorial",
  "beginner",
  "learn",
  "how",
  "the",
  "a",
  "an",
  "and",
  "with",
  "for",
  "de",
  "la",
  "le",
  "les",
  "un",
  "une",
  "et",
  "pour",
]);

const runResult = {
  slug: "",
  reportFile: "",
  sourcesFile: "",
  query: "",
  analyzedCount: 0,
  admissibleCount: 0,
  selectedSource: null,
  selectionMode: "",
  fetchCommand: "",
  fetchResult: "Non exécuté",
  force: false,
  checkAdequacy: false,
  maxAttempts: DEFAULT_MAX_ATTEMPTS,
  attemptedCount: 0,
  attempts: [],
  adequacyLevel: "Non contrôlé",
  adequacyScore: null,
  finalMode: "",
  technicalErrors: [],
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

function getUniqueLogPath(logsDirectory, timestamp) {
  const baseName = `${timestamp}-select-and-fetch-best-source`;
  let logPath = path.join(logsDirectory, `${baseName}.md`);
  let suffix = 2;

  while (fs.existsSync(logPath)) {
    logPath = path.join(logsDirectory, `${baseName}-${suffix}.md`);
    suffix += 1;
  }

  return logPath;
}

function toProjectRelative(filePath) {
  return path.relative(PROJECT_ROOT, filePath).split(path.sep).join("/");
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Normalise les textes comparés pour reconnaître tirets, underscores et ponctuation.
function normalizeForRelevance(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeBackticks(value) {
  return String(value || "").replace(/^`|`$/g, "").trim();
}

function parseArguments(argumentsList) {
  let slug = "";
  let force = false;
  let checkAdequacy = true;
  let maxAttempts = DEFAULT_MAX_ATTEMPTS;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--force") {
      force = true;
      continue;
    }

    if (argument === "--check-adequacy") {
      checkAdequacy = true;
      continue;
    }

    if (argument === "--max-attempts") {
      const value = argumentsList[index + 1];
      const parsedValue = Number.parseInt(value, 10);

      if (
        !value ||
        value.startsWith("--") ||
        !Number.isInteger(parsedValue) ||
        parsedValue < 1 ||
        parsedValue > MAX_ATTEMPTS
      ) {
        throw new Error(
          `--max-attempts doit être un entier compris entre 1 et ${MAX_ATTEMPTS}.`
        );
      }

      maxAttempts = parsedValue;
      index += 1;
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(`Option inconnue : ${argument}`);
    }

    if (slug) {
      throw new Error("Un seul slug de dossier est accepté.");
    }

    slug = argument.trim();
  }

  if (!slug) {
    throw new Error(
      "Slug manquant. Exemple : node scripts/select-and-fetch-best-source.js comfyui-beginner-guide"
    );
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      "Slug invalide. Utilise uniquement des lettres minuscules, chiffres et tirets."
    );
  }

  return { slug, force, checkAdequacy, maxAttempts };
}

function findOriginalQuery(sourcesMarkdown, slug) {
  const queryMatches = sourcesMarkdown.matchAll(
    /^-\s*Requête\s*:\s*(.+)$/gim
  );

  for (const match of queryMatches) {
    const query = match[1].trim();

    if (query) {
      return query;
    }
  }

  return normalizeForRelevance(slug);
}

function buildQueryProfile(query) {
  const normalizedQuery = normalizeForRelevance(query);
  const queryWords = normalizedQuery.split(" ").filter(Boolean);
  const importantTerms = [
    ...new Set(queryWords.filter((word) => !GENERIC_QUERY_WORDS.has(word))),
  ];
  const importantWordSet = new Set(importantTerms);
  const phrases = [];

  // Les expressions contiguës de trois mots, comme "text to image",
  // apportent un signal plus précis que la présence de mots isolés.
  for (const phraseLength of [3, 2]) {
    for (
      let index = 0;
      index <= queryWords.length - phraseLength;
      index += 1
    ) {
      const phraseWords = queryWords.slice(index, index + phraseLength);

      if (phraseWords.every((word) => importantWordSet.has(word))) {
        phrases.push(phraseWords.join(" "));
      }
    }
  }

  return {
    importantTerms,
    phrases: [...new Set(phrases)],
  };
}

function countPresentTerms(terms, text) {
  const textWords = new Set(text.split(" ").filter(Boolean));

  return terms.filter((term) => textWords.has(term)).length;
}

function getPhraseScore(phrases, text, fullScore) {
  const matchedPhrase = phrases.find((phrase) => text.includes(phrase));

  if (!matchedPhrase) {
    return 0;
  }

  return matchedPhrase.split(" ").length >= 3
    ? fullScore
    : Math.round(fullScore * 0.6);
}

function calculateRelevance(source, queryProfile) {
  const titleText = normalizeForRelevance(source.title);
  let pathText = "";

  try {
    pathText = normalizeForRelevance(
      decodeURIComponent(source.parsedUrl.pathname)
    );
  } catch {
    pathText = normalizeForRelevance(source.parsedUrl.pathname);
  }

  const terms = queryProfile.importantTerms;

  if (terms.length === 0) {
    return 0;
  }

  const titleMatches = countPresentTerms(terms, titleText);
  const pathMatches = countPresentTerms(terms, pathText);
  const combinedMatches = new Set([
    ...terms.filter((term) => titleText.split(" ").includes(term)),
    ...terms.filter((term) => pathText.split(" ").includes(term)),
  ]).size;
  const titleCoverage = titleMatches / terms.length;
  const pathCoverage = pathMatches / terms.length;
  const globalCoverage = combinedMatches / terms.length;
  const score =
    getPhraseScore(queryProfile.phrases, titleText, 25) +
    getPhraseScore(queryProfile.phrases, pathText, 30) +
    titleCoverage * 20 +
    pathCoverage * 15 +
    globalCoverage * 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getRelevanceLevel(score) {
  if (score >= 70) {
    return "forte";
  }

  if (score >= 40) {
    return "moyenne";
  }

  return "faible";
}

function getRelevanceWarning(level) {
  const warnings = {
    forte: "La source semble directement liée à la requête.",
    moyenne:
      "La source semble partiellement liée à la requête. Le contenu devra être contrôlé après récupération.",
    faible:
      "La source est la meilleure candidate disponible, mais elle semble trop générale ou peu liée à la requête. Son contenu doit être vérifié avant génération d'une fiche.",
  };

  return warnings[level];
}

function extractField(block, fieldName) {
  const escapedName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(
    new RegExp(`^-\\s*${escapedName}\\s*:\\s*(.*)$`, "im")
  );

  return match ? removeBackticks(match[1]) : "";
}

// Lit les blocs créés par validate-sources.js dans toutes les catégories.
function parseValidatedSources(markdown) {
  const sources = [];
  const blockPattern =
    /^### (?!Option\b)(.+)\r?\n([\s\S]*?)(?=^###\s+|^##\s+|(?![\s\S]))/gm;
  let match;

  while ((match = blockPattern.exec(markdown)) !== null) {
    const body = match[2];
    const scoreText = extractField(body, "Score de fiabilité");
    const scoreMatch = scoreText.match(/^(\d{1,3})(?:\s*\/\s*100)?$/);
    const url = extractField(body, "URL");
    const type = extractField(body, "Type estimé");
    const level = extractField(body, "Niveau recommandé");
    const decision = extractField(body, "Décision recommandée");

    // Les autres titres H3 du rapport ne sont pas des blocs de source.
    if (!url && !scoreText && !type && !level && !decision) {
      continue;
    }

    if (!scoreMatch || !type || !level || !decision) {
      throw new Error(
        `Rapport impossible à parser : champs incomplets pour "${match[1].trim()}".`
      );
    }

    const score = Number(scoreMatch[1]);

    if (score < 0 || score > 100) {
      throw new Error(
        `Rapport impossible à parser : score invalide pour "${match[1].trim()}".`
      );
    }

    sources.push({
      title: match[1].trim(),
      url,
      domain: extractField(body, "Domaine") || "indisponible",
      type,
      score,
      level,
      decision,
    });
  }

  return sources;
}

function getValidWebUrl(value) {
  try {
    const parsedUrl = new URL(value);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return null;
    }

    return parsedUrl;
  } catch {
    return null;
  }
}

function prepareAdmissibleSource(source, queryProfile) {
  const normalizedDecision = normalize(source.decision);
  const normalizedLevel = normalize(source.level);
  const normalizedType = normalize(source.type);
  const parsedUrl = getValidWebUrl(source.url);

  if (
    normalizedDecision === "ignorer" ||
    normalizedLevel === "a eviter" ||
    !parsedUrl
  ) {
    return null;
  }

  if (!(normalizedDecision in DECISION_PRIORITY)) {
    return null;
  }

  if (!(normalizedLevel in LEVEL_PRIORITY)) {
    return null;
  }

  const preparedSource = {
    ...source,
    parsedUrl,
    normalizedDecision,
    normalizedLevel,
    normalizedType:
      normalizedType in TYPE_PRIORITY ? normalizedType : "unknown",
  };
  const relevanceScore = calculateRelevance(preparedSource, queryProfile);

  return {
    ...preparedSource,
    relevanceScore,
    relevanceLevel: getRelevanceLevel(relevanceScore),
    finalScore: Math.round(relevanceScore * 0.65 + source.score * 0.35),
  };
}

function compareSources(left, right) {
  return (
    right.finalScore - left.finalScore ||
    right.relevanceScore - left.relevanceScore ||
    right.score - left.score ||
    DECISION_PRIORITY[left.normalizedDecision] -
      DECISION_PRIORITY[right.normalizedDecision] ||
    LEVEL_PRIORITY[left.normalizedLevel] -
      LEVEL_PRIORITY[right.normalizedLevel] ||
    TYPE_PRIORITY[left.normalizedType] -
      TYPE_PRIORITY[right.normalizedType] ||
    Number(right.parsedUrl.protocol === "https:") -
      Number(left.parsedUrl.protocol === "https:") ||
    left.title.localeCompare(right.title, "fr", { sensitivity: "base" })
  );
}

function getSelectionMode(score) {
  if (score >= 60) {
    return "normal";
  }

  if (score >= 40) {
    return "fallback_prudent";
  }

  return "fallback_faible";
}

function getWarning(selectionMode) {
  const warnings = {
    normal: "La source atteint le niveau de confiance recommandé.",
    fallback_prudent:
      "Aucune source n'atteint 60/100. La meilleure source disponible a été retenue avec prudence et doit être vérifiée.",
    fallback_faible:
      "Les sources trouvées ont une faible confiance. La meilleure candidate valide a été retenue uniquement pour poursuivre l'analyse. Ne pas considérer son contenu comme fiable sans recoupement.",
  };

  return warnings[selectionMode];
}

function safeInline(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function getAdequacyWarning(finalMode) {
  const warnings = {
    adequate:
      "La source contient suffisamment d'informations concrètes pour poursuivre automatiquement.",
  };

  return warnings[finalMode] || "";
}

function buildSelectedSourceMarkdown(
  source,
  selectionMode,
  query,
  adequacy = null
) {
  const adequacyDetails = adequacy
    ? `- Tentatives effectuées : ${adequacy.attemptedCount}
- Niveau d'adéquation : ${adequacy.level}
- Score d'adéquation : ${adequacy.score}/100
- Source adéquate trouvée : ${adequacy.level === "adequate" ? "oui" : "non"}
- Mode final : ${adequacy.finalMode}`
    : `- Tentatives effectuées : 1
- Niveau d'adéquation : non contrôlé
- Score d'adéquation : non disponible
- Source adéquate trouvée : non contrôlé
- Mode final : sélection simple`;
  const adequacyWarning = adequacy
    ? `\n${getAdequacyWarning(adequacy.finalMode)}`
    : "";

  return `# Source sélectionnée automatiquement

## Source

- Requête utilisée : ${safeInline(query)}
- Titre : ${safeInline(source.title)}
- URL : ${source.parsedUrl.toString()}
- Domaine : ${safeInline(source.domain)}
- Type estimé : ${safeInline(source.type)}
- Score de pertinence : ${source.relevanceScore}/100
- Niveau de pertinence : ${source.relevanceLevel}
- Score de fiabilité : ${source.score}/100
- Score final : ${source.finalScore}/100
- Niveau recommandé : ${safeInline(source.level)}
- Décision recommandée : ${safeInline(source.decision)}
- Mode de sélection : ${selectionMode}
${adequacyDetails}

## Raison de la sélection

Cette source possède le meilleur classement parmi les candidates admissibles selon les règles locales du Knowledge Hub.

## Avertissement

${getRelevanceWarning(source.relevanceLevel)}

${getWarning(selectionMode)}
${adequacyWarning}

## Validation

- Sélection automatique : oui
- Contenu réellement vérifié : oui, par contrôle heuristique d'adéquation
- Validation humaine finale : à faire
`;
}

function formatCommandArgument(value) {
  return JSON.stringify(String(value));
}

function extractFetchedUrl(markdown) {
  const match = markdown.match(/^- URL\s*:\s*(.+)$/m);

  return match ? match[1].trim() : "";
}

function findFetchedFileByUrl(topicDirectory, selectedUrl) {
  const fetchedDirectory = path.join(topicDirectory, "fetched");

  if (
    !fs.existsSync(fetchedDirectory) ||
    !fs.statSync(fetchedDirectory).isDirectory()
  ) {
    return null;
  }

  const entries = fs.readdirSync(fetchedDirectory, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    if (
      !entry.isFile() ||
      path.extname(entry.name).toLowerCase() !== ".md"
    ) {
      continue;
    }

    const fetchedPath = path.join(fetchedDirectory, entry.name);
    const content = fs.readFileSync(fetchedPath, "utf8");

    if (extractFetchedUrl(content) === selectedUrl) {
      return {
        path: fetchedPath,
        filename: entry.name,
      };
    }
  }

  return null;
}

function runFetch(slug, topicDirectory, selectedUrl, force) {
  const existingFile = findFetchedFileByUrl(topicDirectory, selectedUrl);

  if (existingFile && !force) {
    return {
      result: "Succès (fichier local réutilisé)",
      fetchedFile: existingFile,
    };
  }

  const fetchArguments = [FETCH_SCRIPT, slug, selectedUrl];

  if (force) {
    fetchArguments.push("--force");
  }

  const fetchCommand = [
    "node",
    "scripts/fetch-source.js",
    formatCommandArgument(slug),
    formatCommandArgument(selectedUrl),
    ...(force ? ["--force"] : []),
  ].join(" ");

  const fetch = childProcess.spawnSync(process.execPath, fetchArguments, {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    shell: false,
  });

  if (fetch.stdout) {
    process.stdout.write(fetch.stdout);
  }

  if (fetch.stderr) {
    process.stderr.write(fetch.stderr);
  }

  if (fetch.error) {
    throw new Error(`Impossible de lancer fetch-source.js : ${fetch.error.message}`);
  }

  if (fetch.status !== 0) {
    throw new Error(
      `fetch-source.js a échoué avec le code ${fetch.status}.`
    );
  }

  const fetchedFile = findFetchedFileByUrl(topicDirectory, selectedUrl);

  if (!fetchedFile) {
    throw new Error(
      "Le fetch a réussi, mais aucun fichier local correspondant à l'URL n'a été trouvé."
    );
  }

  return {
    result: "Succès",
    command: fetchCommand,
    fetchedFile,
  };
}

function parseAdequacyReport(reportContent) {
  const scoreMatch = reportContent.match(
    /^- Score d'adéquation\s*:\s*(\d{1,3})\/100$/m
  );
  const levelMatch = reportContent.match(
    /^- Niveau\s*:\s*`?(adequate|partial|insufficient)`?\s*$/m
  );

  if (!scoreMatch || !levelMatch) {
    throw new Error("Le rapport source-adequacy.md est impossible à parser.");
  }

  return {
    score: Number(scoreMatch[1]),
    level: levelMatch[1],
  };
}

function runAdequacyCheck(slug, topicDirectory, filename) {
  const argumentsList = [
    ADEQUACY_SCRIPT,
    slug,
    "--file",
    filename,
  ];
  const check = childProcess.spawnSync(process.execPath, argumentsList, {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    shell: false,
  });

  if (check.stdout) {
    process.stdout.write(check.stdout);
  }

  if (check.stderr) {
    process.stderr.write(check.stderr);
  }

  if (check.error) {
    throw new Error(
      `Impossible de lancer check-source-adequacy.js : ${check.error.message}`
    );
  }

  if (![0, 2, 3].includes(check.status)) {
    throw new Error(
      `check-source-adequacy.js a rencontré une erreur technique (code ${check.status === null ? 1 : check.status}).`
    );
  }

  const adequacyReportPath = path.join(
    topicDirectory,
    "source-adequacy.md"
  );

  if (!fs.existsSync(adequacyReportPath)) {
    throw new Error("Le rapport source-adequacy.md n'a pas été créé.");
  }

  const result = parseAdequacyReport(
    fs.readFileSync(adequacyReportPath, "utf8")
  );

  return {
    ...result,
    exitCode: check.status,
  };
}

function selectWithAdequacy({
  options,
  topicDirectory,
  selectedSourcePath,
  admissibleSources,
  query,
  runFetchFn = runFetch,
  runAdequacyCheckFn = runAdequacyCheck,
}) {
  runResult.attempts = [];
  runResult.technicalErrors = [];
  runResult.attemptedCount = 0;
  const candidates = admissibleSources.slice(0, options.maxAttempts);
  let selectedAttempt = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const source = candidates[index];
    const attempt = {
      number: index + 1,
      source,
      fetchResult: "Non exécuté",
      checkCode: null,
      adequacyLevel: "fetch_error",
      adequacyScore: null,
      fetchedFile: null,
      technicalError: "",
    };

    console.log(`\nTentative ${attempt.number}/${candidates.length}`);
    console.log(`Titre : ${source.title}`);
    console.log(`URL : ${source.parsedUrl.toString()}`);

    try {
      const fetchResult = runFetchFn(
        options.slug,
        topicDirectory,
        source.parsedUrl.toString(),
        options.force
      );

      attempt.fetchResult = fetchResult.result;
      attempt.fetchedFile = fetchResult.fetchedFile;
      runResult.fetchCommand =
        fetchResult.command || "Fichier local réutilisé";
      console.log(`Fetch : succès`);
    } catch (error) {
      attempt.fetchResult = "Échec";
      attempt.adequacyLevel = "fetch_error";
      attempt.technicalError =
        error instanceof Error ? error.message : "Erreur de fetch inconnue.";
      runResult.technicalErrors.push(
        `${source.title} : ${attempt.technicalError}`
      );
      runResult.attempts.push(attempt);
      console.log("Fetch : échec");
      console.log("Adéquation : erreur");
      console.log("Score : non disponible");
      continue;
    }

    try {
      const adequacy = runAdequacyCheckFn(
        options.slug,
        topicDirectory,
        attempt.fetchedFile.filename
      );

      attempt.checkCode = adequacy.exitCode;
      attempt.adequacyLevel = adequacy.level;
      attempt.adequacyScore = adequacy.score;
      console.log(`Adéquation : ${adequacy.level}`);
      console.log(`Score : ${adequacy.score}/100`);
    } catch (error) {
      attempt.checkCode = 1;
      attempt.adequacyLevel = "fetch_error";
      attempt.technicalError =
        error instanceof Error
          ? error.message
          : "Erreur de contrôle inconnue.";
      runResult.technicalErrors.push(
        `${source.title} : ${attempt.technicalError}`
      );
      runResult.attempts.push(attempt);
      console.log("Adéquation : erreur");
      console.log("Score : non disponible");
      continue;
    }

    runResult.attempts.push(attempt);

    if (attempt.adequacyLevel === "adequate") {
      selectedAttempt = attempt;
      break;
    }
  }

  runResult.attemptedCount = runResult.attempts.length;

  if (!selectedAttempt) {
    throw new Error(
      "Aucune source adéquate n'a été trouvée. Les sources partielles ou insuffisantes ne sont pas acceptées pour la génération."
    );
  }

  const finalMode = "adequate";

  atomicWriteFile(
    selectedSourcePath,
    buildSelectedSourceMarkdown(
      selectedAttempt.source,
      getSelectionMode(selectedAttempt.source.finalScore),
      query,
      {
        attemptedCount: runResult.attemptedCount,
        level: selectedAttempt.adequacyLevel,
        score: selectedAttempt.adequacyScore,
        finalMode,
      }
    ),
    { force: true }
  );

  return {
    selectedAttempt,
    finalMode,
  };
}

function writeRunLog() {
  const logsDirectory = path.join(PROJECT_ROOT, "logs", "runs");
  const timestamp = formatTimestamp(new Date());
  const logPath = getUniqueLogPath(logsDirectory, timestamp);
  const selectedSource = runResult.selectedSource;
  const errors =
    runResult.errors.length > 0
      ? runResult.errors.map((error) => `- ${error}`).join("\n")
      : "- Aucune";
  const technicalErrors =
    runResult.technicalErrors.length > 0
      ? runResult.technicalErrors.map((error) => `- ${error}`).join("\n")
      : "- Aucune";
  const attempts =
    runResult.attempts.length > 0
      ? runResult.attempts
          .map(
            (attempt) => `### Tentative ${attempt.number}

- Titre : ${attempt.source.title}
- URL : ${attempt.source.parsedUrl.toString()}
- Résultat du fetch : ${attempt.fetchResult}
- Code du contrôle : ${attempt.checkCode === null ? "Non disponible" : attempt.checkCode}
- Niveau d'adéquation : ${attempt.adequacyLevel}
- Score d'adéquation : ${attempt.adequacyScore === null ? "Non disponible" : `${attempt.adequacyScore}/100`}`
          )
          .join("\n\n")
      : "- Aucune tentative détaillée";

  const logContent = `# Sélection et récupération de la meilleure source

## Slug

\`${runResult.slug || "Non défini"}\`

## Rapport lu

\`${runResult.reportFile || "Non lu"}\`

## Requête utilisée

${runResult.query || "Non définie"}

## Sources analysées

${runResult.analyzedCount}

## Candidates admissibles

${runResult.admissibleCount}

## Contrôle d'adéquation activé

${runResult.checkAdequacy ? "oui" : "non"}

## Nombre maximal de tentatives

${runResult.maxAttempts}

## Nombre de sources essayées

${runResult.attemptedCount}

## Tentatives

${attempts}

## Source choisie

${selectedSource ? `${selectedSource.title} — ${selectedSource.parsedUrl.toString()}` : "Aucune"}

## Pertinence

${selectedSource ? `${selectedSource.relevanceScore}/100` : "Non disponible"}

## Fiabilité

${selectedSource ? `${selectedSource.score}/100` : "Non disponible"}

## Score final

${selectedSource ? `${selectedSource.finalScore}/100` : "Non disponible"}

## Niveau de pertinence

\`${selectedSource ? selectedSource.relevanceLevel : "Non défini"}\`

## Type

${selectedSource ? `\`${selectedSource.type}\`` : "Non disponible"}

## Décision

${selectedSource ? `\`${selectedSource.decision}\`` : "Non disponible"}

## Mode de sélection

\`${runResult.selectionMode || "Non défini"}\`

## Niveau d'adéquation final

\`${runResult.adequacyLevel}\`

## Score d'adéquation final

${runResult.adequacyScore === null ? "Non disponible" : `${runResult.adequacyScore}/100`}

## Mode final

\`${runResult.finalMode || "Non défini"}\`

## Commande de fetch exécutée

\`${runResult.fetchCommand || "Aucune"}\`

## Résultat du fetch

${runResult.fetchResult}

## Force

${runResult.force ? "oui" : "non"}

## Erreurs

${errors}

## Erreurs techniques rencontrées

${technicalErrors}

## Confidentialité

- Le contenu complet de la page récupérée n'est pas enregistré dans ce log.
`;

  fs.mkdirSync(logsDirectory, { recursive: true });
  fs.writeFileSync(logPath, logContent, "utf8");
  console.log(`Log créé : ${toProjectRelative(logPath)}`);
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const topicDirectory = path.join(RESEARCH_ROOT, options.slug);
    const reportPath = path.join(topicDirectory, "source-validation.md");
    const sourcesPath = path.join(topicDirectory, "sources.md");
    const selectedSourcePath = path.join(
      topicDirectory,
      "selected-source.md"
    );

    runResult.slug = options.slug;
    runResult.force = options.force;
    runResult.checkAdequacy = options.checkAdequacy;
    runResult.maxAttempts = options.maxAttempts;
    runResult.reportFile = toProjectRelative(reportPath);
    runResult.sourcesFile = toProjectRelative(sourcesPath);

    if (!fs.existsSync(topicDirectory)) {
      throw new Error(
        `Dossier de recherche absent : ${toProjectRelative(topicDirectory)}`
      );
    }

    if (!fs.statSync(topicDirectory).isDirectory()) {
      throw new Error("Le chemin du sujet ne désigne pas un dossier.");
    }

    if (!fs.existsSync(reportPath)) {
      throw new Error(`Rapport absent : ${runResult.reportFile}`);
    }

    if (!fs.statSync(reportPath).isFile()) {
      throw new Error("Le chemin source-validation.md ne désigne pas un fichier.");
    }

    if (!fs.existsSync(sourcesPath) || !fs.statSync(sourcesPath).isFile()) {
      throw new Error(`sources.md absent : ${runResult.sourcesFile}`);
    }

    const reportContent = fs.readFileSync(reportPath, "utf8");
    const sourcesContent = fs.readFileSync(sourcesPath, "utf8");
    const query = findOriginalQuery(sourcesContent, options.slug);
    const queryProfile = buildQueryProfile(query);
    const sources = parseValidatedSources(reportContent);

    runResult.query = query;

    if (sources.length === 0) {
      throw new Error("Aucune source présente dans le rapport de validation.");
    }

    runResult.analyzedCount = sources.length;

    const admissibleSources = sources
      .map((source) => prepareAdmissibleSource(source, queryProfile))
      .filter(Boolean)
      .sort(compareSources);

    runResult.admissibleCount = admissibleSources.length;

    if (admissibleSources.length === 0) {
      throw new Error(
        "Aucune source admissible avec une URL HTTP ou HTTPS valide."
      );
    }

    let selectedSource;
    let selectionMode;
    let warning;

    const adequacySelection = selectWithAdequacy({
      options,
      topicDirectory,
      selectedSourcePath,
      admissibleSources,
      query,
    });

    selectedSource = adequacySelection.selectedAttempt.source;
    selectionMode = getSelectionMode(selectedSource.finalScore);
    warning = getAdequacyWarning(adequacySelection.finalMode);
    runResult.selectedSource = selectedSource;
    runResult.selectionMode = selectionMode;
    runResult.adequacyLevel =
      adequacySelection.selectedAttempt.adequacyLevel;
    runResult.adequacyScore =
      adequacySelection.selectedAttempt.adequacyScore;
    runResult.finalMode = adequacySelection.finalMode;
    runResult.fetchResult =
      adequacySelection.selectedAttempt.fetchResult;

    console.log(`Slug : ${options.slug}`);
    console.log(`Sources analysées : ${runResult.analyzedCount}`);
    console.log(`Sources admissibles : ${runResult.admissibleCount}`);
    console.log(`Requête utilisée : ${query}`);
    console.log(`Titre sélectionné : ${selectedSource.title}`);
    console.log(`URL sélectionnée : ${selectedSource.parsedUrl.toString()}`);
    console.log(`Type : ${selectedSource.type}`);
    console.log(`Score de pertinence : ${selectedSource.relevanceScore}/100`);
    console.log(`Score de fiabilité : ${selectedSource.score}/100`);
    console.log(`Score final : ${selectedSource.finalScore}/100`);
    console.log(`Niveau de pertinence : ${selectedSource.relevanceLevel}`);
    console.log(`Mode de sélection : ${selectionMode}`);
    console.log(
      `Fichier sélection : ${toProjectRelative(selectedSourcePath)}`
    );
    console.log(
      `Avertissement : ${getRelevanceWarning(selectedSource.relevanceLevel)}`
    );
    console.log(`Sources essayées : ${runResult.attemptedCount}`);
    console.log(`Score d'adéquation : ${runResult.adequacyScore}/100`);
    console.log(`Niveau d'adéquation : ${runResult.adequacyLevel}`);
    console.log(`Mode final : ${runResult.finalMode}`);

    console.log(`Résultat du fetch : ${runResult.fetchResult}`);
    console.log(`Avertissement : ${warning}`);
    console.log(
      "Rappel : la sélection automatique ne remplace pas la validation humaine finale."
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

if (require.main === module) {
  main();
}

module.exports = {
  buildQueryProfile,
  parseAdequacyReport,
  parseValidatedSources,
  prepareAdmissibleSource,
  selectWithAdequacy,
};

const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const RESEARCH_ROOT = path.join(PROJECT_ROOT, "data", "raw", "research");

const EXIT_CODES = {
  adequate: 0,
  error: 1,
  partial: 2,
  insufficient: 3,
};

const runResult = {
  slug: "",
  query: "",
  analyzedFile: "",
  profile: "general",
  score: 0,
  level: "error",
  exitCode: EXIT_CODES.error,
  detectedCriteria: [],
  missingInformation: [],
  criticalCriteria: {},
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
  const baseName = `${timestamp}-check-source-adequacy`;
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

function parseArguments(argumentsList) {
  let slug = "";
  let selectedFile = "";

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--file") {
      const value = argumentsList[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error("Une valeur est requise après --file.");
      }

      selectedFile = value;
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
      "Slug manquant. Exemple : node scripts/check-source-adequacy.js recette-gateau-au-chocolat-moelleux"
    );
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      "Slug invalide. Utilise uniquement des lettres minuscules, chiffres et tirets."
    );
  }

  if (
    selectedFile &&
    (path.basename(selectedFile) !== selectedFile ||
      path.extname(selectedFile).toLowerCase() !== ".md")
  ) {
    throw new Error(
      "L'option --file doit contenir uniquement le nom d'un fichier Markdown."
    );
  }

  return { slug, selectedFile };
}

function readOptionalFile(filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/gi, "oe")
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSection(markdown, sectionTitle) {
  const lines = markdown.split(/\r?\n/);
  const normalizedTitle = normalize(sectionTitle);
  const headingIndex = lines.findIndex((line) => {
    const match = line.match(/^##\s+(.+)$/);

    return match && normalize(match[1]) === normalizedTitle;
  });

  if (headingIndex < 0) {
    return "";
  }

  const sectionLines = [];

  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      break;
    }

    sectionLines.push(lines[index]);
  }

  return sectionLines.join("\n").trim();
}

function extractMetadataUrl(markdown) {
  const metadata = extractSection(markdown, "Métadonnées");
  const match = metadata.match(/^- URL\s*:\s*(.+)$/m);

  return match ? match[1].trim() : "";
}

function extractSelectedUrl(selectedSourceContent) {
  const match = selectedSourceContent.match(/^- URL\s*:\s*(.+)$/m);

  if (!match || !match[1].trim()) {
    throw new Error("L'URL est absente de selected-source.md.");
  }

  return match[1].trim();
}

function selectFetchedFile(
  fetchedDirectory,
  selectedFile,
  selectedSourceContent
) {
  if (selectedFile) {
    const fetchedPath = path.join(fetchedDirectory, selectedFile);

    if (!fs.existsSync(fetchedPath) || !fs.statSync(fetchedPath).isFile()) {
      throw new Error(`Fichier fetched introuvable : ${selectedFile}`);
    }

    return fetchedPath;
  }

  if (!selectedSourceContent) {
    throw new Error(
      "selected-source.md est absent. Utilise --file ou sélectionne d'abord une source."
    );
  }

  const selectedUrl = extractSelectedUrl(selectedSourceContent);
  const markdownFiles = fs
    .readdirSync(fetchedDirectory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && path.extname(entry.name).toLowerCase() === ".md"
    );

  for (const entry of markdownFiles) {
    const fetchedPath = path.join(fetchedDirectory, entry.name);
    const content = fs.readFileSync(fetchedPath, "utf8");

    if (extractMetadataUrl(content) === selectedUrl) {
      return fetchedPath;
    }
  }

  throw new Error(
    "Aucun fichier récupéré ne correspond à la source sélectionnée."
  );
}

function findOriginalQuery(sourcesContent, researchPlanContent, slug) {
  const queryMatch = sourcesContent.match(/^- Requête\s*:\s*(.+)$/im);

  if (queryMatch && queryMatch[1].trim()) {
    return queryMatch[1].trim();
  }

  const planTitle = researchPlanContent.match(
    /^#\s+Plan de recherche\s*-\s*(.+)$/im
  );

  if (planTitle && planTitle[1].trim()) {
    return planTitle[1].trim();
  }

  return slug.replace(/-/g, " ");
}

function countMatches(content, patterns) {
  return patterns.filter((pattern) => pattern.test(content)).length;
}

function countActionWords(content, words) {
  const normalizedContent = normalize(content);

  return words.filter((word) =>
    new RegExp(`\\b${word}\\b`, "i").test(normalizedContent)
  ).length;
}

function countSteps(content) {
  const numberedSteps =
    content.match(/(?:^|\n)\s*\d+[.)]\s+\S+/g) || [];
  const bulletActions =
    content.match(
      /(?:^|\n)\s*[-*]\s+(?:ajouter|melanger|faire|placer|ouvrir|installer|configurer|cliquer|choisir|verser|cuire|enfourner|retirer|verifier)\b/gi
    ) || [];
  const headingSteps =
    content.match(/^#{2,6}\s+(?:étape|step)\s+\d+/gim) || [];

  return numberedSteps.length + bulletActions.length + headingSteps.length;
}

function calculateQueryRelevance(query, content) {
  const ignoredWords = new Set([
    "avec",
    "dans",
    "des",
    "une",
    "pour",
    "les",
    "the",
    "and",
    "guide",
    "documentation",
    "official",
  ]);
  const queryWords = normalize(query)
    .split(" ")
    .filter((word) => word.length >= 3 && !ignoredWords.has(word));

  if (queryWords.length === 0) {
    return 0;
  }

  const normalizedContent = normalize(content);
  const matchedWords = queryWords.filter((word) =>
    new RegExp(`\\b${word}\\b`).test(normalizedContent)
  );

  return matchedWords.length / queryWords.length;
}

function detectContentProfile(query, text) {
  const combinedContent = `${query}\n${text}`;
  const recipeSignals = [
    /\brecette\b/i,
    /\bg[âa]teau\b/i,
    /\bcuisine\b/i,
    /\bingr[ée]dients?\b/i,
    /\bpr[ée]paration\b/i,
    /\bcuisson\b/i,
    /\bgrammes?\b/i,
    /\bfarine\b/i,
    /\bbeurre\b/i,
    /\b[œo]ufs?\b/i,
    /\btemp[ée]rature\b/i,
    /\bfour\b/i,
  ];
  const technicalSignals = [
    /\bcode\b/i,
    /\bcommandes?\b/i,
    /\bapi\b/i,
    /\bgit\b/i,
    /\blinux\b/i,
    /\bjavascript\b/i,
    /\binstallation\b/i,
    /\bconfiguration\b/i,
    /\bterminal\b/i,
    /```/,
    /(?:^|\n)\s*(?:\$|>|PS>)\s+\S+/m,
    /\bgit\s+(?:rebase|commit|merge|checkout|switch|status)\b/i,
  ];
  const historicalSignals = [
    /\bhistoire\b/i,
    /\bhistorique\b/i,
    /\bchronologie\b/i,
    /\bsiècle\b/i,
    /\brévolution\b/i,
    /\bguerre\b/i,
    /\bempire\b/i,
    /\b\d{3,4}\b/,
  ];

  const recipeSignalCount = countMatches(combinedContent, recipeSignals);
  const queryClearlyRequestsRecipe =
    /\brecette\b/i.test(query) &&
    /\b(?:g[âa]teau|cuisine|préparation|cuisson|ingrédients?)\b/i.test(
      query
    );

  if (recipeSignalCount >= 3 || queryClearlyRequestsRecipe) {
    return "recipe";
  }

  if (countMatches(combinedContent, historicalSignals) >= 3) {
    return "historical";
  }

  if (countMatches(combinedContent, technicalSignals) >= 2) {
    return "technical";
  }

  return "general";
}

function addCriterion(result, condition, points, present, missing) {
  if (condition) {
    result.score += points;
    result.detectedCriteria.push(present);
  } else {
    result.missingInformation.push(missing);
  }
}

function assessRecipe(text, query) {
  const result = {
    score: 0,
    detectedCriteria: [],
    missingInformation: [],
  };
  const ingredientsSection =
    extractSection(text, "Ingrédients") ||
    extractSection(text, "Ingredients");
  const ingredientLines = ingredientsSection
    .split(/\r?\n/)
    .filter((line) => /^\s*[-*]\s+\S+/.test(line));
  const knownIngredients = countActionWords(text, [
    "beurre",
    "chocolat",
    "creme",
    "farine",
    "huile",
    "lait",
    "levure",
    "oeuf",
    "oeufs",
    "sel",
    "sucre",
    "vanille",
  ]);
  const ingredientCount = Math.max(ingredientLines.length, knownIngredients);
  const quantityPattern =
    /\b(?:\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+)\s*(?:g|kg|mg|ml|cl|l|grammes?|kilogrammes?|millilitres?|centilitres?|litres?|cuillères?|tasses?)\b/gi;
  const normalizedText = normalize(text);
  const ingredientWords = [
    "beurre",
    "chocolat",
    "creme",
    "farine",
    "huile",
    "lait",
    "levure",
    "oeuf",
    "oeufs",
    "sel",
    "sucre",
    "vanille",
  ];
  const measuredIngredientCount = [
    ...normalizedText.matchAll(quantityPattern),
  ].filter((match) => {
    const start = Math.max(0, match.index - 60);
    const end = Math.min(
      normalizedText.length,
      match.index + match[0].length + 60
    );
    const context = normalizedText.slice(start, end);

    return ingredientWords.some((ingredient) =>
      new RegExp(`\\b${ingredient}\\b`, "i").test(context)
    );
  }).length;
  const countedIngredients =
    normalizedText.match(
      /\b\d+\s+(?:oeufs?|pommes?|bananes?|citrons?|oranges?)\b/gi
    ) || [];
  const quantityIngredientCount =
    measuredIngredientCount + countedIngredients.length;
  const preparationSteps = countSteps(text);
  const culinaryActionCount = countActionWords(text, [
    "ajouter",
    "battre",
    "cuire",
    "enfourner",
    "fondre",
    "fouetter",
    "incorporer",
    "melanger",
    "prechauffer",
    "remuer",
    "verser",
  ]);
  const cookingInformation =
    /\b(?:cuisson|four|sans cuisson|repos)\b/i.test(text) ||
    /\b\d+(?:[.,]\d+)?\s*(?:min|minutes?|h|heures?|°\s*c|celsius)\b/i.test(
      text
    );
  const relevance = calculateQueryRelevance(query, text);
  const criticalCriteria = {
    ingredientListPresent:
      ingredientLines.length >= 3 || quantityIngredientCount >= 3,
    enoughIngredients:
      Math.max(ingredientCount, quantityIngredientCount) >= 3,
    quantitiesSufficient: quantityIngredientCount >= 2,
    culinaryStepsSufficient: culinaryActionCount >= 2,
    usableProcedure:
      preparationSteps >= 2 || culinaryActionCount >= 3,
    cookingInformationPresent: cookingInformation,
  };

  addCriterion(
    result,
    criticalCriteria.ingredientListPresent,
    20,
    "Une liste ou section d'ingrédients est présente.",
    "Aucune vraie liste d'ingrédients."
  );
  addCriterion(
    result,
    criticalCriteria.enoughIngredients,
    15,
    `Au moins trois ingrédients sont identifiables (${Math.max(
      ingredientCount,
      quantityIngredientCount
    )}).`,
    "Moins de trois ingrédients sont clairement identifiables."
  );
  addCriterion(
    result,
    criticalCriteria.quantitiesSufficient,
    20,
    `Au moins deux quantités liées à des ingrédients sont présentes (${quantityIngredientCount}).`,
    quantityIngredientCount === 0
      ? "Quantités absentes."
      : "Moins de deux quantités exploitables sont présentes."
  );
  addCriterion(
    result,
    criticalCriteria.usableProcedure,
    20,
    "Les étapes de préparation sont suffisamment concrètes.",
    "Étapes de préparation absentes ou trop vagues."
  );
  addCriterion(
    result,
    criticalCriteria.culinaryStepsSufficient,
    10,
    `Au moins deux actions culinaires sont détectées (${culinaryActionCount}).`,
    "Moins de deux actions culinaires sont détectées."
  );
  addCriterion(
    result,
    cookingInformation,
    10,
    "Une indication de cuisson, de repos ou d'absence de cuisson est présente.",
    "Temps, température ou indication de cuisson non précisés."
  );
  addCriterion(
    result,
    relevance >= 0.4 && text.length >= 500,
    5,
    "Le contenu est développé et lié à la requête.",
    "Le contenu semble trop court ou insuffisamment lié à la requête."
  );

  result.criticalCriteria = criticalCriteria;

  if (Object.values(criticalCriteria).some((present) => !present)) {
    result.score = Math.min(result.score, 39);
  }

  return result;
}

function assessTechnical(text, query) {
  const result = {
    score: 0,
    detectedCriteria: [],
    missingInformation: [],
  };
  const preciseConcepts = new Set(
    (text.match(
      /\b(?:API|Git|rebase|commit|branche|branch|conflit|conflict|Linux|Docker|Node\.js|JavaScript|TypeScript|Python|SQL|JSON|YAML|HTML|CSS|ComfyUI|workflow|node|nœud|model|modèle|prompt|sampler|checkpoint|VAE|configuration|paramètre|commande|fichier)\b/gi
    ) || []).map((value) => normalize(value))
  ).size;
  const concreteArtifacts =
    /```[\s\S]*?```/.test(text) ||
    /(?:^|\n)\s*(?:\$|>|PS>)\s+\S+/m.test(text) ||
    /\b[\w.-]+\.(?:js|ts|py|json|ya?ml|html?|css|sql|sh|ps1)\b/i.test(text) ||
    /\bgit\s+(?:rebase|status|add|commit|merge|checkout|switch)\b/i.test(text) ||
    /\b(?:KSampler|Load Checkpoint|CLIP Text Encode|Save Image|Empty Latent Image)\b/i.test(
      text
    );
  const stepCount = countSteps(text);
  const hasPrerequisites =
    /\b(?:prérequis|prerequis|avant de commencer|nécessite|requis|installer)\b/i.test(
      text
    );
  const relevance = calculateQueryRelevance(query, text);
  const looksGeneral =
    /\b(?:welcome|accueil|découvrez nos produits|explore documentation)\b/i.test(
      text.slice(0, 2000)
    ) && stepCount === 0 && !concreteArtifacts;

  addCriterion(
    result,
    preciseConcepts >= 3,
    20,
    `Plusieurs concepts ou composants précis sont présents (${preciseConcepts}).`,
    "Peu de concepts ou composants techniques précis sont présents."
  );
  addCriterion(
    result,
    concreteArtifacts,
    25,
    "Du code, une commande, une configuration ou un fichier précis est présent.",
    "Aucun exemple technique concret, commande ou configuration n'est présent."
  );
  addCriterion(
    result,
    stepCount >= 2,
    20,
    `Une procédure comprenant plusieurs étapes est détectée (${stepCount}).`,
    "La procédure technique est absente ou trop courte."
  );
  addCriterion(
    result,
    hasPrerequisites,
    10,
    "Des prérequis ou conditions de départ sont indiqués.",
    "Les prérequis ne sont pas indiqués."
  );
  addCriterion(
    result,
    relevance >= 0.4,
    15,
    "Le contenu est directement lié à la requête.",
    "Le lien direct avec la requête est insuffisant."
  );
  addCriterion(
    result,
    text.length >= 800 && !looksGeneral,
    10,
    "Le contenu est suffisamment développé et ne ressemble pas à une simple page d'accueil.",
    looksGeneral
      ? "La source ressemble à une page d'accueil trop générale."
      : "Le contenu technique est trop court."
  );

  result.criticalCriteria = {
    conceptOrGoalPresent: preciseConcepts >= 2 || relevance >= 0.6,
    procedureExampleOrCommandPresent:
      concreteArtifacts || stepCount >= 2,
  };

  if (Object.values(result.criticalCriteria).some((present) => !present)) {
    result.score = Math.min(result.score, 39);
  }

  return result;
}

function assessHistorical(text, query) {
  const result = {
    score: 0,
    detectedCriteria: [],
    missingInformation: [],
  };
  const relevance = calculateQueryRelevance(query, text);
  const dates = text.match(
    /\b(?:\d{3,4}|[IVXLCDM]{2,}\s*e?\s+siècle|avant notre ère|après J[.-]?C[.]?)\b/gi
  ) || [];
  const contextualSignals = countMatches(text, [
    /\bcontexte\b/i,
    /\bà cette époque\b/i,
    /\ben raison de\b/i,
    /\bconséquence\b/i,
    /\bpolitique\b/i,
    /\béconomique\b/i,
    /\bsocial\b/i,
  ]);
  const eventSignals = countMatches(text, [
    /\bnaît\b/i,
    /\bmeurt\b/i,
    /\bfondé\b/i,
    /\btraité\b/i,
    /\bbataille\b/i,
    /\brévolution\b/i,
    /\bguerre\b/i,
    /\brègne\b/i,
  ]);
  const namedEntities = new Set(
    [...text.matchAll(/\b[A-ZÀ-ÖØ-Ý][\p{L}-]{2,}(?:\s+[A-ZÀ-ÖØ-Ý][\p{L}-]{2,})*/gu)]
      .map((match) => match[0])
      .filter((value) => value.length >= 4)
  ).size;

  addCriterion(
    result,
    text.length >= 800,
    20,
    "Le contenu historique est suffisamment développé.",
    "Le contenu historique est trop court."
  );
  addCriterion(
    result,
    relevance >= 0.4,
    25,
    "Le contenu répond directement à la requête historique.",
    "Le contenu est insuffisamment lié à la requête."
  );
  addCriterion(
    result,
    dates.length >= 1,
    20,
    `Des dates ou repères temporels sont présents (${dates.length}).`,
    "Aucun repère temporel identifiable."
  );
  addCriterion(
    result,
    namedEntities >= 2,
    15,
    `Des acteurs, lieux ou organisations sont identifiables (${namedEntities}).`,
    "Aucun acteur, lieu ou événement identifiable."
  );
  addCriterion(
    result,
    contextualSignals >= 1,
    10,
    "Un contexte historique est présent.",
    "Le contexte historique est absent ou trop vague."
  );
  addCriterion(
    result,
    eventSignals >= 1,
    10,
    "Au moins un événement ou changement historique est identifiable.",
    "Aucun événement historique concret n'est identifiable."
  );

  result.criticalCriteria = {
    factsPresent: text.length >= 800 && eventSignals >= 1,
    contextPresent: relevance >= 0.4 && contextualSignals >= 1,
    temporalMarkerPresent: dates.length >= 1,
    identifiableEntitiesPresent: namedEntities >= 2,
  };

  if (Object.values(result.criticalCriteria).some((present) => !present)) {
    result.score = Math.min(result.score, 39);
  }

  return result;
}

function assessGeneral(text, query) {
  const result = {
    score: 0,
    detectedCriteria: [],
    missingInformation: [],
  };
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length >= 80);
  const sentences = text
    .split(/[.!?]\s+/)
    .filter((sentence) => sentence.trim().length >= 30);
  const relevance = calculateQueryRelevance(query, text);
  const navigationSignals = (
    text.match(
      /\b(?:menu|navigation|connexion|se connecter|newsletter|cookies?|mentions légales|contact|accueil)\b/gi
    ) || []
  ).length;
  const navigationDominant =
    navigationSignals >= 8 && text.length < 1500;

  addCriterion(
    result,
    text.length >= 1000,
    25,
    `Le texte extrait est suffisamment long (${text.length} caractères).`,
    "Le texte extrait est trop court."
  );
  addCriterion(
    result,
    paragraphs.length >= 3 || sentences.length >= 6,
    25,
    "Plusieurs informations distinctes sont présentes.",
    "Le contenu contient trop peu d'informations distinctes."
  );
  addCriterion(
    result,
    relevance >= 0.4,
    30,
    "Le contenu est directement lié à la requête.",
    "Le contenu est insuffisamment lié à la requête."
  );
  addCriterion(
    result,
    !navigationDominant,
    20,
    "Le contenu ne semble pas principalement composé de navigation.",
    "La page semble principalement composée de navigation ou d'éléments génériques."
  );

  return result;
}

function assessContent(profile, text, query) {
  if (profile === "recipe") {
    return assessRecipe(text, query);
  }

  if (profile === "technical") {
    return assessTechnical(text, query);
  }

  if (profile === "historical") {
    return assessHistorical(text, query);
  }

  return assessGeneral(text, query);
}

function getLevel(score) {
  if (score >= 70) {
    return "adequate";
  }

  if (score >= 40) {
    return "partial";
  }

  return "insufficient";
}

function getAutomaticUsability(level) {
  if (level === "adequate") {
    return "oui";
  }

  if (level === "partial") {
    return "avec prudence";
  }

  return "non";
}

function getRecommendation(level, profile) {
  if (level === "adequate") {
    return `La source paraît suffisamment détaillée pour poursuivre une analyse ${profile}, sous réserve d'une validation humaine finale.`;
  }

  if (level === "partial") {
    return "La source peut servir de base, mais les informations manquantes doivent être complétées par une source plus précise avant de produire une fiche fiable.";
  }

  return "Ne pas poursuivre automatiquement avec cette source seule. Sélectionner une source plus détaillée ou compléter la recherche.";
}

function formatList(items, emptyValue) {
  return items.length > 0
    ? items.map((item) => `- ${item}`).join("\n")
    : `- ${emptyValue}`;
}

function buildCriticalCriteriaSection(profile, criticalCriteria) {
  if (Object.keys(criticalCriteria).length === 0) {
    return "";
  }

  const labels = {
    ingredientListPresent: "Liste d'ingrédients présente",
    enoughIngredients: "Nombre d'ingrédients suffisant",
    quantitiesSufficient: "Quantités suffisantes",
    culinaryStepsSufficient: "Étapes culinaires suffisantes",
    usableProcedure: "Procédure exploitable",
    cookingInformationPresent: "Cuisson ou méthode équivalente présente",
    conceptOrGoalPresent: "Concept ou objectif présent",
    procedureExampleOrCommandPresent: "Procédure, exemple ou commande présent",
    factsPresent: "Faits historiques présents",
    contextPresent: "Contexte présent",
    temporalMarkerPresent: "Repère temporel présent",
    identifiableEntitiesPresent: "Acteurs, lieux ou événements identifiables",
  };

  return `
## Critères critiques

${Object.entries(criticalCriteria)
  .map(
    ([key, present]) =>
      `- ${labels[key] || key} : ${present ? "oui" : "non"}`
  )
  .join("\n")}
`;
}

function buildReport({
  slug,
  query,
  localPath,
  url,
  profile,
  assessment,
  level,
}) {
  return `# Adéquation du contenu de la source

## Contexte

- Slug : \`${slug}\`
- Requête : ${query}
- Source locale : \`${localPath}\`
- URL : ${url || "À compléter."}
- Profil détecté : \`${profile}\`

## Résultat

- Score d'adéquation : ${assessment.score}/100
- Niveau : \`${level}\`
- Source exploitable automatiquement : ${getAutomaticUsability(level)}
${buildCriticalCriteriaSection(profile, assessment.criticalCriteria || {})}

## Critères détectés

${formatList(assessment.detectedCriteria, "Aucun critère positif détecté.")}

## Informations importantes manquantes

${formatList(assessment.missingInformation, "Aucune information importante manquante détectée.")}

## Recommandation

${getRecommendation(level, profile)}

## Limites

- Cette validation est heuristique.
- Elle ne garantit pas la vérité du contenu.
- Elle mesure surtout si la source est suffisamment détaillée pour poursuivre.
- Une validation humaine finale reste nécessaire.
`;
}

function writeRunLog() {
  const logsDirectory = path.join(PROJECT_ROOT, "logs", "runs");
  const timestamp = formatTimestamp(new Date());
  const logPath = getUniqueLogPath(logsDirectory, timestamp);
  const errors = formatList(runResult.errors, "Aucune.");

  const logContent = `# Vérification de l'adéquation d'une source

## Slug

\`${runResult.slug || "Non défini"}\`

## Requête

${runResult.query || "Non définie"}

## Fichier analysé

\`${runResult.analyzedFile || "Non analysé"}\`

## Profil

\`${runResult.profile}\`

## Score

${runResult.score}/100

## Niveau

\`${runResult.level}\`

## Code de sortie

${runResult.exitCode}

## Critères détectés

${formatList(runResult.detectedCriteria, "Aucun.")}

## Informations manquantes

${formatList(runResult.missingInformation, "Aucune.")}

## Critères critiques

${
  Object.keys(runResult.criticalCriteria).length > 0
    ? Object.entries(runResult.criticalCriteria)
        .map(([criterion, present]) => `- ${criterion} : ${present ? "oui" : "non"}`)
        .join("\n")
    : "- Non applicable."
}

## Erreurs

${errors}

## Confidentialité

- Le texte complet de la page n'est pas enregistré dans ce log.
- Aucun appel web, API externe ou modèle IA n'est utilisé.
`;

  fs.mkdirSync(logsDirectory, { recursive: true });
  fs.writeFileSync(logPath, logContent, "utf8");
  console.log(`Log créé : ${toProjectRelative(logPath)}`);
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const topicDirectory = path.join(RESEARCH_ROOT, options.slug);
    const fetchedDirectory = path.join(topicDirectory, "fetched");
    const researchPlanPath = path.join(topicDirectory, "research-plan.md");
    const sourcesPath = path.join(topicDirectory, "sources.md");
    const selectedSourcePath = path.join(
      topicDirectory,
      "selected-source.md"
    );
    const reportPath = path.join(topicDirectory, "source-adequacy.md");

    runResult.slug = options.slug;

    if (!fs.existsSync(topicDirectory) || !fs.statSync(topicDirectory).isDirectory()) {
      throw new Error(
        `Dossier de recherche absent : ${toProjectRelative(topicDirectory)}`
      );
    }

    if (
      !fs.existsSync(fetchedDirectory) ||
      !fs.statSync(fetchedDirectory).isDirectory()
    ) {
      throw new Error(
        `Dossier fetched absent : ${toProjectRelative(fetchedDirectory)}`
      );
    }

    const researchPlanContent = readOptionalFile(researchPlanPath);
    const sourcesContent = readOptionalFile(sourcesPath);
    const selectedSourceContent = readOptionalFile(selectedSourcePath);
    const fetchedPath = selectFetchedFile(
      fetchedDirectory,
      options.selectedFile,
      selectedSourceContent
    );
    const fetchedContent = fs.readFileSync(fetchedPath, "utf8");
    const text = extractSection(fetchedContent, "Texte extrait");

    if (!text) {
      throw new Error(
        'La section "## Texte extrait" est absente ou vide dans le fichier fetched.'
      );
    }

    const query = findOriginalQuery(
      sourcesContent,
      researchPlanContent,
      options.slug
    );
    const url = extractMetadataUrl(fetchedContent);
    const profile = detectContentProfile(query, text);
    const assessment = assessContent(profile, text, query);
    const score = Math.max(0, Math.min(100, Math.round(assessment.score)));
    const level = getLevel(score);
    const localPath = toProjectRelative(fetchedPath);

    assessment.score = score;
    runResult.query = query;
    runResult.analyzedFile = localPath;
    runResult.profile = profile;
    runResult.score = score;
    runResult.level = level;
    runResult.exitCode = EXIT_CODES[level];
    runResult.detectedCriteria = assessment.detectedCriteria;
    runResult.missingInformation = assessment.missingInformation;
    runResult.criticalCriteria = assessment.criticalCriteria || {};

    fs.writeFileSync(
      reportPath,
      buildReport({
        slug: options.slug,
        query,
        localPath,
        url,
        profile,
        assessment,
        level,
      }),
      "utf8"
    );

    console.log(`Slug : ${options.slug}`);
    console.log(`Requête : ${query}`);
    console.log(`Source locale : ${localPath}`);
    console.log(`Profil détecté : ${profile}`);
    console.log(`Score : ${score}/100`);
    console.log(`Niveau : ${level}`);
    console.log("Critères présents :");
    console.log(formatList(assessment.detectedCriteria, "Aucun."));
    console.log("Informations manquantes :");
    console.log(formatList(assessment.missingInformation, "Aucune."));
    console.log(`Rapport : ${toProjectRelative(reportPath)}`);
    console.log(
      "Limite : cette validation heuristique mesure le niveau de détail, ne garantit pas la vérité du contenu et exige une validation humaine finale."
    );

    process.exitCode = EXIT_CODES[level];
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue.";

    runResult.errors.push(message);
    runResult.level = "error";
    runResult.exitCode = EXIT_CODES.error;
    console.error(`Erreur : ${message}`);
    process.exitCode = EXIT_CODES.error;
  } finally {
    try {
      writeRunLog();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue.";

      console.error(`Erreur lors de la création du log : ${message}`);
      process.exitCode = EXIT_CODES.error;
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  assessContent,
  assessHistorical,
  assessRecipe,
  assessTechnical,
  detectContentProfile,
  extractSection,
  getLevel,
};

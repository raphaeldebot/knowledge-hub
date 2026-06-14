const FACT_TYPES = new Set([
  "text",
  "command",
  "code",
  "date",
  "quantity",
  "ingredient",
  "step",
  "warning",
  "definition",
]);
const PROFILES = new Set(["technical", "recipe", "historical", "general"]);
const CONFIDENCE_LEVELS = new Set(["high", "medium", "low"]);
const PLACEHOLDER_PATTERN =
  /^(?:à|a)\s+(?:compléter|completer|vérifier|verifier)[.!]?$/i;
const UNRELATED_CRITIQUE_PATTERNS = [
  /\bseo\b/i,
  /\bresponsive\b/i,
  /\bmise en page\b/i,
  /\bdesign du site\b/i,
  /\bformulaire de contact\b/i,
  /\bsystème d['’]évaluation\b/i,
  /\bajouter une section\b/i,
  /\brecommandation marketing\b/i,
];

class FactsValidationError extends Error {
  constructor(errors) {
    super(`Contrat de faits invalide : ${errors.join(" | ")}`);
    this.name = "FactsValidationError";
    this.errors = errors;
  }
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForMatch(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseJsonResponse(response) {
  if (typeof response !== "string" || !response.trim()) {
    throw new FactsValidationError(["réponse Ollama vide"]);
  }

  const trimmed = response.trim();
  const fenced = trimmed.match(/^```json\s*\r?\n([\s\S]*?)\r?\n```\s*$/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new FactsValidationError([
      `JSON invalide (${error instanceof Error ? error.message : "erreur inconnue"})`,
    ]);
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateStringArray(value, fieldName, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${fieldName} doit être un tableau`);
    return [];
  }

  const validValues = [];

  value.forEach((item, index) => {
    if (!isNonEmptyString(item)) {
      errors.push(`${fieldName}[${index}] doit être une chaîne non vide`);
    } else if (PLACEHOLDER_PATTERN.test(item.trim())) {
      errors.push(`${fieldName}[${index}] contient un placeholder`);
    } else {
      validValues.push(normalizeText(item));
    }
  });

  return validValues;
}

function isValidHttpUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function hasUnrelatedCritique(content, query) {
  const normalizedQuery = normalizeForMatch(query);

  return UNRELATED_CRITIQUE_PATTERNS.some(
    (pattern) =>
      pattern.test(content) &&
      !pattern.test(normalizedQuery)
  );
}

function validateProfileCoverage(profile, facts, errors) {
  if (facts.length === 0) {
    return;
  }

  const count = (...types) =>
    facts.filter((fact) => types.includes(fact.type)).length;

  if (profile === "recipe") {
    const ingredients = facts.filter((fact) => fact.type === "ingredient");
    const measuredIngredients = ingredients.filter((fact) =>
      /\d+(?:[.,]\d+)?\s*(?:g|kg|mg|ml|cl|l|grammes?|kilogrammes?|millilitres?|centilitres?|litres?|oeufs?|œufs?|cuillères?|tasses?)/i.test(
        fact.content
      )
    );
    const culinarySteps = facts.filter(
      (fact) =>
        fact.type === "step" &&
        /\b(?:ajout\w*|batt\w*|cui(?:re|sez|sons|sent)|enfourn\w*|fai(?:re|tes?)\s+fondre|fond\w*|fouett\w*|incorpor\w*|m[ée]lang\w*|pr[ée]chauff\w*|remu\w*|vers\w*)\b/i.test(
          fact.content
        )
    );
    const cookingMeasures = facts.filter(
      (fact) =>
        fact.type === "quantity" &&
        /\b(?:min(?:ute)?s?|heures?|h|portions?|personnes?|cuisson|repos)\b|°/i.test(
          fact.content
        )
    );

    if (ingredients.length < 2) {
      errors.push("profil recipe : au moins deux ingrédients sont requis");
    }
    if (measuredIngredients.length < 2) {
      errors.push(
        "profil recipe : au moins deux ingrédients avec quantité sont requis"
      );
    }
    if (culinarySteps.length < 2) {
      errors.push(
        "profil recipe : au moins deux étapes culinaires concrètes sont requises"
      );
    }
    if (cookingMeasures.length < 1) {
      errors.push(
        "profil recipe : une durée, température, cuisson, repos ou portion est requise"
      );
    }
  } else if (profile === "technical") {
    if (count("definition", "text") < 1) {
      errors.push("profil technical : un concept ou objectif est requis");
    }
    if (count("step", "command", "code") < 1) {
      errors.push(
        "profil technical : une procédure, commande ou exemple est requis"
      );
    }
  } else if (profile === "historical") {
    if (count("definition", "text") < 1) {
      errors.push("profil historical : un contexte factuel est requis");
    }
    if (
      !facts.some(
        (fact) =>
          fact.type === "date" &&
          /\b(?:\d{3,4}|siècle|avant notre ère|après J[.-]?C[.]?)\b/i.test(
            fact.content
          )
      )
    ) {
      errors.push("profil historical : un repère temporel est requis");
    }
    if (facts.length < 3) {
      errors.push("profil historical : au moins trois faits sont requis");
    }
  } else if (facts.length < 2) {
    errors.push("profil general : au moins deux faits sont requis");
  }
}

function validateFactsDocument(document, expected = {}) {
  const errors = [];

  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new FactsValidationError(["la racine doit être un objet JSON"]);
  }

  if (document.schemaVersion !== 1) {
    errors.push("schemaVersion doit valoir 1");
  }

  for (const field of ["query", "topic", "profile"]) {
    if (!isNonEmptyString(document[field])) {
      errors.push(`${field} doit être une chaîne non vide`);
    }
  }

  if (isNonEmptyString(document.profile) && !PROFILES.has(document.profile)) {
    errors.push(`profil inconnu : ${document.profile}`);
  }

  for (const [field, expectedValue] of Object.entries(expected)) {
    if (
      expectedValue !== undefined &&
      field !== "sources" &&
      document[field] !== expectedValue
    ) {
      errors.push(`${field} ne correspond pas au contexte du run`);
    }
  }

  if (!Array.isArray(document.sources) || document.sources.length === 0) {
    errors.push("sources doit contenir au moins une source");
  }

  const sourceIds = new Set();
  const normalizedSources = [];

  for (const [index, source] of (document.sources || []).entries()) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      errors.push(`sources[${index}] doit être un objet`);
      continue;
    }

    for (const field of ["id", "url", "title", "localFile", "adequacy"]) {
      if (!isNonEmptyString(source[field])) {
        errors.push(`sources[${index}].${field} doit être non vide`);
      }
    }

    if (sourceIds.has(source.id)) {
      errors.push(`identifiant de source dupliqué : ${source.id}`);
    }
    sourceIds.add(source.id);

    if (isNonEmptyString(source.url) && !isValidHttpUrl(source.url)) {
      errors.push(`URL de source invalide : ${source.url}`);
    }

    if (source.adequacy !== "adequate") {
      errors.push(`la source ${source.id || index} n'est pas adequate`);
    }

    normalizedSources.push({
      id: normalizeText(source.id),
      url: normalizeText(source.url),
      title: normalizeText(source.title),
      localFile: normalizeText(source.localFile).replace(/\\/g, "/"),
      adequacy: source.adequacy,
    });
  }

  if (Array.isArray(expected.sources)) {
    const actualSources = JSON.stringify(normalizedSources);
    const expectedSources = JSON.stringify(expected.sources);

    if (actualSources !== expectedSources) {
      errors.push("les métadonnées de source ne correspondent pas au run");
    }
  }

  const missingInformation = validateStringArray(
    document.missingInformation,
    "missingInformation",
    errors
  );
  const warnings = validateStringArray(document.warnings, "warnings", errors);

  if (!Array.isArray(document.facts)) {
    errors.push("facts doit être un tableau");
  } else if (document.facts.length === 0 && missingInformation.length === 0) {
    errors.push("facts est vide sans justification dans missingInformation");
  }

  const factIds = new Set();
  const normalizedFacts = [];

  for (const [index, fact] of (document.facts || []).entries()) {
    if (!fact || typeof fact !== "object" || Array.isArray(fact)) {
      errors.push(`facts[${index}] doit être un objet`);
      continue;
    }

    for (const field of [
      "id",
      "type",
      "content",
      "sourceId",
      "evidence",
      "confidence",
    ]) {
      if (!isNonEmptyString(fact[field])) {
        errors.push(`facts[${index}].${field} doit être non vide`);
      }
    }

    if (factIds.has(fact.id)) {
      errors.push(`identifiant de fait dupliqué : ${fact.id}`);
    }
    factIds.add(fact.id);

    if (isNonEmptyString(fact.type) && !FACT_TYPES.has(fact.type)) {
      errors.push(`type de fait inconnu : ${fact.type}`);
    }

    if (
      fact.type === "command" &&
      isNonEmptyString(fact.content) &&
      !/^(?:git|npm|npx|node|python3?|pip|docker|ollama|curl)\s+(?!-\s)\S+/i.test(
        fact.content.trim()
      )
    ) {
      errors.push(`syntaxe de commande invalide dans ${fact.id || `facts[${index}]`}`);
    }

    if (isNonEmptyString(fact.sourceId) && !sourceIds.has(fact.sourceId)) {
      errors.push(`source inconnue pour ${fact.id || `facts[${index}]`}`);
    }

    if (
      isNonEmptyString(fact.confidence) &&
      !CONFIDENCE_LEVELS.has(fact.confidence)
    ) {
      errors.push(`confiance inconnue pour ${fact.id || `facts[${index}]`}`);
    }

    if (
      isNonEmptyString(fact.content) &&
      PLACEHOLDER_PATTERN.test(fact.content.trim())
    ) {
      errors.push(`placeholder interdit dans ${fact.id || `facts[${index}]`}`);
    }

    if (
      isNonEmptyString(fact.content) &&
      hasUnrelatedCritique(fact.content, document.query)
    ) {
      errors.push(`critique SEO, design ou mise en page hors sujet dans ${fact.id}`);
    }

    const evidence = normalizeText(fact.evidence);

    if (evidence.length > 500) {
      errors.push(`preuve trop longue dans ${fact.id || `facts[${index}]`}`);
    }

    normalizedFacts.push({
      id: normalizeText(fact.id),
      type: fact.type,
      content: normalizeText(fact.content),
      sourceId: normalizeText(fact.sourceId),
      evidence,
      confidence: fact.confidence,
    });
  }

  validateProfileCoverage(document.profile, normalizedFacts, errors);

  if (errors.length > 0) {
    throw new FactsValidationError(errors);
  }

  return {
    schemaVersion: 1,
    query: normalizeText(document.query),
    topic: normalizeText(document.topic),
    profile: document.profile,
    sources: normalizedSources,
    facts: normalizedFacts,
    missingInformation,
    warnings,
  };
}

function validateEvidence(document, sourceTexts) {
  const errors = [];

  for (const fact of document.facts) {
    const sourceText = sourceTexts[fact.sourceId];

    if (!isNonEmptyString(sourceText)) {
      errors.push(`texte source indisponible pour ${fact.id}`);
      continue;
    }

    const normalizedSource = normalizeForMatch(sourceText);
    const normalizedEvidence = normalizeForMatch(fact.evidence);
    const evidenceTokens = [
      ...new Set(
        normalizedEvidence
          .split(/[^a-z0-9]+/)
          .filter((token) => token.length >= 3 || /^\d/.test(token))
      ),
    ];
    const sourceTokens = new Set(
      normalizedSource.split(/[^a-z0-9]+/).filter(Boolean)
    );
    const matchedTokens = evidenceTokens.filter((token) =>
      sourceTokens.has(token)
    );
    const sourceNumbers = new Set(
      (normalizedSource.match(/\d+(?:[.,]\d+)?/g) || []).map((number) =>
        number.replace(",", ".")
      )
    );
    const evidenceNumbers = normalizedEvidence.match(/\d+(?:[.,]\d+)?/g) || [];
    const numbersPresent = evidenceNumbers.every((number) =>
      sourceNumbers.has(number.replace(",", "."))
    );
    const matchedRatio =
      evidenceTokens.length > 0
        ? matchedTokens.length / evidenceTokens.length
        : 0;
    const fuzzyLocated =
      evidenceTokens.length >= 2 &&
      (evidenceTokens.length <= 3
        ? matchedRatio === 1
        : matchedRatio >= 0.7) &&
      numbersPresent;

    if (!normalizedSource.includes(normalizedEvidence) && !fuzzyLocated) {
      errors.push(`preuve introuvable dans la source pour ${fact.id}`);
    }

    const normalizedContent = normalizeForMatch(fact.content);
    const contentNumbers = normalizedContent.match(/\d+(?:[.,]\d+)?/g) || [];
    const evidenceNumberSet = new Set(
      evidenceNumbers.map((number) => number.replace(",", "."))
    );
    const contentNumbersPresent = contentNumbers.every((number) =>
      evidenceNumberSet.has(number.replace(",", "."))
    );

    if (["command", "code"].includes(fact.type)) {
      if (!normalizedEvidence.includes(normalizedContent)) {
        errors.push(`commande ou code absent de la preuve pour ${fact.id}`);
      }
      continue;
    }

    const contentTokens = [
      ...new Set(
        normalizedContent
          .split(/[^a-z0-9]+/)
          .filter((token) => token.length >= 3 || /^\d/.test(token))
      ),
    ];
    const evidenceTokenSet = new Set(
      normalizedEvidence.split(/[^a-z0-9]+/).filter(Boolean)
    );
    const contentMatched = contentTokens.filter((token) =>
      evidenceTokenSet.has(token)
    ).length;
    const contentGrounded =
      normalizedContent === normalizedEvidence ||
      (contentTokens.length >= 2 &&
        contentMatched / contentTokens.length >= 0.5 &&
        contentNumbersPresent);

    if (!contentGrounded) {
      errors.push(`contenu insuffisamment relié à la source pour ${fact.id}`);
    }
  }

  if (errors.length > 0) {
    throw new FactsValidationError(errors);
  }

  return document;
}

module.exports = {
  FACT_TYPES,
  PROFILES,
  FactsValidationError,
  normalizeForMatch,
  normalizeText,
  parseJsonResponse,
  validateEvidence,
  validateFactsDocument,
  validateProfileCoverage,
};

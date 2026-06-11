const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const RESEARCH_ROOT = path.join(PROJECT_ROOT, "data", "raw", "research");

const runResult = {
  slug: "",
  sourceFile: "",
  reportFile: "",
  analyzedCount: 0,
  counts: {
    prioritaire: 0,
    utile: 0,
    secondaire: 0,
    "à éviter": 0,
  },
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
  const baseName = `${timestamp}-validate-sources`;
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
  let force = false;

  for (const argument of argumentsList) {
    if (argument === "--force") {
      force = true;
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
      "Slug manquant. Exemple : node scripts/validate-sources.js comfyui-beginner-guide"
    );
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      "Slug invalide. Utilise uniquement des lettres minuscules, chiffres et tirets."
    );
  }

  return { slug, force };
}

// Lit les champs "- Nom : valeur" d'un bloc de source candidate.
function extractField(block, fieldName) {
  const escapedName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(
    new RegExp(`^-\\s*${escapedName}\\s*:\\s*(.*)$`, "im")
  );

  return match ? match[1].trim() : "";
}

function extractCandidateBlocks(markdown) {
  const candidatesSection = markdown.match(
    /^## Sources candidates\s*$([\s\S]*?)(?=^##\s+|(?![\s\S]))/m
  );

  if (!candidatesSection) {
    return [];
  }

  const blocks = [];
  const blockPattern =
    /^### Source candidate(?:\s*-\s*(.*))?\s*$([\s\S]*?)(?=^###\s+|^##\s+|(?![\s\S]))/gm;
  let match;

  while ((match = blockPattern.exec(candidatesSection[1])) !== null) {
    const headingTitle = (match[1] || "").trim();
    const body = match[2];

    blocks.push({
      url: extractField(body, "URL"),
      title: extractField(body, "Titre") || headingTitle,
    });
  }

  return blocks;
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function estimateType(parsedUrl, title) {
  const hostname = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname.toLowerCase();
  const text = normalizeText(`${hostname} ${pathname} ${title}`);

  if (
    hostname === "youtube.com" ||
    hostname.endsWith(".youtube.com") ||
    hostname === "youtu.be" ||
    hostname === "vimeo.com"
  ) {
    return "video";
  }

  if (
    hostname === "github.com" ||
    hostname.endsWith(".github.com") ||
    hostname.endsWith(".github.io")
  ) {
    return "github";
  }

  if (
    hostname.startsWith("docs.") ||
    hostname.startsWith("developer.") ||
    hostname.includes("readthedocs.") ||
    /\/docs?(?:\/|$)/.test(pathname) ||
    /\b(documentation|official docs?)\b/.test(text)
  ) {
    return "official_doc";
  }

  if (
    hostname.includes("stackoverflow.com") ||
    hostname.includes("stackexchange.com") ||
    hostname.includes("reddit.com") ||
    hostname.startsWith("forum.") ||
    /\b(forum|discussion|community)\b/.test(text)
  ) {
    return "forum";
  }

  if (/\b(tutorial|guide|cours|how to|getting started|beginner)\b/.test(text)) {
    return "tutorial";
  }

  if (
    hostname.includes("medium.com") ||
    hostname.includes("dev.to") ||
    hostname.includes("substack.com") ||
    hostname.startsWith("blog.") ||
    /\/blog(?:\/|$)/.test(pathname)
  ) {
    return "blog";
  }

  return "unknown";
}

function isSuspiciousDomain(hostname) {
  const suspiciousDomains = [
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "adf.ly",
    "linktr.ee",
  ];
  const suspiciousWords = [
    "crack",
    "keygen",
    "pirate",
    "warez",
    "free-download",
  ];

  return (
    suspiciousDomains.includes(hostname) ||
    suspiciousWords.some((word) => hostname.includes(word))
  );
}

function assessSource(source, seenUrls) {
  const title = source.title.trim();
  const rawUrl = source.url.trim();
  let parsedUrl;

  if (!rawUrl) {
    return buildAssessment(
      source,
      "",
      "unknown",
      0,
      "URL vide.",
      true
    );
  }

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return buildAssessment(
      source,
      "",
      "unknown",
      0,
      "URL invalide.",
      true
    );
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return buildAssessment(
      source,
      parsedUrl.hostname,
      "unknown",
      0,
      "Protocole URL non pris en charge.",
      true
    );
  }

  const normalizedUrl = parsedUrl.toString();

  if (seenUrls.has(normalizedUrl)) {
    return buildAssessment(
      source,
      parsedUrl.hostname,
      estimateType(parsedUrl, title),
      0,
      "Doublon exact d'une URL déjà analysée.",
      true
    );
  }

  seenUrls.add(normalizedUrl);

  if (!title) {
    return buildAssessment(
      source,
      parsedUrl.hostname,
      estimateType(parsedUrl, title),
      10,
      "Titre vide : la source ne peut pas être pré-évaluée correctement.",
      true
    );
  }

  const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
  const type = estimateType(parsedUrl, title);

  if (isSuspiciousDomain(hostname)) {
    return buildAssessment(
      source,
      hostname,
      type,
      5,
      "Domaine raccourci ou suspect : éviter sans vérification approfondie.",
      true
    );
  }

  const baseScores = {
    official_doc: 88,
    github: 78,
    tutorial: 62,
    blog: 55,
    forum: 48,
    video: 38,
    unknown: 42,
  };
  let score = baseScores[type];
  const reasons = [];
  const normalizedTitle = normalizeText(title);
  const marketingPattern =
    /\b(ultimate|best|complete guide|revolutionary|must have|secret|amazing)\b/;

  if (type === "official_doc") {
    reasons.push("Le domaine ou le chemin ressemble à une documentation.");
  } else if (type === "github") {
    reasons.push("La source est hébergée sur GitHub.");
  } else if (type === "tutorial") {
    reasons.push("Le titre ou l'URL indique un tutoriel ou un guide.");
  } else if (type === "blog") {
    reasons.push("La source ressemble à un article de blog technique.");
  } else if (type === "forum") {
    reasons.push("La source semble communautaire ou issue d'un forum.");
  } else if (type === "video") {
    reasons.push("La source est une vidéo ou une plateforme vidéo.");
  } else {
    reasons.push("Le domaine et le type de contenu ne sont pas reconnus.");
  }

  if (marketingPattern.test(normalizedTitle)) {
    score -= 18;
    reasons.push("Le titre contient des termes promotionnels.");
  }

  if (/\b20\d{2}\b/.test(normalizedTitle)) {
    score -= 8;
    reasons.push("Le titre met en avant une année et doit être vérifié.");
  }

  if (parsedUrl.protocol === "https:") {
    score += 3;
  }

  score = Math.max(0, Math.min(100, score));

  return buildAssessment(
    source,
    hostname,
    type,
    score,
    reasons.join(" "),
    false
  );
}

function buildAssessment(
  source,
  domain,
  type,
  score,
  reason,
  forceAvoid
) {
  let level;
  let decision;

  if (forceAvoid || score < 30) {
    level = "à éviter";
    decision = "ignorer";
  } else if (score >= 80) {
    level = "prioritaire";
    decision = "garder";
  } else if (score >= 60) {
    level = "utile";
    decision = "garder";
  } else {
    level = "secondaire";
    decision = "garder mais vérifier";
  }

  return {
    ...source,
    domain: domain || "indisponible",
    type,
    score,
    level,
    reason,
    decision,
  };
}

function safeHeading(value) {
  return value.replace(/[\r\n]+/g, " ").trim() || "Titre indisponible";
}

function formatAssessment(assessment) {
  return `### ${safeHeading(assessment.title)}

- URL : ${assessment.url || "indisponible"}
- Domaine : ${assessment.domain}
- Type estimé : \`${assessment.type}\`
- Score de fiabilité : ${assessment.score}/100
- Niveau recommandé : \`${assessment.level}\`
- Raison : ${assessment.reason}
- Décision recommandée : \`${assessment.decision}\`
`;
}

function buildReport(slug, assessments) {
  const groups = {
    prioritaire: [],
    utile: [],
    secondaire: [],
    "à éviter": [],
  };

  for (const assessment of assessments) {
    groups[assessment.level].push(assessment);
  }

  const formatGroup = (items) =>
    items.length > 0
      ? items.map(formatAssessment).join("\n")
      : "Aucune source dans cette catégorie.";

  return `# Validation des sources - ${slug}

## Résumé

- Sources analysées : ${assessments.length}
- Sources prioritaires : ${groups.prioritaire.length}
- Sources utiles : ${groups.utile.length}
- Sources secondaires : ${groups.secondaire.length}
- Sources à éviter : ${groups["à éviter"].length}

## Sources prioritaires

${formatGroup(groups.prioritaire)}

## Sources utiles

${formatGroup(groups.utile)}

## Sources secondaires

${formatGroup(groups.secondaire)}

## Sources à éviter

${formatGroup(groups["à éviter"])}

## Recommandation

À compléter manuellement.

## Limites

Cette validation est une pré-validation basée sur les métadonnées disponibles dans \`sources.md\`. Elle ne remplace pas la lecture humaine et ne valide pas le contenu réel des pages.
`;
}

function writeRunLog() {
  const logsDirectory = path.join(PROJECT_ROOT, "logs", "runs");
  const timestamp = formatTimestamp(new Date());
  const logPath = getUniqueLogPath(logsDirectory, timestamp);
  const errors =
    runResult.errors.length > 0
      ? runResult.errors.map((error) => `- ${error}`).join("\n")
      : "- Aucune";
  const commandArguments = process.argv
    .slice(2)
    .map((argument) => JSON.stringify(argument))
    .join(" ");
  const command = `node scripts/validate-sources.js${
    commandArguments ? ` ${commandArguments}` : ""
  }`;

  const logContent = `# Validation locale de sources candidates

## Slug

\`${runResult.slug || "Non défini"}\`

## Fichier lu

\`${runResult.sourceFile || "Non lu"}\`

## Rapport créé

\`${runResult.reportFile || "Non créé"}\`

## Sources analysées

${runResult.analyzedCount}

## Nombre par niveau

- Prioritaires : ${runResult.counts.prioritaire}
- Utiles : ${runResult.counts.utile}
- Secondaires : ${runResult.counts.secondaire}
- À éviter : ${runResult.counts["à éviter"]}

## Erreurs

${errors}

## Commande exécutée

\`${command.replace(/`/g, "")}\`

## Confidentialité

- Aucun accès web n'est effectué.
- Aucun contenu complet de page web n'est enregistré.
`;

  fs.mkdirSync(logsDirectory, { recursive: true });
  fs.writeFileSync(logPath, logContent, "utf8");
  console.log(`Log créé : ${toProjectRelative(logPath)}`);
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const topicDirectory = path.join(RESEARCH_ROOT, options.slug);
    const sourcesPath = path.join(topicDirectory, "sources.md");
    const reportPath = path.join(topicDirectory, "source-validation.md");

    runResult.slug = options.slug;
    runResult.sourceFile = toProjectRelative(sourcesPath);

    if (!fs.existsSync(topicDirectory)) {
      throw new Error(`Dossier de recherche absent : ${toProjectRelative(topicDirectory)}`);
    }

    if (!fs.statSync(topicDirectory).isDirectory()) {
      throw new Error("Le chemin du sujet ne désigne pas un dossier.");
    }

    if (!fs.existsSync(sourcesPath)) {
      throw new Error(`sources.md absent : ${runResult.sourceFile}`);
    }

    if (!fs.statSync(sourcesPath).isFile()) {
      throw new Error("Le chemin sources.md ne désigne pas un fichier.");
    }

    if (fs.existsSync(reportPath) && !options.force) {
      throw new Error(
        "Le rapport existe déjà. Utilise --force pour le remplacer."
      );
    }

    const sourcesContent = fs.readFileSync(sourcesPath, "utf8");
    const candidates = extractCandidateBlocks(sourcesContent);

    if (candidates.length === 0) {
      throw new Error("Aucune source candidate trouvée dans sources.md.");
    }

    const seenUrls = new Set();
    const assessments = candidates.map((candidate) =>
      assessSource(candidate, seenUrls)
    );

    runResult.analyzedCount = assessments.length;

    for (const assessment of assessments) {
      runResult.counts[assessment.level] += 1;
    }

    const report = buildReport(options.slug, assessments);

    fs.writeFileSync(reportPath, report, {
      encoding: "utf8",
      flag: options.force ? "w" : "wx",
    });
    runResult.reportFile = toProjectRelative(reportPath);

    console.log(`Slug : ${options.slug}`);
    console.log(`Fichier source : ${runResult.sourceFile}`);
    console.log(`Sources analysées : ${runResult.analyzedCount}`);
    console.log(`Rapport créé : ${runResult.reportFile}`);
    console.log(`Sources prioritaires : ${runResult.counts.prioritaire}`);
    console.log(`Sources utiles : ${runResult.counts.utile}`);
    console.log(`Sources secondaires : ${runResult.counts.secondaire}`);
    console.log(`Sources à éviter : ${runResult.counts["à éviter"]}`);
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

main();

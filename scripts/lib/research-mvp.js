const fs = require("node:fs");
const path = require("node:path");
const { atomicWriteFile } = require("./atomic-file");

const ALLOWED_TOPICS = new Set([
  "ai-image",
  "automation",
  "cuisine",
  "development",
  "general",
  "git",
  "health",
  "history",
  "linux",
  "science",
]);

const PLACEHOLDERS = [
  "à compléter",
  "a completer",
  "todo",
  "tbd",
  "lorem ipsum",
  "example.com",
];

const STOP_WORDS = new Set([
  "avec",
  "comment",
  "dans",
  "des",
  "une",
  "pour",
  "les",
  "the",
  "and",
  "guide",
  "recette",
  "facile",
]);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/gi, "oe")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function createSlug(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function decodeHtmlEntities(value) {
  const entities = {
    amp: "&",
    apos: "'",
    gt: ">",
    laquo: "«",
    lt: "<",
    nbsp: " ",
    quot: '"',
    raquo: "»",
    rsquo: "'",
    ldquo: '"',
    rdquo: '"',
  };

  return String(value || "")
    .replace(/&#(\d+);/g, (_, number) =>
      String.fromCodePoint(Number(number))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, number) =>
      String.fromCodePoint(Number.parseInt(number, 16))
    )
    .replace(/&([a-z]+);/gi, (entity, name) =>
      Object.hasOwn(entities, name.toLowerCase())
        ? entities[name.toLowerCase()]
        : entity
    );
}

function extractSection(markdown, title) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const expected = normalizeText(title);
  const start = lines.findIndex((line) => {
    const match = line.match(/^##\s+(.+)$/);

    return match && normalizeText(match[1]) === expected;
  });

  if (start < 0) {
    return "";
  }

  const section = [];

  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      break;
    }

    section.push(lines[index]);
  }

  return section.join("\n").trim();
}

function extractFetchedSource(markdown, localPath) {
  const titleMatch = String(markdown).match(
    /^#\s+Source récupérée\s*-\s*(.+)$/m
  );
  const metadata = extractSection(markdown, "Métadonnées");
  const urlMatch = metadata.match(/^- URL\s*:\s*(https?:\/\/\S+)\s*$/m);
  const text = extractSection(markdown, "Texte extrait");

  if (!titleMatch || !urlMatch || !text) {
    throw new Error(
      `Source récupérée invalide ou incomplète : ${localPath}`
    );
  }

  return {
    title: titleMatch[1].trim(),
    url: urlMatch[1].trim(),
    localPath,
    text,
  };
}

function cleanSourceText(value, options = {}) {
  const settings =
    typeof options === "number" ? { maxCharacters: options } : options;
  const maxCharacters = settings.maxCharacters || 14_000;
  let sourceText = decodeHtmlEntities(value).replace(/\r/g, "");
  const query = normalizeText(settings.query || "");

  if (/\b(recette|gateau|cuisine|dessert)\b/.test(query)) {
    const recipeStart = sourceText.search(
      /(?:Carte de recette|Détails de la Recette|Ingrédients clés)/i
    );
    const recipeEnd = sourceText.search(
      /Astuces pour personnaliser|Avec quoi déguster|Conclusion/i
    );

    if (recipeStart >= 0 && recipeEnd > recipeStart) {
      sourceText = sourceText.slice(recipeStart, recipeEnd);
    }
  }

  const lines = sourceText
    .replace(/\r/g, "")
    .split("\n");
  const ignoredExactLines = new Set([
    "aller au contenu",
    "facebook",
    "x",
    "pinterest",
    "youtube",
    "table des matières",
    "recherche",
    "contactez nous",
    "votre avis",
    "votre nom",
    "votre e-mail",
    "envoyer un avis",
  ]);
  const cleaned = [];
  let skipNutrition = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/[ \t]+/g, " ").trim();
    const normalized = normalizeText(line);

    if (normalized === "nutriment") {
      skipNutrition = true;
      continue;
    }

    if (
      skipNutrition &&
      /^(ingredients?|ingrédients?)\b/i.test(line)
    ) {
      skipNutrition = false;
    }

    if (skipNutrition || !line || ignoredExactLines.has(normalized)) {
      continue;
    }

    if (
      /^(mail\s*:|©|politique de confidentialité|mentions légales)/i.test(
        line
      ) ||
      /abonnez-vous|publier vos photos|réseaux sociaux/i.test(line)
    ) {
      continue;
    }

    if (cleaned[cleaned.length - 1] !== line) {
      cleaned.push(line);
    }
  }

  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").slice(0, maxCharacters);
}

function classifyTopic(query, title = "", requestedTopic = "") {
  if (ALLOWED_TOPICS.has(requestedTopic)) {
    return requestedTopic;
  }

  const text = normalizeText(`${query} ${title}`);
  const rules = [
    ["cuisine", /\b(recette|gateau|cuisine|cuisson|ingredient|dessert)\b/],
    ["ai-image", /\b(comfyui|stable diffusion|image ia|text to image)\b/],
    ["git", /\b(git|github|rebase|commit|branche)\b/],
    ["linux", /\b(linux|ubuntu|debian|arch linux|shell|systemd)\b/],
    ["history", /\b(histoire|historique|revolution|guerre|empire)\b/],
    ["science", /\b(science|physique|chimie|biologie|astronomie)\b/],
    ["health", /\b(sante|medecine|symptome|traitement|nutrition)\b/],
    [
      "development",
      /\b(javascript|typescript|node(?:js)?|python|api|developpe?ment|code)\b/,
    ],
    ["automation", /\b(automatisation|automation|script|workflow|agent)\b/],
  ];
  const match = rules.find(([, pattern]) => pattern.test(text));

  return match ? match[0] : "general";
}

function parseTags(rawValue) {
  const value = String(rawValue || "").trim();

  if (!value) {
    return [];
  }

  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((tag) => tag.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }

  return [value.replace(/^["']|["']$/g, "")].filter(Boolean);
}

function parseFrontmatter(markdown) {
  const normalized = String(markdown || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!match) {
    return { valid: false, values: {}, body: normalized.trim() };
  }

  const values = {};
  const lines = match[1].split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const lineMatch = lines[index].match(/^([a-z_]+):\s*(.*)$/i);

    if (!lineMatch) {
      continue;
    }

    const key = lineMatch[1];
    const rawValue = lineMatch[2].trim();

    if (key === "tags" && rawValue === "") {
      const tags = [];

      while (
        index + 1 < lines.length &&
        /^\s*-\s+/.test(lines[index + 1])
      ) {
        index += 1;
        tags.push(
          lines[index].replace(/^\s*-\s+/, "").replace(/^["']|["']$/g, "")
        );
      }

      values.tags = tags;
      continue;
    }

    values[key] =
      key === "tags"
        ? parseTags(rawValue)
        : rawValue.replace(/^["']|["']$/g, "");
  }

  return { valid: true, values, body: match[2].trim() };
}

function extractComparableNumbers(value) {
  const normalized = normalizeText(value)
    .replace(/(\d)\s*,\s*(\d)/g, "$1.$2")
    .replace(/(\d)\s+(g|kg|mg|ml|cl|l|min|h|%|°c|°f)\b/g, "$1$2");
  const matches =
    normalized.match(
      /\b\d+(?:\.\d+)?(?:g|kg|mg|ml|cl|l|min(?:ute)?s?|h(?:eure)?s?|%|°c|°f|unites?)\b/g
    ) || [];

  return new Set(
    matches.map((item) =>
      item
        .replace(/minutes?/, "min")
        .replace(/heures?/, "h")
        .replace(/unites?/, "unite")
    )
  );
}

function getQueryTerms(query) {
  return [
    ...new Set(
      normalizeText(query)
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
    ),
  ];
}

function validateGeneratedMarkdown(markdown, context) {
  const errors = [];
  const parsed = parseFrontmatter(markdown);

  if (String(markdown || "").trim().length < 180) {
    errors.push("La sortie Markdown est vide ou presque vide.");
  }

  if (!parsed.valid) {
    errors.push("Le frontmatter est absent ou invalide.");
    return { valid: false, errors, parsed, repairable: true };
  }

  if (!parsed.values.title) {
    errors.push("Le titre est absent.");
  }

  if (!parsed.values.topic) {
    errors.push("Le topic est absent.");
  }

  if (
    !parsed.values.source_id ||
    !String(markdown).includes(context.sourceUrl)
  ) {
    errors.push("La source ou son URL est absente.");
  }

  if (parsed.body.length < 120) {
    errors.push("Le corps de la fiche est trop court.");
  }

  const normalizedBody = normalizeText(parsed.body);
  const placeholderCount = PLACEHOLDERS.reduce(
    (count, placeholder) =>
      count + (normalizedBody.split(placeholder).length - 1),
    0
  );

  if (placeholderCount >= 2 || /(?:^|\n)\s*[-*]\s*\.\.\./m.test(parsed.body)) {
    errors.push("La fiche contient principalement des placeholders.");
  }

  const queryTerms = getQueryTerms(context.query);

  if (
    queryTerms.length > 0 &&
    !queryTerms.some((term) =>
      normalizeText(`${parsed.values.title} ${parsed.body}`).includes(term)
    )
  ) {
    errors.push("Le corps ne répond manifestement pas à la requête.");
  }

  const sourceNumbers = extractComparableNumbers(context.cleanedSource);
  const generatedNumbers = extractComparableNumbers(parsed.body);
  const unsupportedNumbers = [...generatedNumbers].filter(
    (number) => !sourceNumbers.has(number)
  );

  if (unsupportedNumbers.length > 0) {
    errors.push(
      `Nombre ou unité absent de la source : ${unsupportedNumbers.join(", ")}.`
    );
  }

  const sixtyMgIndex = normalizeText(parsed.body).indexOf("60mg");

  if (
    sixtyMgIndex >= 0 &&
    !normalizeText(parsed.body)
      .slice(Math.max(0, sixtyMgIndex - 50), sixtyMgIndex + 70)
      .includes("cholesterol")
  ) {
    errors.push("La quantité 60 mg est utilisée sans son contexte.");
  }

  const repairable = errors.some((error) =>
    /vide|frontmatter|titre est absent|source ou son url|placeholders|ne répond/.test(
      normalizeText(error)
    )
  );

  return {
    valid: errors.length === 0,
    errors,
    parsed,
    repairable,
  };
}

function quoteYaml(value) {
  return `"${String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, " ")}"`;
}

function deriveTags(query, topic) {
  const words = getQueryTerms(query)
    .map(createSlug)
    .filter(Boolean)
    .slice(0, 4);
  const tags = [...new Set([topic, ...words])];

  return tags.slice(0, 5).length >= 2
    ? tags.slice(0, 5)
    : [topic, "recherche"];
}

function canonicalizeMarkdown(markdown, context) {
  const parsed = parseFrontmatter(markdown);
  const title = parsed.values.title.trim();
  const topic = classifyTopic(
    context.query,
    title,
    context.requestedTopic || parsed.values.topic
  );
  const proposedTags = Array.isArray(parsed.values.tags)
    ? parsed.values.tags.map(createSlug).filter(Boolean)
    : [];
  const tags =
    proposedTags.length >= 2 && proposedTags.length <= 5
      ? [...new Set(proposedTags)].slice(0, 5)
      : deriveTags(context.query, topic);
  const updated = context.updated || new Date().toISOString().slice(0, 10);
  const frontmatter = [
    "---",
    `title: ${quoteYaml(title)}`,
    `topic: ${quoteYaml(topic)}`,
    `level: ${quoteYaml(parsed.values.level || "beginner")}`,
    `tags: [${tags.map(quoteYaml).join(", ")}]`,
    'source_type: "web_saved"',
    `source_id: ${quoteYaml(context.sourceUrl)}`,
    'confidence: "medium"',
    'status: "draft"',
    `updated: ${quoteYaml(updated)}`,
    "---",
  ].join("\n");

  return {
    markdown: `${frontmatter}\n\n${parsed.body.trim()}\n`,
    title,
    topic,
    tags,
    slug: createSlug(title) || createSlug(context.query),
  };
}

function resolveKnowledgeDestination(knowledgeRoot, topic, slug) {
  const root = path.resolve(knowledgeRoot);
  const destination = path.resolve(root, topic, `${slug}.md`);

  if (!destination.startsWith(`${root}${path.sep}`)) {
    throw new Error("La destination sort de knowledge/.");
  }

  return destination;
}

function validateDestination(knowledgeRoot, destination) {
  const root = path.resolve(knowledgeRoot);
  const resolved = path.resolve(destination);

  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("La destination sort de knowledge/.");
  }

  return resolved;
}

function finalizeGeneratedNote({
  generatedMarkdown,
  context,
  knowledgeRoot,
  force = false,
  writeFile = atomicWriteFile,
}) {
  const validation = validateGeneratedMarkdown(generatedMarkdown, context);

  if (!validation.valid) {
    throw new Error(`Validation MVP échouée : ${validation.errors.join(" | ")}`);
  }

  const note = canonicalizeMarkdown(generatedMarkdown, context);
  const destination = resolveKnowledgeDestination(
    knowledgeRoot,
    note.topic,
    note.slug
  );

  validateDestination(knowledgeRoot, destination);
  writeFile(destination, note.markdown, { force });

  return { ...note, destination };
}

async function generateWriteAndIndex({
  generate,
  generationInput,
  context,
  knowledgeRoot,
  force = false,
  writeFile = atomicWriteFile,
  runIndex,
}) {
  const generatedMarkdown = await generate(generationInput);
  const note = finalizeGeneratedNote({
    generatedMarkdown,
    context,
    knowledgeRoot,
    force,
    writeFile,
  });

  await runIndex(note);
  return note;
}

function findFetchedFileForUrl(researchDirectory, sourceUrl) {
  const fetchedDirectory = path.join(researchDirectory, "fetched");

  if (!fs.existsSync(fetchedDirectory)) {
    return "";
  }

  for (const entry of fs.readdirSync(fetchedDirectory, {
    withFileTypes: true,
  })) {
    if (!entry.isFile() || path.extname(entry.name) !== ".md") {
      continue;
    }

    const filePath = path.join(fetchedDirectory, entry.name);
    const content = fs.readFileSync(filePath, "utf8");

    if (content.includes(`- URL : ${sourceUrl}`)) {
      return filePath;
    }
  }

  return "";
}

module.exports = {
  ALLOWED_TOPICS,
  canonicalizeMarkdown,
  classifyTopic,
  cleanSourceText,
  createSlug,
  extractFetchedSource,
  finalizeGeneratedNote,
  findFetchedFileForUrl,
  generateWriteAndIndex,
  parseFrontmatter,
  resolveKnowledgeDestination,
  validateDestination,
  validateGeneratedMarkdown,
};

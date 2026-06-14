const {
  normalizeForMatch,
  normalizeText,
  validateFactsDocument,
} = require("./facts-contract");

const PLACEHOLDER_PATTERN =
  /(?:à|a)\s+(?:compléter|completer|vérifier|verifier)/i;
const NUMERIC_PATTERN =
  /\b\d+(?:[.,]\d+)?(?:\s*(?:°\s*c|kg|mg|g|ml|cl|l|h|min(?:ute)?s?|kcal|%|personnes?))?\b/giu;

function yamlString(value) {
  return JSON.stringify(String(value || ""));
}

function createTitle(query) {
  const trimmed = normalizeText(query);

  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : "Fiche";
}

function factLine(fact) {
  return `- ${fact.content} _(${fact.sourceId}, ${fact.id})_`;
}

function commandBlock(facts) {
  if (facts.length === 0) {
    return "";
  }

  return [
    "```bash",
    ...facts.map((fact) => fact.content),
    "```",
    "",
    ...facts.map(
      (fact) => `- Provenance : _(${fact.sourceId}, ${fact.id})_`
    ),
  ].join("\n");
}

function codeBlock(facts) {
  if (facts.length === 0) {
    return "";
  }

  return facts
    .map(
      (fact) =>
        `\`\`\`\n${fact.content}\n\`\`\`\n\n- Provenance : _(${fact.sourceId}, ${fact.id})_`
    )
    .join("\n\n");
}

function addSection(sections, title, content) {
  const normalizedContent = String(content || "").trim();

  if (normalizedContent) {
    sections.push({ title, content: normalizedContent });
  }
}

function selectFacts(document, ...types) {
  const accepted = new Set(types);

  return document.facts.filter((fact) => accepted.has(fact.type));
}

function renderRemainingFacts(document, sections, renderedTypes) {
  const remaining = document.facts.filter(
    (fact) => !renderedTypes.includes(fact.type)
  );
  const commands = remaining.filter((fact) => fact.type === "command");
  const code = remaining.filter((fact) => fact.type === "code");
  const plainFacts = remaining.filter(
    (fact) => !["command", "code"].includes(fact.type)
  );

  addSection(
    sections,
    "Autres faits validés",
    [
      plainFacts.map(factLine).join("\n"),
      commandBlock(commands),
      codeBlock(code),
    ]
      .filter(Boolean)
      .join("\n\n")
  );
}

function renderRecipe(document, sections) {
  const ingredients = selectFacts(document, "ingredient");
  const steps = selectFacts(document, "step");
  const quantities = selectFacts(document, "quantity");
  const warnings = selectFacts(document, "warning");
  const context = selectFacts(document, "text", "definition");

  addSection(
    sections,
    "Résumé",
    context.length > 0
      ? context.map(factLine).join("\n")
      : "Cette fiche regroupe les faits culinaires validés de la source sélectionnée."
  );
  addSection(sections, "Ingrédients et quantités", ingredients.map(factLine).join("\n"));
  addSection(sections, "Préparation", steps.map(factLine).join("\n"));
  addSection(sections, "Cuisson, durée et portions", quantities.map(factLine).join("\n"));
  addSection(sections, "Conseils et avertissements", warnings.map(factLine).join("\n"));
  renderRemainingFacts(document, sections, [
    "ingredient",
    "step",
    "quantity",
    "warning",
    "text",
    "definition",
  ]);
}

function renderTechnical(document, sections) {
  const concepts = selectFacts(document, "definition", "text");
  const steps = selectFacts(document, "step");
  const commands = selectFacts(document, "command");
  const code = selectFacts(document, "code");
  const warnings = selectFacts(document, "warning");

  addSection(sections, "Résumé et concepts", concepts.map(factLine).join("\n"));
  addSection(sections, "Procédure", steps.map(factLine).join("\n"));
  addSection(sections, "Commandes", commandBlock(commands));
  addSection(sections, "Exemples de code", codeBlock(code));
  addSection(sections, "Erreurs et avertissements", warnings.map(factLine).join("\n"));
  renderRemainingFacts(document, sections, [
    "definition",
    "text",
    "step",
    "command",
    "code",
    "warning",
  ]);
}

function renderHistorical(document, sections) {
  const dates = selectFacts(document, "date");
  const context = selectFacts(document, "definition", "text");
  const events = selectFacts(document, "step");
  const warnings = selectFacts(document, "warning");

  addSection(sections, "Résumé et contexte", context.map(factLine).join("\n"));
  addSection(sections, "Chronologie", dates.map(factLine).join("\n"));
  addSection(sections, "Acteurs et événements", events.map(factLine).join("\n"));
  addSection(sections, "Incertitudes", warnings.map(factLine).join("\n"));
  renderRemainingFacts(document, sections, [
    "date",
    "definition",
    "text",
    "step",
    "warning",
  ]);
}

function renderGeneral(document, sections) {
  const groups = [
    ["Faits essentiels", ["definition", "text"]],
    ["Étapes", ["step"]],
    ["Dates et quantités", ["date", "quantity"]],
    ["Commandes et code", ["command", "code"]],
    ["Ingrédients", ["ingredient"]],
    ["Avertissements", ["warning"]],
  ];

  for (const [title, types] of groups) {
    const facts = selectFacts(document, ...types);
    const content =
      title === "Commandes et code"
        ? [
            commandBlock(facts.filter((fact) => fact.type === "command")),
            codeBlock(facts.filter((fact) => fact.type === "code")),
          ]
            .filter(Boolean)
            .join("\n\n")
        : facts.map(factLine).join("\n");

    addSection(sections, title, content);
  }
}

function renderSources(document, sections) {
  addSection(
    sections,
    "Sources",
    document.sources
      .map(
        (source) =>
          `- [${source.title}](${source.url}) — \`${source.localFile}\` (${source.id})`
      )
      .join("\n")
  );
}

function renderFactsMarkdown(document, { sourceId } = {}) {
  const facts = validateFactsDocument(document);
  const sections = [];

  if (facts.profile === "recipe") {
    renderRecipe(facts, sections);
  } else if (facts.profile === "technical") {
    renderTechnical(facts, sections);
  } else if (facts.profile === "historical") {
    renderHistorical(facts, sections);
  } else {
    renderGeneral(facts, sections);
  }

  if (facts.missingInformation.length > 0) {
    addSection(
      sections,
      "Informations absentes de la source",
      facts.missingInformation.map((item) => `- ${item}`).join("\n")
    );
  }

  if (facts.warnings.length > 0) {
    addSection(
      sections,
      "Avertissements d’extraction",
      facts.warnings.map((item) => `- ${item}`).join("\n")
    );
  }

  renderSources(facts, sections);

  const title = createTitle(facts.query);
  const frontmatter = [
    "---",
    `title: ${yamlString(title)}`,
    `topic: ${yamlString(facts.topic)}`,
    'level: "beginner"',
    "tags: []",
    'source_type: "research_note"',
    `source_id: ${yamlString(sourceId || "extracted-facts.json")}`,
    'confidence: "medium"',
    'status: "draft"',
    'updated: ""',
    "---",
  ].join("\n");
  const body = sections
    .map((section) => `## ${section.title}\n\n${section.content}`)
    .join("\n\n");

  return `${frontmatter}\n\n# ${title}\n\n${body}\n`;
}

function normalizeNumber(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/°c$/, "°c");
}

function extractNumbers(value) {
  return (String(value || "").match(NUMERIC_PATTERN) || []).map(normalizeNumber);
}

function extractUrls(value) {
  return String(value || "").match(/https?:\/\/[^\s)<>"'`]+/gi) || [];
}

function extractCodeBlocks(markdown) {
  return [...String(markdown || "").matchAll(/```[^\r\n]*\r?\n([\s\S]*?)```/g)].map(
    (match) => match[1].trim()
  );
}

function extractSection(markdown, title) {
  const lines = String(markdown || "").split(/\r?\n/);
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

function shouldAllowCodeBlocks(document) {
  return (
    document.profile === "technical" ||
    document.facts.some((fact) => ["command", "code"].includes(fact.type))
  );
}

function validateMarkdownAgainstFacts(markdown, document) {
  const facts = validateFactsDocument(document);
  const errors = [];
  const warnings = [];
  const frontmatterMatch = String(markdown || "").match(
    /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
  );

  if (!frontmatterMatch) {
    errors.push("frontmatter absent");
  }

  if (!/^#\s+\S.+$/m.test(markdown)) {
    errors.push("titre H1 absent");
  }

  const sections = [...String(markdown || "").matchAll(/^##\s+(.+)$/gm)];

  if (sections.length < 2) {
    errors.push("la fiche doit contenir au moins deux sections H2");
  }

  for (let index = 0; index < sections.length; index += 1) {
    const start = sections[index].index + sections[index][0].length;
    const end =
      index + 1 < sections.length ? sections[index + 1].index : markdown.length;
    const content = markdown.slice(start, end).trim();

    if (!content) {
      errors.push(`section vide : ${sections[index][1].trim()}`);
    }
  }

  if (PLACEHOLDER_PATTERN.test(markdown)) {
    errors.push("placeholder interdit");
  }

  const citedFactIds = new Set(
    [...String(markdown || "").matchAll(/\b(fact-[a-z0-9-]+)\b/gi)].map(
      (match) => match[1]
    )
  );

  for (const fact of facts.facts) {
    if (!citedFactIds.has(fact.id)) {
      errors.push(`fait extrait absent de la fiche : ${fact.id}`);
    }
  }

  const allowedNumbers = new Set(
    facts.facts
      .flatMap((fact) => extractNumbers(`${fact.content} ${fact.evidence}`))
  );
  const bodyWithoutFrontmatter = frontmatterMatch
    ? markdown.slice(frontmatterMatch[0].length)
    : markdown;
  const sourcesContent = extractSection(bodyWithoutFrontmatter, "Sources");
  const factualBody = sourcesContent
    ? bodyWithoutFrontmatter.replace(sourcesContent, "")
    : bodyWithoutFrontmatter;
  const bodyWithoutUrls = factualBody.replace(
    /https?:\/\/[^\s)<>"'`]+/gi,
    ""
  ).replace(
    /_\(source-[a-z0-9-]+,\s*fact-[a-z0-9-]+\)_/gi,
    ""
  ).replace(
    /\b(?:source|fact)-[a-z0-9-]+\b/gi,
    ""
  );

  for (const number of extractNumbers(bodyWithoutUrls)) {
    if (!allowedNumbers.has(number)) {
      errors.push(`nombre absent des faits : ${number}`);
    }
  }

  const allowedUrls = new Set(facts.sources.map((source) => source.url));

  for (const url of extractUrls(markdown)) {
    if (!allowedUrls.has(url)) {
      errors.push(`URL absente des sources : ${url}`);
    }
  }

  const allowedCommands = new Set(
    facts.facts
      .filter((fact) => fact.type === "command")
      .map((fact) => normalizeForMatch(fact.content))
  );

  for (const block of extractCodeBlocks(markdown)) {
    for (const line of block.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
      if (
        /^git\s+/i.test(line) &&
        !allowedCommands.has(normalizeForMatch(line))
      ) {
        errors.push(`commande absente des faits : ${line}`);
      }
    }
  }

  if (!shouldAllowCodeBlocks(facts) && extractCodeBlocks(markdown).length > 0) {
    errors.push("blocs de code interdits pour ce profil");
  }

  const sourceSection = extractSection(markdown, "Sources");

  if (!sourceSection) {
    errors.push("section Sources absente");
  }

  const properNameSearchText = bodyWithoutFrontmatter
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/^\s*-\s+Provenance\s*:.*$/gim, "");
  const properNames = [
    ...properNameSearchText.matchAll(/\b[A-ZÀ-ÖØ-Ý][\p{L}-]{2,}(?:\s+[A-ZÀ-ÖØ-Ý][\p{L}-]{2,})*/gu),
  ].map((match) => match[0]);
  const groundedText = normalizeForMatch(
    [
      facts.query,
      ...facts.sources.map((source) => source.title),
      ...facts.facts.map((fact) => `${fact.content} ${fact.evidence}`),
    ].join(" ")
  );

  for (const name of properNames) {
    if (!groundedText.includes(normalizeForMatch(name))) {
      warnings.push(`nom propre non retrouvé directement dans les faits : ${name}`);
    }
  }

  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
  };
}

module.exports = {
  extractNumbers,
  renderFactsMarkdown,
  shouldAllowCodeBlocks,
  validateMarkdownAgainstFacts,
};

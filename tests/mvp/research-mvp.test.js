const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  classifyTopic,
  cleanSourceText,
  finalizeGeneratedNote,
  generateWriteAndIndex,
  validateDestination,
  validateGeneratedMarkdown,
} = require("../../scripts/mvp/research-mvp");
const {
  cleanModelResponse,
  generateNoteDirect,
} = require("../../scripts/mvp/generate-note-direct-with-ollama");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const TEST_ROOT = path.join(
  PROJECT_ROOT,
  "tests",
  `.tmp-research-mvp-${process.pid}`
);
const KNOWLEDGE_ROOT = path.join(TEST_ROOT, "knowledge");
const SOURCE_URL = "https://example.test/source";
const CONTEXT = {
  query: "guide chocolat pratique",
  sourceUrl: SOURCE_URL,
  cleanedSource:
    "Guide chocolat pratique. Utiliser du chocolat puis suivre les étapes décrites.",
  updated: "2026-06-13",
};

function validMarkdown(title = "Guide chocolat pratique") {
  return `---
title: "${title}"
topic: "cuisine"
level: "beginner"
tags: ["chocolat", "guide"]
source_type: "web_saved"
source_id: "${SOURCE_URL}"
confidence: "medium"
status: "draft"
updated: "2026-06-13"
---

# ${title}

## Résumé

Cette fiche présente un guide chocolat pratique fidèle à la source locale.

## Procédure

- Utiliser du chocolat.
- Suivre les étapes décrites dans la source.

## Sources

- ${SOURCE_URL}
`;
}

const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

test("1. sortie Markdown vide rejetée", () => {
  const result = validateGeneratedMarkdown("", CONTEXT);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /vide/i);
});

test("2. frontmatter absent rejeté", () => {
  const result = validateGeneratedMarkdown(
    `# Guide chocolat\n\nContenu pratique.\n\n${SOURCE_URL}`,
    CONTEXT
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /frontmatter/i);
});

test("3. source absente rejetée", () => {
  const markdown = validMarkdown().replaceAll(SOURCE_URL, "");
  const result = validateGeneratedMarkdown(markdown, CONTEXT);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /source/i);
});

test("4. fiche valide acceptée", () => {
  const wrapped = `<think>raisonnement local</think>

Voici la fiche :

\`\`\`
---
séparation décorative
---
\`\`\`

\`\`\`markdown
${validMarkdown()}
\`\`\``;
  const result = validateGeneratedMarkdown(
    cleanModelResponse(wrapped),
    CONTEXT
  );

  assert.equal(result.valid, true, result.errors.join(" | "));
});

test("5. destination hors knowledge rejetée", () => {
  assert.throws(
    () =>
      validateDestination(
        KNOWLEDGE_ROOT,
        path.join(TEST_ROOT, "outside.md")
      ),
    /sort de knowledge/i
  );
});

test("6. ancienne fiche préservée après échec", () => {
  const existingPath = path.join(
    KNOWLEDGE_ROOT,
    "cuisine",
    "guide-chocolat-pratique.md"
  );

  fs.mkdirSync(path.dirname(existingPath), { recursive: true });
  fs.writeFileSync(existingPath, "ancienne fiche\n", "utf8");

  assert.throws(
    () =>
      finalizeGeneratedNote({
        generatedMarkdown: "",
        context: CONTEXT,
        knowledgeRoot: KNOWLEDGE_ROOT,
        force: true,
      }),
    /validation mvp/i
  );
  assert.equal(fs.readFileSync(existingPath, "utf8"), "ancienne fiche\n");
});

test("7. écriture atomique sans fichier temporaire restant", () => {
  const note = finalizeGeneratedNote({
    generatedMarkdown: validMarkdown("Fiche atomique chocolat"),
    context: CONTEXT,
    knowledgeRoot: KNOWLEDGE_ROOT,
  });
  const entries = fs.readdirSync(path.dirname(note.destination));

  assert.equal(fs.existsSync(note.destination), true);
  assert.equal(entries.some((name) => name.endsWith(".tmp")), false);
});

test("8. classification inconnue vers general", () => {
  assert.equal(
    classifyTopic("sujet volontairement indéterminé", "note diverse"),
    "general"
  );
});

test("9. succès simulé lançant l’indexation une fois", async () => {
  let indexCalls = 0;
  const note = await generateWriteAndIndex({
    generate: async () => validMarkdown("Succès index unique"),
    generationInput: {},
    context: CONTEXT,
    knowledgeRoot: KNOWLEDGE_ROOT,
    runIndex: async () => {
      indexCalls += 1;
    },
  });

  assert.equal(indexCalls, 1);
  assert.equal(fs.existsSync(note.destination), true);
});

test("10. échec de génération ne lançant pas l’indexation", async () => {
  let indexCalls = 0;

  await assert.rejects(
    () =>
      generateWriteAndIndex({
        generate: async () => {
          throw new Error("génération simulée en échec");
        },
        generationInput: {},
        context: CONTEXT,
        knowledgeRoot: KNOWLEDGE_ROOT,
        runIndex: async () => {
          indexCalls += 1;
        },
      }),
    /génération simulée en échec/
  );
  assert.equal(indexCalls, 0);
});

test("réparation déterministe des métadonnées sans second appel", async () => {
  let modelCalls = 0;
  const incomplete = validMarkdown("Métadonnées réparées")
    .replace('topic: "cuisine"', "topic:")
    .replace(`source_id: "${SOURCE_URL}"`, "source_id:");
  const generated = await generateNoteDirect(
    {
      query: CONTEXT.query,
      sourceTitle: "Source",
      sourceUrl: SOURCE_URL,
      sourcePath: "data/raw/source.md",
      cleanedSource: CONTEXT.cleanedSource,
      requestedTopic: "",
      updated: CONTEXT.updated,
    },
    {
      model: "mock",
      callModel: async () => {
        modelCalls += 1;
        return incomplete;
      },
    }
  );
  const validation = validateGeneratedMarkdown(generated, CONTEXT);

  assert.equal(validation.valid, true, validation.errors.join(" | "));
  assert.equal(modelCalls, 1);
});

test("nettoyage recette conserve les quantités et retire la nutrition", () => {
  const cleaned = cleanSourceText(
    `Introduction longue
Détails de la Recette
Nutriment
Cholestérol
60 mg
Ingrédients clés
Chocolat noir (200 g)
Préparation
Cuire 30 minutes à 180 °C.
Astuces pour personnaliser
Publicité longue`,
    { query: "recette gâteau au chocolat" }
  );

  assert.match(cleaned, /200 g/);
  assert.match(cleaned, /30 minutes/);
  assert.doesNotMatch(cleaned, /60 mg/);
  assert.doesNotMatch(cleaned, /Publicité/);
});

async function main() {
  fs.mkdirSync(KNOWLEDGE_ROOT, { recursive: true });
  let failures = 0;

  try {
    for (const current of tests) {
      try {
        await current.callback();
        console.log(`OK - ${current.name}`);
      } catch (error) {
        failures += 1;
        console.error(`ECHEC - ${current.name}`);
        console.error(error.stack || error.message);
      }
    }
  } finally {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  }

  console.log(`\nRésultat : ${tests.length - failures}/${tests.length} tests réussis.`);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main();

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { atomicWriteFile } = require("../../scripts/shared/atomic-file");
const {
  parseJsonResponse,
  validateEvidence,
  validateFactsDocument,
} = require("../../scripts/legacy/facts-contract");
const {
  renderFactsMarkdown,
  shouldAllowCodeBlocks,
  validateMarkdownAgainstFacts,
} = require("../../scripts/legacy/markdown-from-facts");
const {
  buildSourceLines,
  extractFactsWithRepair,
} = require("../../scripts/legacy/extract-facts-with-ollama");
const {
  assessContent,
  detectContentProfile,
  getLevel,
} = require("../../scripts/check-source-adequacy");
const {
  selectWithAdequacy,
} = require("../../scripts/select-and-fetch-best-source");
const {
  generateValidatedMarkdown,
} = require("../../scripts/legacy/generate-note-from-facts");
const {
  executePipelineSteps,
} = require("../../scripts/legacy/run-research-pipeline");

const FIXTURES = path.join(__dirname, "..", "fixtures", "pipeline");

function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), "utf8");
}

function readJsonFixture(name) {
  return JSON.parse(readFixture(name));
}

function expectedContext(document) {
  return {
    query: document.query,
    topic: document.topic,
    profile: document.profile,
    sources: document.sources,
  };
}

function createCandidate(title, url) {
  return {
    title,
    parsedUrl: new URL(url),
    domain: new URL(url).hostname,
    type: "unknown",
    score: 55,
    level: "utile",
    decision: "garder",
    relevanceScore: 85,
    relevanceLevel: "forte",
    finalScore: 75,
  };
}

function createPipelineSteps() {
  return Array.from({ length: 6 }, (_, index) => ({
    number: index + 1,
    name: `Étape ${index + 1}`,
  }));
}

test("1. JSON Ollama invalide rejeté", () => {
  assert.throws(() => parseJsonResponse("{ invalid"), /JSON invalide/);
});

test("2. JSON presque valide corrigé une seule fois", async () => {
  const document = readJsonFixture("recipe-facts.json");
  const sourceText = readFixture("recipe-complete.md");
  const sourceLines = buildSourceLines(sourceText);
  const ollamaDocument = {
    ...document,
    facts: document.facts.map((fact) => {
      const line = sourceLines.find((item) =>
        item.text.includes(fact.evidence)
      );

      return {
        type: fact.type,
        content: fact.content,
        evidenceLineId: line.id,
        confidence: fact.confidence,
      };
    }),
  };
  let calls = 0;
  const result = await extractFactsWithRepair({
    prompt: "fixture",
    expected: expectedContext(document),
    sourceText,
    sourceLines,
    async generate() {
      calls += 1;
      return calls === 1 ? "{ invalid" : JSON.stringify(ollamaDocument);
    },
  });

  assert.equal(calls, 2);
  assert.equal(result.attempts, 2);
  assert.equal(result.document.facts.length >= 6, true);
});

test("3. JSON valide accepté", () => {
  const document = readJsonFixture("recipe-facts.json");
  const validated = validateFactsDocument(document);

  validateEvidence(validated, {
    "source-1": readFixture("recipe-complete.md"),
  });
  assert.equal(validated.profile, "recipe");
});

test("4. Fait sans source rejeté", () => {
  const document = readJsonFixture("recipe-facts.json");
  document.facts[0].sourceId = "source-inconnue";

  assert.throws(
    () => validateFactsDocument(document),
    /source inconnue/
  );
});

test("5. Tableau de faits vide rejeté", () => {
  const document = readJsonFixture("recipe-facts.json");
  document.facts = [];

  assert.throws(
    () => validateFactsDocument(document),
    /facts est vide sans justification/
  );
});

test("6. Critique SEO ou design non liée rejetée", () => {
  const document = readJsonFixture("recipe-facts.json");
  document.facts[0].content =
    "Le design du site devrait ajouter une section SEO.";

  assert.throws(
    () => validateFactsDocument(document),
    /critique SEO, design ou mise en page/
  );
});

test("7. Source recette complète acceptée", () => {
  const text = readFixture("recipe-complete.md");
  const query = "recette gâteau au chocolat";
  const profile = detectContentProfile(query, text);
  const assessment = assessContent(profile, text, query);

  assert.equal(profile, "recipe");
  assert.equal(getLevel(assessment.score), "adequate");
  assert.equal(
    Object.values(assessment.criticalCriteria).every(Boolean),
    true
  );
});

test("8. Source recette sans quantités rejetée", () => {
  const text = readFixture("recipe-no-quantities.md");
  const query = "recette gâteau au chocolat";
  const profile = detectContentProfile(query, text);
  const assessment = assessContent(profile, text, query);

  assert.equal(profile, "recipe");
  assert.equal(getLevel(assessment.score), "insufficient");
  assert.equal(assessment.criticalCriteria.quantitiesSufficient, false);
});

test("9. Source technique avec commandes acceptée", () => {
  const text = readFixture("technical-git.md");
  const query = "Git rebase pour débutants";
  const profile = detectContentProfile(query, text);
  const assessment = assessContent(profile, text, query);

  assert.equal(profile, "technical");
  assert.equal(getLevel(assessment.score), "adequate");
});

test("10. Source historique sans contenu réel rejetée", () => {
  const text = readFixture("historical-empty.md");
  const query = "histoire de la Révolution française";
  const profile = detectContentProfile(query, text);
  const assessment = assessContent(profile, text, query);

  assert.notEqual(getLevel(assessment.score), "adequate");
});

test("11. Candidate partial suivie d'une candidate adequate", (context) => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "knowledge-hub-selection-")
  );
  context.after(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });
  const candidates = [
    createCandidate("Partielle", "https://example.test/partial"),
    createCandidate("Adéquate", "https://example.test/adequate"),
  ];
  const attempts = [];
  const selection = selectWithAdequacy({
    options: {
      slug: "fixture",
      force: false,
      maxAttempts: 2,
    },
    topicDirectory: temporaryDirectory,
    selectedSourcePath: path.join(temporaryDirectory, "selected-source.md"),
    admissibleSources: candidates,
    query: "fixture",
    runFetchFn(_slug, _directory, url) {
      attempts.push(url);
      return {
        result: "Succès simulé",
        fetchedFile: {
          filename: url.endsWith("partial") ? "partial.md" : "adequate.md",
        },
      };
    },
    runAdequacyCheckFn(_slug, _directory, filename) {
      return filename === "partial.md"
        ? { level: "partial", score: 55, exitCode: 2 }
        : { level: "adequate", score: 85, exitCode: 0 };
    },
  });

  assert.equal(attempts.length, 2);
  assert.equal(selection.selectedAttempt.adequacyLevel, "adequate");
});

test("12. Aucune candidate adequate produit une erreur finale", (context) => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "knowledge-hub-no-selection-")
  );
  context.after(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  assert.throws(
    () =>
      selectWithAdequacy({
        options: {
          slug: "fixture",
          force: false,
          maxAttempts: 1,
        },
        topicDirectory: temporaryDirectory,
        selectedSourcePath: path.join(temporaryDirectory, "selected-source.md"),
        admissibleSources: [
          createCandidate("Partielle", "https://example.test/partial"),
        ],
        query: "fixture",
        runFetchFn() {
          return {
            result: "Succès simulé",
            fetchedFile: { filename: "partial.md" },
          };
        },
        runAdequacyCheckFn() {
          return { level: "partial", score: 50, exitCode: 2 };
        },
      }),
    /Aucune source adéquate/
  );
});

test("13. Fiche recette valide générée", () => {
  const document = readJsonFixture("recipe-facts.json");
  const generated = generateValidatedMarkdown(document, "recipe-facts.json");

  assert.match(generated.markdown, /^## Ingrédients et quantités$/m);
  assert.match(generated.markdown, /200 g de chocolat noir/);
  assert.match(generated.markdown, /25 minutes à 180 °C/);
  assert.deepEqual(generated.validation.errors, []);
});

test("14. Fiche Git avec blocs de code valide", () => {
  const document = readJsonFixture("git-facts.json");
  const generated = generateValidatedMarkdown(document, "git-facts.json");

  assert.match(generated.markdown, /```bash/);
  assert.match(generated.markdown, /git rebase --continue/);
  assert.match(generated.markdown, /git rebase --abort/);
});

test("15. Fiche historique avec chronologie valide", () => {
  const document = readJsonFixture("historical-facts.json");
  const generated = generateValidatedMarkdown(document, "historical-facts.json");

  assert.match(generated.markdown, /^## Chronologie$/m);
  assert.match(generated.markdown, /14 juillet 1789/);
  assert.match(generated.markdown, /Première République/);
});

test("16. Fiche principalement composée de placeholders rejetée", () => {
  const document = readJsonFixture("recipe-facts.json");
  const markdown = renderFactsMarkdown(document).replace(
    "Cette fiche regroupe les faits culinaires validés de la source sélectionnée.",
    "À compléter."
  );
  const validation = validateMarkdownAgainstFacts(markdown, document);

  assert.match(validation.errors.join(" | "), /placeholder interdit/);
});

test("17. Nombre inventé rejeté", () => {
  const document = readJsonFixture("recipe-facts.json");
  const markdown = renderFactsMarkdown(document).replace(
    "## Sources",
    "Cuire 30 minutes.\n\n## Sources"
  );
  const validation = validateMarkdownAgainstFacts(markdown, document);

  assert.match(validation.errors.join(" | "), /nombre absent des faits : 30minutes/);
});

test("18. Commande inventée rejetée", () => {
  const document = readJsonFixture("git-facts.json");
  const markdown = renderFactsMarkdown(document).replace(
    "git rebase --abort\n```",
    "git rebase --abort\ngit push --force\n```"
  );
  const validation = validateMarkdownAgainstFacts(markdown, document);

  assert.match(validation.errors.join(" | "), /commande absente des faits/);
});

test("19. Reformulation fidèle acceptée", () => {
  const document = readJsonFixture("recipe-facts.json");
  const markdown = renderFactsMarkdown(document).replace(
    "Faire fondre le chocolat noir avec le beurre.",
    "Faire fondre ensemble le beurre et le chocolat noir."
  );
  const validation = validateMarkdownAgainstFacts(markdown, document);

  assert.deepEqual(validation.errors, []);
});

test("20. Structure différente mais adaptée acceptée", () => {
  const document = readJsonFixture("recipe-facts.json");
  const markdown = `---
title: "Gâteau"
topic: "cuisine"
level: "beginner"
tags: []
source_type: "research_note"
source_id: "recipe-facts.json"
confidence: "medium"
status: "draft"
updated: ""
---

# Gâteau

## Produits

- 200 g de chocolat noir _(source-1, fact-1)_
- 100 g de beurre _(source-1, fact-2)_

## Méthode et cuisson

- Faire fondre ensemble le chocolat et le beurre. _(source-1, fact-3)_
- Mélanger le sucre et les oeufs. _(source-1, fact-4)_
- Cuire pendant 25 minutes à 180 °C. _(source-1, fact-5)_
- La recette donne 6 portions. _(source-1, fact-6)_

## Sources

- [Recette](https://example.test/recette)
`;
  const validation = validateMarkdownAgainstFacts(markdown, document);

  assert.deepEqual(validation.errors, []);
});

test("21. Chemins .md internes dans une recette : code désactivé", () => {
  const document = readJsonFixture("recipe-facts.json");
  document.sources[0].localFile = "notes.md/fetched/page.md";

  assert.equal(shouldAllowCodeBlocks(document), false);
});

test("22. Commandes Git : code activé", () => {
  const document = readJsonFixture("git-facts.json");

  assert.equal(shouldAllowCodeBlocks(document), true);
});

test("23. Échec d'extraction : aucune génération ni indexation", () => {
  const executed = [];

  assert.throws(
    () =>
      executePipelineSteps(createPipelineSteps(), {}, (step) => {
        executed.push(step.number);
        if (step.number === 4) {
          throw new Error("extraction invalide");
        }
      }),
    /extraction invalide/
  );
  assert.deepEqual(executed, [1, 2, 3, 4]);
});

test("24. Échec de génération : aucune indexation", () => {
  const executed = [];

  assert.throws(
    () =>
      executePipelineSteps(createPipelineSteps(), {}, (step) => {
        executed.push(step.number);
        if (step.number === 5) {
          throw new Error("génération invalide");
        }
      }),
    /génération invalide/
  );
  assert.deepEqual(executed, [1, 2, 3, 4, 5]);
});

test("25. Succès complet : indexation exactement une fois et code 0", () => {
  let indexCount = 0;
  const code = executePipelineSteps(createPipelineSteps(), {}, (step) => {
    if (step.number === 6) {
      indexCount += 1;
    }
  });

  assert.equal(code, 0);
  assert.equal(indexCount, 1);
});

test("26. Fichier existant préservé après une sortie invalide", (context) => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "knowledge-hub-preserve-")
  );
  context.after(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });
  const outputPath = path.join(temporaryDirectory, "existing.md");
  fs.writeFileSync(outputPath, "contenu valide", "utf8");
  const invalidDocument = readJsonFixture("recipe-facts.json");
  invalidDocument.facts[0].sourceId = "unknown";

  assert.throws(
    () => generateValidatedMarkdown(invalidDocument, "invalid.json"),
    /source inconnue/
  );
  assert.equal(fs.readFileSync(outputPath, "utf8"), "contenu valide");
});

test("27. Aucun fichier temporaire abandonné après erreur", (context) => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "knowledge-hub-atomic-")
  );
  context.after(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });
  const outputPath = path.join(temporaryDirectory, "existing.md");
  fs.writeFileSync(outputPath, "contenu valide", "utf8");

  assert.throws(
    () => atomicWriteFile(outputPath, "nouveau contenu"),
    /existe déjà/
  );
  assert.equal(
    fs.readdirSync(temporaryDirectory).some((name) => name.endsWith(".tmp")),
    false
  );
});

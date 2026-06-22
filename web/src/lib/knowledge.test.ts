import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { filterNotes, normalizeSearch } from "./filters";
import { normalizeEntry, parseNoteDocument, readKnowledgeIndex } from "./knowledge";
import { assertSafeSegment } from "./paths";
import {
  buildNoteMarkdown,
  createFixtureResolver,
  normalizeTopic,
  slugify,
  writeMovedNote,
} from "./knowledge-write";
import type { EditableNote, KnowledgeEntry } from "./types";

const temporaryDirectories: string[] = [];
const temp = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-hub-web-"));
  temporaryDirectories.push(directory);
  return directory;
};
afterEach(() => temporaryDirectories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));

const note: KnowledgeEntry = {
  path: "knowledge/cuisine/creme-brulee.md", filename: "creme-brulee.md", slug: "creme-brulee",
  title: "Crème brûlée", topic: "cuisine", level: "beginner", tags: ["dessert"],
  source_type: "manual", source_id: "", confidence: "medium", status: "draft",
  updated: "2026-06-14", headings: ["## Préparation"],
};

describe("lecture de l'index", () => {
  it("lit un index valide", () => {
    const file = path.join(temp(), "index.json");
    fs.writeFileSync(file, JSON.stringify({ generated_at: "date", files: [note] }));
    expect(readKnowledgeIndex(file).total_files).toBe(1);
  });
  it("signale un index absent", () => expect(() => readKnowledgeIndex(path.join(temp(), "absent.json"))).toThrow("INDEX_MISSING"));
  it("signale un index invalide", () => {
    const file = path.join(temp(), "index.json"); fs.writeFileSync(file, "{");
    expect(() => readKnowledgeIndex(file)).toThrow("INDEX_INVALID");
  });
  it("normalise une entrée incomplète", () => expect(normalizeEntry({ filename: "x.md" })).toMatchObject({ slug: "x", topic: "general", tags: [] }));
});

describe("lecture et protection", () => {
  it("refuse ../", () => expect(() => assertSafeSegment("../secret", "Slug")).toThrow());
  it("refuse un chemin absolu", () => expect(() => assertSafeSegment("C:\\secret", "Slug")).toThrow());
  it("charge une fiche Markdown", () => {
    const loaded = parseNoteDocument("---\ntitle: Test\ntags: [un, deux]\n---\n# Corps", "general", "test");
    expect(loaded).toMatchObject({ title: "Test", tags: ["un", "deux"], body: "# Corps" });
  });
});

describe("recherche et filtres", () => {
  it("recherche par titre", () => expect(filterNotes([note], { query: "brûlée" })).toHaveLength(1));
  it("recherche sans accents", () => expect(normalizeSearch("Crème brûlée")).toBe("creme brulee"));
  it("filtre par topic", () => expect(filterNotes([note], { topic: "cuisine" })).toHaveLength(1));
  it("filtre par tag", () => expect(filterNotes([note], { tag: "dessert" })).toHaveLength(1));
  it("combine recherche et filtres", () => expect(filterNotes([note], { query: "préparation", topic: "cuisine", tag: "dessert" })).toHaveLength(1));
});

describe("construction et déplacement", () => {
  const editable = (): EditableNote => ({
    originalTopic: "old", originalSlug: "old-note", title: "Nouvelle note", topic: "Nouveau Sujet",
    slug: "Ma Note sûre", tags: [" Un Tag ", "un tag"], level: "beginner", status: "draft",
    confidence: "medium", updated: "2026-06-14", source_type: "manual", source_id: "fixture", body: "# Contenu",
  });
  it("normalise le topic", () => expect(normalizeTopic("Développement Web")).toBe("developpement-web"));
  it("génère un slug sûr", () => expect(slugify("Ma fiche : été 2026")).toBe("ma-fiche-ete-2026"));
  it("construit le frontmatter", () => expect(buildNoteMarkdown({ ...editable(), topic: "test", slug: "x" })).toContain('tags: ["un-tag"]'));
  it("déplace une fiche simulée", () => {
    const root = temp(); const resolve = createFixtureResolver(root);
    const original = resolve("old", "old-note"); fs.mkdirSync(path.dirname(original), { recursive: true }); fs.writeFileSync(original, "ancien");
    const result = writeMovedNote(editable(), { resolveOriginalPath: resolve, resolveDestinationPath: resolve });
    expect(fs.existsSync(original)).toBe(false);
    expect(fs.existsSync(result.destinationPath)).toBe(true);
  });
  it("préserve l'ancien fichier si la fin du déplacement échoue", () => {
    const root = temp(); const resolve = createFixtureResolver(root);
    const original = resolve("old", "old-note"); fs.mkdirSync(path.dirname(original), { recursive: true }); fs.writeFileSync(original, "ancien");
    expect(() => writeMovedNote(editable(), {
      resolveOriginalPath: resolve, resolveDestinationPath: resolve,
      beforeRemoveOriginal: () => { throw new Error("simulation"); },
    })).toThrow("simulation");
    expect(fs.readFileSync(original, "utf8")).toBe("ancien");
    expect(fs.existsSync(resolve("nouveau-sujet", "ma-note-sure"))).toBe(false);
  });
});

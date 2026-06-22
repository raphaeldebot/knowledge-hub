import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { INDEX_SCRIPT, KNOWLEDGE_ROOT, PROJECT_ROOT, resolveExistingNotePath, resolveNotePath } from "./paths";
import type { EditableNote, NoteDocument } from "./types";

const ALLOWED_LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const ALLOWED_STATUSES = new Set(["draft", "reviewed", "archived"]);
const ALLOWED_CONFIDENCE = new Set(["low", "medium", "high"]);

export function slugify(value: string, fallback = "") {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return slug || fallback;
}

export function normalizeTopic(value: string) {
  return slugify(value, "general");
}

export function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => slugify(tag)).filter(Boolean))].slice(0, 20);
}

function quote(value: string) {
  return JSON.stringify(value);
}

export function buildNoteMarkdown(note: Omit<EditableNote, "originalTopic" | "originalSlug" | "sourceChangeConfirmed">) {
  const tags = normalizeTags(note.tags);
  return [
    "---",
    `title: ${quote(note.title.trim())}`,
    `topic: ${quote(note.topic)}`,
    `level: ${quote(note.level)}`,
    `tags: [${tags.map(quote).join(", ")}]`,
    `source_type: ${quote(note.source_type)}`,
    `source_id: ${quote(note.source_id)}`,
    `confidence: ${quote(note.confidence)}`,
    `status: ${quote(note.status)}`,
    `updated: ${quote(note.updated)}`,
    "---",
    "",
    note.body.trim(),
    "",
  ].join("\n");
}

export function validateEditableNote(input: EditableNote): EditableNote {
  const note = {
    ...input,
    title: input.title.trim(),
    topic: normalizeTopic(input.topic),
    slug: slugify(input.slug || input.title),
    tags: normalizeTags(input.tags),
    body: input.body.trim(),
  };

  if (!note.title || !note.slug || !note.body) throw new Error("Le titre, le slug et le contenu sont obligatoires.");
  if (!ALLOWED_LEVELS.has(note.level)) throw new Error("Niveau invalide.");
  if (!ALLOWED_STATUSES.has(note.status)) throw new Error("Statut invalide.");
  if (!ALLOWED_CONFIDENCE.has(note.confidence)) throw new Error("Confiance invalide.");
  if (note.updated && !/^\d{4}-\d{2}-\d{2}$/.test(note.updated)) throw new Error("La date doit utiliser le format AAAA-MM-JJ.");
  return note;
}

export function writeMovedNote(
  note: EditableNote,
  options: {
    resolveOriginalPath?: (topic: string, slug: string) => string;
    resolveDestinationPath?: (topic: string, slug: string) => string;
    beforeRemoveOriginal?: () => void;
  } = {},
) {
  const valid = validateEditableNote(note);
  const originalPath = (options.resolveOriginalPath ?? resolveExistingNotePath)(valid.originalTopic, valid.originalSlug);
  const destinationPath = (options.resolveDestinationPath ?? resolveNotePath)(valid.topic, valid.slug);
  const moving = path.resolve(originalPath) !== path.resolve(destinationPath);

  if (!fs.existsSync(originalPath)) throw new Error("La fiche d’origine n’existe plus.");
  if (moving && fs.existsSync(destinationPath)) throw new Error("Une fiche existe déjà à cette destination.");

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(destinationPath),
    `.${path.basename(destinationPath)}.${process.pid}-${Date.now()}.tmp`,
  );

  try {
    fs.writeFileSync(temporaryPath, buildNoteMarkdown(valid), { encoding: "utf8", flag: "wx" });
    fs.renameSync(temporaryPath, destinationPath);

    if (moving) {
      try {
        options.beforeRemoveOriginal?.();
        fs.unlinkSync(originalPath);
      } catch (error) {
        if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
        throw error;
      }
    }
  } catch (error) {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    throw error;
  }

  return {
    note: valid,
    destinationPath,
    relativePath: path.relative(PROJECT_ROOT, destinationPath).split(path.sep).join("/"),
  };
}

export function runIndexer() {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [INDEX_SCRIPT], {
      cwd: PROJECT_ROOT,
      shell: false,
      windowsHide: true,
      env: {
        NODE_ENV: process.env.NODE_ENV ?? "production",
        PATH: process.env.PATH ?? "",
        SystemRoot: process.env.SystemRoot ?? "",
        TEMP: process.env.TEMP ?? "",
      },
    });
    let errorOutput = "";
    child.stderr.on("data", (chunk) => { errorOutput += String(chunk); });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(errorOutput.trim() || `Indexation terminée avec le code ${code}.`)));
  });
}

export async function saveNote(note: EditableNote) {
  const original = (await import("./knowledge")).loadNote(note.originalTopic, note.originalSlug) as NoteDocument;
  const sourceChanged = original.source_type !== note.source_type || original.source_id !== note.source_id;
  if (sourceChanged && !note.sourceChangeConfirmed) {
    throw new Error("La modification de la source exige une confirmation explicite.");
  }
  const result = writeMovedNote(note);
  try {
    await runIndexer();
    return { ...result, indexed: true, warning: "" };
  } catch (error) {
    return {
      ...result,
      indexed: false,
      warning: error instanceof Error ? error.message : "La réindexation a échoué.",
    };
  }
}

export function createFixtureResolver(root: string) {
  return (topic: string, slug: string) => {
    const safeTopic = normalizeTopic(topic);
    const safeSlug = slugify(slug);
    const candidate = path.resolve(root, safeTopic, `${safeSlug}.md`);
    const relative = path.relative(root, candidate);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Chemin de fixture invalide.");
    return candidate;
  };
}

export { KNOWLEDGE_ROOT };

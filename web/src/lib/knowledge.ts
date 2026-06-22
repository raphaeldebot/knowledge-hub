import fs from "node:fs";
import matter from "gray-matter";
import { INDEX_PATH, resolveExistingNotePath } from "./paths";
import type { KnowledgeEntry, KnowledgeIndex, NoteDocument } from "./types";

const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
const list = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function normalizeEntry(value: unknown): KnowledgeEntry {
  const entry = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const filename = text(entry.filename);
  return {
    path: text(entry.path),
    filename,
    slug: text(entry.slug, filename.replace(/\.md$/i, "")),
    title: text(entry.title, "Sans titre"),
    topic: text(entry.topic, "general"),
    level: text(entry.level, "beginner"),
    tags: list(entry.tags),
    source_type: text(entry.source_type, "manual"),
    source_id: text(entry.source_id),
    confidence: text(entry.confidence, "medium"),
    status: text(entry.status, "draft"),
    updated: text(entry.updated),
    headings: list(entry.headings),
  };
}

export function readKnowledgeIndex(indexPath = INDEX_PATH): KnowledgeIndex {
  if (!fs.existsSync(indexPath)) {
    throw new Error("INDEX_MISSING");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  } catch {
    throw new Error("INDEX_INVALID");
  }

  if (!parsed || typeof parsed !== "object") throw new Error("INDEX_INVALID");
  const value = parsed as Record<string, unknown>;
  if (!Array.isArray(value.files)) throw new Error("INDEX_INVALID");
  const files = value.files.map(normalizeEntry);

  return {
    generated_at: text(value.generated_at),
    total_files: files.length,
    files,
  };
}

export function loadNote(topic: string, slug: string): NoteDocument {
  const notePath = resolveExistingNotePath(topic, slug);
  if (!fs.existsSync(notePath)) throw new Error("NOTE_MISSING");

  return parseNoteDocument(fs.readFileSync(notePath, "utf8"), topic, slug);
}

export function parseNoteDocument(markdown: string, topic: string, slug: string): NoteDocument {
  const parsed = matter(markdown);
  const filename = `${slug}.md`;
  const headings = parsed.content
    .split(/\r?\n/)
    .filter((line) => /^#{1,6}\s+\S/.test(line))
    .map((line) => line.trim());

  return {
    path: `knowledge/${topic}/${filename}`,
    filename,
    slug,
    title: text(parsed.data.title, "Sans titre"),
    topic: text(parsed.data.topic, topic),
    level: text(parsed.data.level, "beginner"),
    tags: list(parsed.data.tags),
    source_type: text(parsed.data.source_type, "manual"),
    source_id: text(parsed.data.source_id),
    confidence: text(parsed.data.confidence, "medium"),
    status: text(parsed.data.status, "draft"),
    updated: text(parsed.data.updated),
    headings,
    body: parsed.content.trim(),
  };
}

export function uniqueValues(notes: KnowledgeEntry[], key: keyof KnowledgeEntry) {
  return [...new Set(notes.flatMap((note) => {
    const value = note[key];
    return Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
  }))].sort((a, b) => a.localeCompare(b, "fr"));
}

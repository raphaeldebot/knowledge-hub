import type { KnowledgeEntry, NoteFilters } from "./types";

export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .trim();
}

export function filterNotes(notes: KnowledgeEntry[], filters: NoteFilters) {
  const query = normalizeSearch(filters.query ?? "");

  return notes.filter((note) => {
    const searchable = normalizeSearch(
      [
        note.title,
        note.topic,
        note.tags.join(" "),
        note.headings.join(" "),
        note.slug,
        note.filename,
      ].join(" "),
    );

    return (
      (!query || searchable.includes(query)) &&
      (!filters.topic || note.topic === filters.topic) &&
      (!filters.tag || note.tags.includes(filters.tag)) &&
      (!filters.level || note.level === filters.level) &&
      (!filters.status || note.status === filters.status) &&
      (!filters.confidence || note.confidence === filters.confidence)
    );
  });
}

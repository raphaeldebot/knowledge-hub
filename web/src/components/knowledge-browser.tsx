"use client";

import { useMemo, useState } from "react";
import { filterNotes } from "@/lib/filters";
import { NoteCard } from "./note-card";
import { EmptyState } from "./empty-state";
import type { KnowledgeEntry } from "@/lib/types";

const options = (notes: KnowledgeEntry[], getter: (note: KnowledgeEntry) => string[]) =>
  [...new Set(notes.flatMap(getter).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));

export function KnowledgeBrowser({ notes, initialTopic = "" }: { notes: KnowledgeEntry[]; initialTopic?: string }) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState(initialTopic);
  const [tag, setTag] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState("");
  const [confidence, setConfidence] = useState("");
  const filtered = useMemo(() => filterNotes(notes, { query, topic, tag, level, status, confidence }), [notes, query, topic, tag, level, status, confidence]);
  const reset = () => { setQuery(""); setTopic(""); setTag(""); setLevel(""); setStatus(""); setConfidence(""); };
  const selectClass = "field min-w-36";

  return (
    <section>
      <div className="card mb-6 grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6">
        <input className="field md:col-span-2 xl:col-span-2" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher dans les fiches..." />
        <select className={selectClass} value={topic} onChange={(event) => setTopic(event.target.value)}><option value="">Tous les topics</option>{options(notes, (note) => [note.topic]).map((value) => <option key={value}>{value}</option>)}</select>
        <select className={selectClass} value={tag} onChange={(event) => setTag(event.target.value)}><option value="">Tous les tags</option>{options(notes, (note) => note.tags).map((value) => <option key={value}>{value}</option>)}</select>
        <select className={selectClass} value={level} onChange={(event) => setLevel(event.target.value)}><option value="">Tous les niveaux</option>{options(notes, (note) => [note.level]).map((value) => <option key={value}>{value}</option>)}</select>
        <select className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tous les statuts</option>{options(notes, (note) => [note.status]).map((value) => <option key={value}>{value}</option>)}</select>
        <select className={selectClass} value={confidence} onChange={(event) => setConfidence(event.target.value)}><option value="">Toutes confiances</option>{options(notes, (note) => [note.confidence]).map((value) => <option key={value}>{value}</option>)}</select>
        <div className="flex items-center justify-between md:col-span-2 xl:col-span-5">
          <p className="text-sm text-slate-400">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</p>
          <button className="button-secondary" type="button" onClick={reset}>Réinitialiser</button>
        </div>
      </div>
      {filtered.length ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{filtered.map((note) => <NoteCard note={note} key={note.path} />)}</div>
      ) : <EmptyState title="Aucune fiche trouvée">Modifiez la recherche ou réinitialisez les filtres.</EmptyState>}
    </section>
  );
}

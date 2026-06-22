import Link from "next/link";
import { Badge } from "./badge";
import type { KnowledgeEntry } from "@/lib/types";

export function NoteCard({ note }: { note: KnowledgeEntry }) {
  return (
    <article className="card group flex h-full flex-col p-5">
      <div className="flex flex-wrap gap-2">
        <Badge tone="accent">{note.topic}</Badge>
        <Badge>{note.status}</Badge>
        <Badge tone="muted">{note.confidence}</Badge>
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-100 group-hover:text-cyan-300">
        <Link href={`/note/${encodeURIComponent(note.topic)}/${encodeURIComponent(note.slug)}`}>
          {note.title}
        </Link>
      </h2>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">
        {note.headings.slice(0, 3).map((heading) => heading.replace(/^#+\s*/, "")).join(" · ") || "Aucun aperçu disponible."}
      </p>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-5">
        {note.tags.slice(0, 5).map((tag) => <Badge key={tag}>{tag}</Badge>)}
      </div>
      <div className="mt-4 flex justify-between text-xs text-slate-600">
        <span>{note.level}</span><span>{note.updated || "Date inconnue"}</span>
      </div>
    </article>
  );
}

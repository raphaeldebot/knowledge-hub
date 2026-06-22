import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/badge";
import { MarkdownContent } from "@/components/markdown-content";
import { loadNote } from "@/lib/knowledge";

export const dynamic = "force-dynamic";

export default async function NotePage({ params }: { params: Promise<{ topic: string; slug: string }> }) {
  const { topic, slug } = await params;
  let note;
  try { note = loadNote(topic, slug); } catch { notFound(); }
  const sourceIsUrl = /^https?:\/\//.test(note.source_id);

  return (
    <article className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link className="button-secondary" href="/">← Retour</Link>
        <Link className="button-primary" href={`/note/${encodeURIComponent(topic)}/${encodeURIComponent(slug)}/edit`}>Modifier</Link>
      </div>
      <header className="card p-6 sm:p-8">
        <div className="flex flex-wrap gap-2"><Badge tone="accent">{note.topic}</Badge><Badge>{note.status}</Badge><Badge>{note.level}</Badge><Badge tone="muted">{note.confidence}</Badge></div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">{note.title}</h1>
        <div className="mt-5 flex flex-wrap gap-2">{note.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div>
        <dl className="mt-6 grid gap-3 border-t border-slate-800 pt-5 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-600">Mise à jour</dt><dd className="text-slate-300">{note.updated || "Inconnue"}</dd></div>
          <div><dt className="text-slate-600">Source</dt><dd className="break-all text-slate-300">{sourceIsUrl ? <a className="text-cyan-400 hover:underline" href={note.source_id} target="_blank" rel="noreferrer noopener">{note.source_id}</a> : note.source_id || "Non renseignée"}</dd></div>
        </dl>
      </header>
      <div className="card mt-5 p-6 sm:p-9"><MarkdownContent>{note.body}</MarkdownContent></div>
    </article>
  );
}

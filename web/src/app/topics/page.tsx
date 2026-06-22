import Link from "next/link";
import { Badge } from "@/components/badge";
import { readKnowledgeIndex } from "@/lib/knowledge";

export const dynamic = "force-dynamic";

export default function TopicsPage() {
  const notes = readKnowledgeIndex().files;
  const topics = [...new Set(notes.map((note) => note.topic))].sort((a, b) => a.localeCompare(b, "fr"));

  return (
    <div className="mx-auto max-w-6xl">
      <p className="eyebrow">Organisation</p><h1 className="page-title">Topics</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {topics.map((topic) => {
          const topicNotes = notes.filter((note) => note.topic === topic);
          const tags = [...new Set(topicNotes.flatMap((note) => note.tags))].slice(0, 6);
          return (
            <article className="card p-5" key={topic}>
              <div className="flex items-center justify-between"><h2 className="text-xl font-semibold text-white">{topic}</h2><Badge tone="accent">{topicNotes.length} fiche{topicNotes.length > 1 ? "s" : ""}</Badge></div>
              <div className="mt-4 flex flex-wrap gap-2">{tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div>
              <ul className="mt-5 space-y-2 text-sm text-slate-400">{topicNotes.slice(0, 3).map((note) => <li key={note.path}>{note.title}</li>)}</ul>
              <Link className="mt-5 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300" href={`/?topic=${encodeURIComponent(topic)}`}>Voir les fiches →</Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}

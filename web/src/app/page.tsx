import { KnowledgeBrowser } from "@/components/knowledge-browser";
import { readKnowledgeIndex, uniqueValues } from "@/lib/knowledge";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  let index;
  try {
    index = readKnowledgeIndex();
  } catch (error) {
    const missing = error instanceof Error && error.message === "INDEX_MISSING";
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="page-title">Knowledge Hub</h1>
        <div className="card mt-8 p-6 text-slate-300">
          <p>{missing ? "L’index est absent." : "L’index est invalide."}</p>
          <code className="mt-4 block rounded-lg bg-black p-4 text-cyan-300">node scripts/index-knowledge.js</code>
        </div>
      </div>
    );
  }
  const params = await searchParams;
  const tags = uniqueValues(index.files, "tags");
  const topics = uniqueValues(index.files, "topic");

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-8">
        <p className="eyebrow">Base locale</p>
        <h1 className="page-title">Knowledge Hub</h1>
        <p className="mt-3 max-w-2xl text-slate-400">Parcourez, recherchez et maintenez vos fiches Markdown sans quitter votre machine.</p>
      </header>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Fiches" value={index.files.length} />
        <Stat label="Topics" value={topics.length} />
        <Stat label="Tags" value={tags.length} />
        <Stat label="Index généré" value={index.generated_at ? new Date(index.generated_at).toLocaleString("fr-BE") : "Inconnu"} />
      </div>
      <KnowledgeBrowser notes={index.files} initialTopic={params.topic ?? ""} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="card p-4"><p className="text-xs uppercase tracking-widest text-slate-600">{label}</p><p className="mt-2 text-xl font-semibold text-slate-100">{value}</p></div>;
}

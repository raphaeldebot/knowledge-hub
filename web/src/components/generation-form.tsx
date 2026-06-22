"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Job = {
  id: string; status: "pending" | "running" | "success" | "error";
  model: string; startedAt: string; finishedAt: string; lines: string[];
  error: string; notePath: string; noteUrl: string;
};

export function GenerationForm() {
  const [query, setQuery] = useState("");
  const [model, setModel] = useState("qwen3:14b");
  const [force, setForce] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!job || !["pending", "running"].includes(job.status)) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/generation/${job.id}`, { cache: "no-store" });
      if (response.ok) setJob(await response.json());
    }, 1500);
    return () => window.clearInterval(timer);
  }, [job]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/generation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, model, force }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Lancement impossible.");
    else setJob(result);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.75fr)]">
      <form className="card space-y-5 p-6" onSubmit={submit}>
        <label className="block text-sm text-slate-400"><span className="mb-2 block">Requête</span><textarea className="field min-h-40 resize-y" required maxLength={500} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex. comprendre les bases de Docker Compose" /></label>
        <label className="block text-sm text-slate-400"><span className="mb-2 block">Modèle Ollama</span><select className="field" value={model} onChange={(event) => setModel(event.target.value)}><option>qwen3:14b</option><option>qwen2.5:7b</option></select></label>
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} />Autoriser le remplacement produit par le pipeline (`--force`)</label>
        <button className="button-primary" disabled={job?.status === "running"}>Lancer la génération</button>
        {error && <p className="text-sm text-rose-300">{error}</p>}
      </form>
      <section className="card p-6">
        <p className="eyebrow">Suivi</p>
        {!job ? <p className="mt-5 text-sm text-slate-500">Aucun job lancé dans cette session.</p> : (
          <div className="mt-5 space-y-4 text-sm">
            <p><span className="text-slate-500">Statut :</span> <strong className="text-cyan-300">{job.status}</strong></p>
            <p><span className="text-slate-500">Modèle :</span> {job.model}</p>
            <p><span className="text-slate-500">Début :</span> {job.startedAt ? new Date(job.startedAt).toLocaleString("fr-BE") : "En attente"}</p>
            {job.lines.length > 0 && <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-black p-4 text-xs leading-5 text-slate-400">{job.lines.join("\n")}</pre>}
            {job.error && <p className="rounded-lg border border-rose-900 bg-rose-950/40 p-3 text-rose-300">{job.error}</p>}
            {job.noteUrl && <div><p className="mb-3 break-all text-slate-400">{job.notePath}</p><Link className="button-primary inline-block" href={job.noteUrl}>Ouvrir la fiche</Link></div>}
          </div>
        )}
      </section>
    </div>
  );
}

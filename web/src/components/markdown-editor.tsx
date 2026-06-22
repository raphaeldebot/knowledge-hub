"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MarkdownContent } from "./markdown-content";
import type { EditableNote } from "@/lib/types";

export function MarkdownEditor({ initialNote }: { initialNote: EditableNote }) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [allowSourceEdit, setAllowSourceEdit] = useState(false);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (key: keyof EditableNote, value: string | string[]) => {
    setNote((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setMessage("");
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/notes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...note, sourceChangeConfirmed: allowSourceEdit }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Sauvegarde impossible.");
      setDirty(false);
      if (result.warning) setMessage(`Fiche sauvegardée. Réindexation en échec : ${result.warning}`);
      router.push(`/note/${encodeURIComponent(result.topic)}/${encodeURIComponent(result.slug)}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sauvegarde impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="card space-y-4 p-5">
          <Field label="Titre"><input className="field" value={note.title} onChange={(event) => update("title", event.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Topic"><input className="field" value={note.topic} onChange={(event) => update("topic", event.target.value)} /></Field>
            <Field label="Slug"><input className="field" value={note.slug} onChange={(event) => update("slug", event.target.value)} /></Field>
          </div>
          <Field label="Tags (séparés par des virgules)"><input className="field" value={note.tags.join(", ")} onChange={(event) => update("tags", event.target.value.split(","))} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Niveau" value={note.level} values={["beginner", "intermediate", "advanced"]} onChange={(value) => update("level", value)} />
            <Select label="Statut" value={note.status} values={["draft", "reviewed", "archived"]} onChange={(value) => update("status", value)} />
            <Select label="Confiance" value={note.confidence} values={["low", "medium", "high"]} onChange={(value) => update("confidence", value)} />
          </div>
          <Field label="Date de mise à jour"><input className="field" type="date" value={note.updated} onChange={(event) => update("updated", event.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm text-amber-300"><input type="checkbox" checked={allowSourceEdit} onChange={(event) => setAllowSourceEdit(event.target.checked)} />Autoriser explicitement la modification de la source</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type de source"><input className="field disabled:opacity-50" disabled={!allowSourceEdit} value={note.source_type} onChange={(event) => update("source_type", event.target.value)} /></Field>
            <Field label="Identifiant de source"><input className="field disabled:opacity-50" disabled={!allowSourceEdit} value={note.source_id} onChange={(event) => update("source_id", event.target.value)} /></Field>
          </div>
          <Field label="Markdown"><textarea className="field min-h-[34rem] resize-y font-mono text-sm leading-6" value={note.body} onChange={(event) => update("body", event.target.value)} /></Field>
        </section>
        <section className="card min-h-[40rem] p-6"><p className="eyebrow">Aperçu</p><MarkdownContent>{note.body}</MarkdownContent></section>
      </div>
      <div className="sticky bottom-4 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
        <p className={`text-sm ${message.includes("échec") || message.includes("impossible") ? "text-amber-300" : "text-slate-400"}`}>{message || (dirty ? "Modifications non sauvegardées" : "Aucune modification")}</p>
        <div className="flex gap-2"><button type="button" className="button-secondary" onClick={() => router.back()}>Annuler</button><button className="button-primary" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</button></div>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm text-slate-400"><span className="mb-2 block">{label}</span>{children}</label>;
}

function Select({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <Field label={label}><select className="field" value={value} onChange={(event) => onChange(event.target.value)}>{values.map((item) => <option key={item}>{item}</option>)}</select></Field>;
}

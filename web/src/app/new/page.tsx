import { GenerationForm } from "@/components/generation-form";

export default function NewResearchPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <p className="eyebrow">Pipeline MVP local</p><h1 className="page-title">Nouvelle recherche</h1>
      <p className="mb-8 mt-3 max-w-2xl text-slate-400">Lance le pipeline recommandé avec Ollama. Une seule génération peut être active à la fois.</p>
      <GenerationForm />
    </div>
  );
}

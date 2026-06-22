import Link from "next/link";

export default function NotFound() {
  return <div className="card mx-auto max-w-xl p-8 text-center"><h1 className="text-2xl font-semibold">Fiche introuvable</h1><p className="mt-2 text-slate-500">Elle a peut-être été déplacée ou renommée.</p><Link className="button-primary mt-5 inline-block" href="/">Retour aux fiches</Link></div>;
}

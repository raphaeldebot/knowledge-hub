"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="card mx-auto max-w-xl p-8 text-center"><h1 className="text-xl font-semibold">Une erreur est survenue</h1><p className="mt-2 text-slate-500">L’opération locale n’a pas pu aboutir.</p><button className="button-primary mt-5" onClick={reset}>Réessayer</button></div>;
}

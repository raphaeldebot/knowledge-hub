import Link from "next/link";
import { ReindexButton } from "./reindex-button";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
      <aside className="border-b border-slate-800 bg-slate-950/80 p-5 backdrop-blur md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          Knowledge Hub
        </Link>
        <p className="mt-1 text-xs text-slate-500">Local. Sourcé. Modifiable.</p>
        <nav className="mt-5 flex gap-2 md:flex-col">
          <Link className="nav-link" href="/">Fiches</Link>
          <Link className="nav-link" href="/topics">Topics</Link>
          <Link className="nav-link" href="/new">Nouvelle recherche</Link>
        </nav>
        <div className="mt-5 md:absolute md:bottom-5 md:left-5 md:right-5"><ReindexButton /></div>
      </aside>
      <main className="min-w-0 p-5 sm:p-8 lg:p-12">{children}</main>
    </div>
  );
}

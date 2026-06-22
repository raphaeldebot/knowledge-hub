export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-200">{title}</h2>
      <div className="mt-2 text-sm text-slate-500">{children}</div>
    </div>
  );
}

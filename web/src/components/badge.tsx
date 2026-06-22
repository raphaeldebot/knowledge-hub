export function Badge({ children, tone = "default" }: {
  children: React.ReactNode;
  tone?: "default" | "accent" | "muted";
}) {
  const tones = {
    default: "border-slate-700 bg-slate-900 text-slate-300",
    accent: "border-cyan-800/80 bg-cyan-950/60 text-cyan-300",
    muted: "border-slate-800 bg-slate-950 text-slate-500",
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${tones[tone]}`}>
      {children}
    </span>
  );
}

"use client";

import { useState } from "react";

export function ReindexButton() {
  const [message, setMessage] = useState("");
  async function run() {
    setMessage("Indexation...");
    const response = await fetch("/api/index", { method: "POST" });
    const result = await response.json();
    setMessage(response.ok ? "Index régénéré" : result.error || "Échec");
  }
  return <div><button className="button-secondary w-full" onClick={run}>Régénérer l’index</button>{message && <p className="mt-2 text-center text-xs text-slate-500">{message}</p>}</div>;
}

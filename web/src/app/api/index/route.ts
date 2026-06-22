import { NextResponse } from "next/server";
import { runIndexer } from "@/lib/knowledge-write";

export const runtime = "nodejs";

export async function POST() {
  try {
    await runIndexer();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Indexation impossible." },
      { status: 500 },
    );
  }
}

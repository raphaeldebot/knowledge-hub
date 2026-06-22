import { NextResponse } from "next/server";
import { createGenerationJob } from "@/lib/generation-jobs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { query?: string; model?: string; force?: boolean };
    const job = createGenerationJob({
      query: payload.query ?? "",
      model: payload.model ?? "",
      force: Boolean(payload.force),
    });
    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lancement refusé." },
      { status: 400 },
    );
  }
}

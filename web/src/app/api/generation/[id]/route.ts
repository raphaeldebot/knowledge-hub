import { NextResponse } from "next/server";
import { getGenerationJob } from "@/lib/generation-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getGenerationJob(id);
  return job
    ? NextResponse.json(job)
    : NextResponse.json({ error: "Job introuvable." }, { status: 404 });
}

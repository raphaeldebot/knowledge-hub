import { NextResponse } from "next/server";
import { saveNote } from "@/lib/knowledge-write";
import type { EditableNote } from "@/lib/types";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const payload = await request.json() as EditableNote;
    const result = await saveNote(payload);
    return NextResponse.json({
      ok: true,
      topic: result.note.topic,
      slug: result.note.slug,
      path: result.relativePath,
      indexed: result.indexed,
      warning: result.warning,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sauvegarde refusée." },
      { status: 400 },
    );
  }
}

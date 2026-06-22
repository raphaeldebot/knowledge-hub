import { notFound } from "next/navigation";
import { MarkdownEditor } from "@/components/markdown-editor";
import { loadNote } from "@/lib/knowledge";

export const dynamic = "force-dynamic";

export default async function EditNotePage({ params }: { params: Promise<{ topic: string; slug: string }> }) {
  const { topic, slug } = await params;
  let note;
  try { note = loadNote(topic, slug); } catch { notFound(); }

  return (
    <div className="mx-auto max-w-[1600px]">
      <p className="eyebrow">Édition locale</p><h1 className="page-title mb-8">Modifier la fiche</h1>
      <MarkdownEditor initialNote={{ ...note, originalTopic: topic, originalSlug: slug }} />
    </div>
  );
}

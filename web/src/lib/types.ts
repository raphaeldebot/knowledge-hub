export type KnowledgeEntry = {
  path: string;
  filename: string;
  slug: string;
  title: string;
  topic: string;
  level: string;
  tags: string[];
  source_type: string;
  source_id: string;
  confidence: string;
  status: string;
  updated: string;
  headings: string[];
};

export type KnowledgeIndex = {
  generated_at: string;
  total_files: number;
  files: KnowledgeEntry[];
};

export type NoteDocument = KnowledgeEntry & {
  body: string;
};

export type NoteFilters = {
  query?: string;
  topic?: string;
  tag?: string;
  level?: string;
  status?: string;
  confidence?: string;
};

export type EditableNote = {
  originalTopic: string;
  originalSlug: string;
  title: string;
  topic: string;
  slug: string;
  tags: string[];
  level: string;
  status: string;
  confidence: string;
  updated: string;
  source_type: string;
  source_id: string;
  body: string;
  sourceChangeConfirmed?: boolean;
};

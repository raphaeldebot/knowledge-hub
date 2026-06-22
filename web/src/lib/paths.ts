import fs from "node:fs";
import path from "node:path";

export const PROJECT_ROOT = path.resolve(process.cwd(), "..");
export const KNOWLEDGE_ROOT = path.join(PROJECT_ROOT, "knowledge");
export const INDEX_PATH = path.join(
  PROJECT_ROOT,
  "data",
  "processed",
  "knowledge-index.json",
);
export const INDEX_SCRIPT = path.join(
  PROJECT_ROOT,
  "scripts",
  "index-knowledge.js",
);
export const MVP_SCRIPT = path.join(
  PROJECT_ROOT,
  "scripts",
  "run-research-mvp.js",
);

function isInside(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function assertSafeSegment(value: string, label: string) {
  const normalized = value.trim();
  if (
    !normalized ||
    normalized === "." ||
    normalized === ".." ||
    path.isAbsolute(normalized) ||
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.includes("..")
  ) {
    throw new Error(`${label} invalide.`);
  }
  return normalized;
}

function assertExistingAncestorInside(candidate: string) {
  const realRoot = fs.realpathSync(KNOWLEDGE_ROOT);
  let current = path.dirname(candidate);

  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) throw new Error("Chemin de fiche invalide.");
    current = parent;
  }

  const realAncestor = fs.realpathSync(current);
  if (realAncestor !== realRoot && !isInside(realRoot, realAncestor)) {
    throw new Error("Le chemin sort du dossier knowledge.");
  }
}

export function resolveNotePath(topic: string, slug: string) {
  const safeTopic = assertSafeSegment(topic, "Topic");
  const safeSlug = assertSafeSegment(slug, "Slug");
  const candidate = path.resolve(KNOWLEDGE_ROOT, safeTopic, `${safeSlug}.md`);

  if (!isInside(KNOWLEDGE_ROOT, candidate)) {
    throw new Error("Le chemin sort du dossier knowledge.");
  }

  assertExistingAncestorInside(candidate);

  if (fs.existsSync(candidate)) {
    const realCandidate = fs.realpathSync(candidate);
    const realRoot = fs.realpathSync(KNOWLEDGE_ROOT);
    if (!isInside(realRoot, realCandidate)) {
      throw new Error("Le fichier cible est un lien sortant non autorisé.");
    }
  }

  return candidate;
}

export function resolveExistingNotePath(topic: string, slug: string) {
  const safeTopic = assertSafeSegment(topic, "Topic");
  const safeSlug = assertSafeSegment(slug, "Slug");

  if (fs.existsSync(INDEX_PATH)) {
    try {
      const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8")) as {
        files?: Array<{ topic?: string; slug?: string; path?: string }>;
      };
      const entry = index.files?.find((item) => item.topic === safeTopic && item.slug === safeSlug);
      if (entry?.path) {
        const candidate = path.resolve(PROJECT_ROOT, entry.path);
        const relative = path.relative(KNOWLEDGE_ROOT, candidate);
        if (!relative.startsWith("..") && !path.isAbsolute(relative) && fs.existsSync(candidate)) {
          const realRoot = fs.realpathSync(KNOWLEDGE_ROOT);
          const realCandidate = fs.realpathSync(candidate);
          if (isInside(realRoot, realCandidate)) return candidate;
        }
      }
    } catch {
      // The regular topic/slug location remains the safe fallback.
    }
  }

  return resolveNotePath(safeTopic, safeSlug);
}

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { INDEX_PATH, MVP_SCRIPT, PROJECT_ROOT } from "./paths";

export const ALLOWED_MODELS = ["qwen3:14b", "qwen2.5:7b"] as const;
export type AllowedModel = (typeof ALLOWED_MODELS)[number];
export type JobStatus = "pending" | "running" | "success" | "error";

export type GenerationJob = {
  id: string;
  query: string;
  model: AllowedModel;
  force: boolean;
  status: JobStatus;
  createdAt: string;
  startedAt: string;
  finishedAt: string;
  lines: string[];
  error: string;
  notePath: string;
  noteUrl: string;
};

type JobStore = {
  jobs: Map<string, GenerationJob>;
  activeId: string;
};

const globalJobs = globalThis as typeof globalThis & { knowledgeHubJobs?: JobStore };
const store = globalJobs.knowledgeHubJobs ?? { jobs: new Map(), activeId: "" };
globalJobs.knowledgeHubJobs = store;

export function buildMvpArguments(query: string, force: boolean) {
  const normalized = query.trim();
  if (!normalized || normalized.length > 500) throw new Error("La requête doit contenir entre 1 et 500 caractères.");
  return [MVP_SCRIPT, normalized, ...(force ? ["--force"] : [])];
}

export function assertAllowedModel(model: string): asserts model is AllowedModel {
  if (!ALLOWED_MODELS.includes(model as AllowedModel)) throw new Error("Modèle non autorisé.");
}

function publicJob(job: GenerationJob) {
  return { ...job, query: job.query.slice(0, 160) };
}

function appendOutput(job: GenerationJob, chunk: unknown) {
  const next = String(chunk)
    .replace(/\x1b\[[0-9;]*m/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  job.lines = [...job.lines, ...next].slice(-12);
}

function findGeneratedNote(job: GenerationJob) {
  const line = [...job.lines].reverse().find((item) => /^Fiche\s*:\s*knowledge\//i.test(item));
  const notePath = line?.replace(/^Fiche\s*:\s*/i, "").replace(/\\/g, "/") ?? "";
  if (!/^knowledge\/[^/]+\/[^/]+\.md$/.test(notePath)) throw new Error("Le pipeline n’a pas retourné une fiche exploitable.");

  const absolute = path.resolve(PROJECT_ROOT, notePath);
  if (!fs.existsSync(absolute)) throw new Error("La fiche annoncée par le pipeline est absente.");
  if (!fs.existsSync(INDEX_PATH)) throw new Error("L’index est absent après la génération.");
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8")) as { files?: Array<{ path?: string }> };
  if (!index.files?.some((entry) => entry.path === notePath)) throw new Error("La fiche générée est absente de l’index.");

  const [, topic, filename] = notePath.split("/");
  job.notePath = notePath;
  job.noteUrl = `/note/${encodeURIComponent(topic)}/${encodeURIComponent(filename.replace(/\.md$/i, ""))}`;
}

export function createGenerationJob(
  input: { query: string; model: string; force: boolean },
  spawnProcess: typeof spawn = spawn,
) {
  if (store.activeId) {
    const active = store.jobs.get(store.activeId);
    if (active && (active.status === "pending" || active.status === "running")) {
      throw new Error("Une génération est déjà active.");
    }
  }
  assertAllowedModel(input.model);
  const args = buildMvpArguments(input.query, input.force);
  const job: GenerationJob = {
    id: randomUUID(),
    query: input.query.trim(),
    model: input.model,
    force: Boolean(input.force),
    status: "pending",
    createdAt: new Date().toISOString(),
    startedAt: "",
    finishedAt: "",
    lines: [],
    error: "",
    notePath: "",
    noteUrl: "",
  };
  store.jobs.set(job.id, job);
  store.activeId = job.id;

  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawnProcess(process.execPath, args, {
      cwd: PROJECT_ROOT,
      shell: false,
      windowsHide: true,
      env: {
        NODE_ENV: process.env.NODE_ENV ?? "production",
        PATH: process.env.PATH ?? "",
        SystemRoot: process.env.SystemRoot ?? "",
        TEMP: process.env.TEMP ?? "",
        OLLAMA_MODEL: job.model,
      },
    }) as ChildProcessWithoutNullStreams;
  } catch (error) {
    job.status = "error";
    job.error = error instanceof Error ? error.message : "Le processus n’a pas pu démarrer.";
    job.finishedAt = new Date().toISOString();
    store.activeId = "";
    return publicJob(job);
  }

  job.status = "running";
  job.startedAt = new Date().toISOString();
  child.stdout.on("data", (chunk) => appendOutput(job, chunk));
  child.stderr.on("data", (chunk) => appendOutput(job, chunk));
  child.once("error", (error) => {
    job.status = "error";
    job.error = error.message.includes("ECONNREFUSED") ? "Ollama n’est pas accessible." : error.message;
    job.finishedAt = new Date().toISOString();
    store.activeId = "";
  });
  child.once("close", (code) => {
    if (job.status === "error") return;
    try {
      if (code !== 0) throw new Error(job.lines.at(-1) || `Le pipeline a échoué avec le code ${code}.`);
      findGeneratedNote(job);
      job.status = "success";
    } catch (error) {
      job.status = "error";
      job.error = error instanceof Error ? error.message : "La génération a échoué.";
    } finally {
      job.finishedAt = new Date().toISOString();
      store.activeId = "";
    }
  });

  return publicJob(job);
}

export function getGenerationJob(id: string) {
  const job = store.jobs.get(id);
  return job ? publicJob(job) : null;
}

export function resetJobsForTests() {
  store.jobs.clear();
  store.activeId = "";
}

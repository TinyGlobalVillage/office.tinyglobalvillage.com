/**
 * Server-side job persistence for transcription. Same JSON-file pattern as
 * qrcodes-store + transcripts-store: single shared file, atomic .tmp + rename
 * writes, soft-delete via `dismissed` flag.
 *
 * Why this exists separately from transcripts-store:
 *   - A "job" is the in-flight processing record; a "transcript" is the final
 *     persisted artifact. They have different lifecycles (jobs are short-lived
 *     and noisy; transcripts are long-lived and curated).
 *   - Jobs survive page refresh + browser close — the whole reason this layer
 *     exists. A user can hit Transcribe, hard-refresh the tab, and the job
 *     keeps running server-side; on next page load the client polls
 *     /api/transcripts/jobs and rehydrates the in-flight tile.
 *   - Jobs survive Office process restarts in the sense that their entry
 *     stays in jobs.json. The IN-FLIGHT WORK does not — the orphan Promise
 *     dies with the Node process. On boot we sweep stale "pending"/"running"
 *     entries to "interrupted" so the operator can retry.
 *
 * Storage:
 *   /srv/refusion-core/data/transcripts/jobs.json   — single shared file
 *   /srv/refusion-core/data/transcripts/audio/<owner>/<jobId>.<ext>
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type {
  CreateTranscriptInput,
  TranscriptContext,
  TranscriptRecord,
} from "@tgv/module-transcriber/types";

const DATA_ROOT =
  process.env.TRANSCRIPTS_DATA_ROOT ||
  "/srv/refusion-core/data/transcripts";

const JOBS_PATH = path.join(DATA_ROOT, "jobs.json");

export type JobStatus = "pending" | "running" | "done" | "error" | "interrupted";

export interface TranscriptionJobRecord {
  id: string;
  status: JobStatus;
  /** Original audio filename. */
  filename: string;
  bytes: number;
  /** Path relative to DATA_ROOT (so a future move of the data root is one
   *  env-var away). */
  audioPath: string;
  createdBy: string;
  startedAt: string;
  finishedAt: string | null;

  // Captured at job-creation time so we can show the operator a sensible
  // queued-tile description even before whisper produces any output.
  name: string;
  language: string | null;
  translate: boolean;
  lane: "auto" | "english" | "multilingual";
  notes: string;

  /** Set when status transitions to "done" — this is the live transcript
   *  record's id over in transcripts.json. The client uses this to deep-link
   *  the toast / editor. */
  transcriptId: string | null;
  /** Set when status transitions to "error" or "interrupted". */
  error: string | null;

  /** Operator has acknowledged this finished job (clicked toast, opened
   *  editor, etc.). The toast won't re-pop. */
  seen: boolean;
  /** Operator removed this job from the queue. Hidden from list responses. */
  dismissed: boolean;
}

type Store = Record<string, TranscriptionJobRecord>;

function readStore(): Store {
  try {
    return JSON.parse(fs.readFileSync(JOBS_PATH, "utf8")) as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  const tmp = JOBS_PATH + ".tmp";
  fs.mkdirSync(path.dirname(JOBS_PATH), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, JOBS_PATH);
}

export function ownerKey(ctx: TranscriptContext): string {
  return ctx.kind === "user" ? ctx.username : `org:${ctx.orgId}`;
}

function ownerDir(owner: string): string {
  return owner.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function newJobId(): string {
  return "job_" + crypto.randomBytes(8).toString("hex");
}

function jobAudioRel(owner: string, jobId: string, originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase().replace(/[^a-z0-9.]/g, "") || ".bin";
  return path.join("audio", ownerDir(owner), `${jobId}${ext}`);
}

export function jobAudioAbs(rel: string): string {
  return path.join(DATA_ROOT, rel);
}

export interface CreateJobInput {
  meta: CreateTranscriptInput;
  audioBytes: Buffer;
  sourceFilename: string;
}

export function createJob(input: CreateJobInput): TranscriptionJobRecord {
  if (!input.meta.name || !input.meta.name.trim()) {
    throw new Error("Job name is required.");
  }
  const id = newJobId();
  const owner = ownerKey(input.meta.context);
  const rel = jobAudioRel(owner, id, input.sourceFilename);
  const abs = jobAudioAbs(rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, input.audioBytes);

  const now = new Date().toISOString();
  const record: TranscriptionJobRecord = {
    id,
    status: "pending",
    filename: input.sourceFilename,
    bytes: input.audioBytes.length,
    audioPath: rel,
    createdBy: owner,
    startedAt: now,
    finishedAt: null,
    name: input.meta.name.trim(),
    language: input.meta.language ?? null,
    translate: !!input.meta.translate,
    lane: input.meta.lane ?? "auto",
    notes: input.meta.notes ?? "",
    transcriptId: null,
    error: null,
    seen: false,
    dismissed: false,
  };
  const store = readStore();
  store[id] = record;
  writeStore(store);
  return record;
}

export function getJob(id: string): TranscriptionJobRecord | null {
  const store = readStore();
  return store[id] ?? null;
}

export function listJobsForOwner(owner: string): TranscriptionJobRecord[] {
  const store = readStore();
  return Object.values(store)
    .filter((r) => !r.dismissed && r.createdBy === owner)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

/**
 * Lists every job the caller can see across both their personal bucket and
 * the shared org bucket. The jobs hydrator on the client uses this to fill
 * the singleton store on page mount with one round-trip.
 */
export function listJobsForCaller(callerUsername: string, orgId: "tgv-office"): TranscriptionJobRecord[] {
  const store = readStore();
  const orgKey = `org:${orgId}`;
  return Object.values(store)
    .filter((r) => !r.dismissed && (r.createdBy === callerUsername || r.createdBy === orgKey))
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

export type JobPatch = Partial<{
  status: JobStatus;
  finishedAt: string | null;
  transcriptId: string | null;
  error: string | null;
  seen: boolean;
  dismissed: boolean;
}>;

export function patchJob(id: string, patch: JobPatch, callerOwner: string | "system"): TranscriptionJobRecord {
  const store = readStore();
  const existing = store[id];
  if (!existing) throw new Error("Job not found");
  if (callerOwner !== "system" && existing.createdBy !== callerOwner && !existing.createdBy.startsWith("org:")) {
    throw new Error("Forbidden — not the job owner");
  }
  const next: TranscriptionJobRecord = { ...existing };
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.finishedAt !== undefined) next.finishedAt = patch.finishedAt;
  if (patch.transcriptId !== undefined) next.transcriptId = patch.transcriptId;
  if (patch.error !== undefined) next.error = patch.error;
  if (patch.seen !== undefined) next.seen = patch.seen;
  if (patch.dismissed !== undefined) next.dismissed = patch.dismissed;
  store[id] = next;
  writeStore(store);
  return next;
}

/**
 * Boot-time sweep: any "pending" or "running" job is orphaned (the worker
 * Promise that was driving it died with the previous Node process). Mark
 * them as "interrupted" so the operator sees the failed state on next load
 * and can retry. Audio file is left on disk so retry doesn't need re-upload.
 *
 * Idempotent — safe to call multiple times.
 */
export function sweepStaleJobsOnBoot(): { swept: number } {
  const store = readStore();
  const now = new Date().toISOString();
  let swept = 0;
  for (const [id, j] of Object.entries(store)) {
    if (j.status === "pending" || j.status === "running") {
      store[id] = {
        ...j,
        status: "interrupted",
        finishedAt: now,
        error: "Office server restarted while this transcription was running. Click Retry to re-queue, or Dismiss.",
      };
      swept++;
    }
  }
  if (swept > 0) writeStore(store);
  return { swept };
}

export function dataRoot(): string {
  return DATA_ROOT;
}

/** Shape returned to the client. Hides internal-only fields and bundles
 *  the finished transcript record so the client doesn't need a second
 *  round-trip when polling sees the state flip to "done". */
export interface JobDTO extends TranscriptionJobRecord {
  /** Populated when status === "done". Lookup happens client-side from
 *  /api/transcripts list, so we don't bundle it here — keeping the GET
 *  response small. */
  transcript: TranscriptRecord | null;
}

export function toDTO(j: TranscriptionJobRecord): JobDTO {
  return { ...j, transcript: null };
}

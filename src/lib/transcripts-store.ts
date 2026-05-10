/**
 * Server-side persistence for transcribed audio. Mirrors qrcodes-store.ts +
 * shortener-store.ts shape: a single shared JSON file per resource, scoped
 * by createdBy ("username" or "org:tgv-office"), atomic .tmp + rename writes.
 *
 * Difference from QR/TinyURL: transcripts are big (text + per-segment
 * timestamps) and are paired with an actual audio file on disk that we have
 * to track. The audio file lives at:
 *   /srv/refusion-core/data/transcripts/audio/<ownerKey>/<id>.<ext>
 * and gets removed on delete. The metadata JSON keeps the relative path so
 * a future move of the data root is one env-var away.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type {
  TranscriptRecord,
  TranscriptSegmentDTO,
  TranscriptContext,
  CreateTranscriptInput,
  UpdateTranscriptInput,
} from "@tgv/module-connect/transcriber/types";

export type {
  TranscriptRecord,
  TranscriptContext,
  CreateTranscriptInput,
  UpdateTranscriptInput,
} from "@tgv/module-connect/transcriber/types";

const DATA_ROOT =
  process.env.TRANSCRIPTS_DATA_ROOT ||
  "/srv/refusion-core/data/transcripts";

const STORE_PATH = path.join(DATA_ROOT, "transcripts.json");
const AUDIO_ROOT = path.join(DATA_ROOT, "audio");

type Store = Record<string, TranscriptRecord>;

function readStore(): Store {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  const tmp = STORE_PATH + ".tmp";
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, STORE_PATH);
}

export function ownerKey(context: TranscriptContext): string {
  return context.kind === "user" ? context.username : `org:${context.orgId}`;
}

function ownerDir(owner: string): string {
  // Sanitise owner -> safe dir name. "org:tgv-office" → "org-tgv-office".
  return owner.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function newId(): string {
  return crypto.randomBytes(8).toString("hex");
}

function audioRelPath(owner: string, id: string, originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase().replace(/[^a-z0-9.]/g, "") || ".bin";
  return path.join("audio", ownerDir(owner), `${id}${ext}`);
}

export function audioAbsPath(record: TranscriptRecord): string {
  return path.join(DATA_ROOT, record.audioPath);
}

function validateName(name: string) {
  if (!name || name.trim().length === 0) throw new Error("Transcript name is required.");
  if (name.length > 200) throw new Error("Transcript name must be 200 chars or fewer.");
}

export function listTranscripts(context: TranscriptContext): TranscriptRecord[] {
  const store = readStore();
  const owner = ownerKey(context);
  return Object.values(store)
    .filter((r) => !r.deleted && r.createdBy === owner)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export interface PersistTranscriptInput {
  meta: CreateTranscriptInput;
  audioBytes: Buffer;
  sourceFilename: string;
  sourceMime: string | null;
  text: string;
  segments: TranscriptSegmentDTO[];
  language: string;
  durationSec: number | null;
  lane: "english" | "multilingual";
  translate: boolean;
}

export function createTranscript(input: PersistTranscriptInput): TranscriptRecord {
  validateName(input.meta.name);

  const id = newId();
  const owner = ownerKey(input.meta.context);
  const relPath = audioRelPath(owner, id, input.sourceFilename);
  const absPath = path.join(DATA_ROOT, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, input.audioBytes);

  const now = new Date().toISOString();
  const record: TranscriptRecord = {
    id,
    name: input.meta.name.trim(),
    sourceFilename: input.sourceFilename,
    sourceBytes: input.audioBytes.length,
    audioPath: relPath,
    language: input.language,
    durationSec: input.durationSec,
    lane: input.lane,
    translate: input.translate,
    text: input.text,
    segments: input.segments,
    originalText: input.text,
    originalSegments: input.segments,
    notes: input.meta.notes ?? "",
    tags: input.meta.tags ?? [],
    createdBy: owner,
    createdAt: now,
    updatedAt: now,
    contentEditedAt: null,
    deleted: false,
  };

  const store = readStore();
  store[id] = record;
  writeStore(store);
  return record;
}

export function updateTranscript(
  id: string,
  patch: UpdateTranscriptInput,
  callerOwner: string,
): TranscriptRecord {
  const store = readStore();
  const existing = store[id];
  if (!existing || existing.deleted) throw new Error("Transcript not found");
  if (existing.createdBy !== callerOwner) {
    throw new Error("You can only edit transcripts you created in the active context");
  }
  const next: TranscriptRecord = { ...existing };
  // Forward-compat: records created before this field existed get backfilled
  // from `text` so the editor's "reset to original" still has something to
  // reset to (the original IS what's stored — operator hasn't edited yet).
  if (next.originalText === undefined) next.originalText = existing.text;
  if (next.originalSegments === undefined) next.originalSegments = existing.segments;

  if (patch.name !== undefined) {
    validateName(patch.name);
    next.name = patch.name.trim();
  }
  if (patch.notes !== undefined) next.notes = patch.notes;
  if (patch.tags !== undefined) next.tags = patch.tags;

  let contentChanged = false;
  if (patch.resetToOriginal) {
    next.text = next.originalText;
    next.segments = next.originalSegments;
    contentChanged = true;
  } else {
    if (patch.text !== undefined && patch.text !== existing.text) {
      next.text = patch.text;
      contentChanged = true;
    }
    if (patch.segments !== undefined) {
      // Only `text` per segment is patchable — server keeps the engine's
      // start/end timestamps even if the client sends new ones, so an
      // operator can't accidentally desync the audio scrubber.
      const byIdx = patch.segments;
      const baseSegments = existing.segments;
      next.segments = baseSegments.map((seg, i) => {
        const fromClient = byIdx[i];
        if (!fromClient || typeof fromClient.text !== "string") return seg;
        return { ...seg, text: fromClient.text };
      });
      // If the client sent more segments than we have, append them with
      // their own start/end (the editor uses this for new "split" rows).
      if (byIdx.length > baseSegments.length) {
        for (let i = baseSegments.length; i < byIdx.length; i++) {
          const extra = byIdx[i];
          if (extra && typeof extra.text === "string") {
            next.segments.push({
              start: typeof extra.start === "number" ? extra.start : 0,
              end: typeof extra.end === "number" ? extra.end : 0,
              text: extra.text,
            });
          }
        }
      }
      contentChanged = true;
    }
  }

  const now = new Date().toISOString();
  next.updatedAt = now;
  if (contentChanged) next.contentEditedAt = now;
  store[id] = next;
  writeStore(store);
  return next;
}

export function deleteTranscript(id: string, callerOwner: string): void {
  const store = readStore();
  const existing = store[id];
  if (!existing || existing.deleted) throw new Error("Transcript not found");
  if (existing.createdBy !== callerOwner) {
    throw new Error("You can only delete transcripts you created in the active context");
  }
  // Hard-delete the audio (it's heavy, no value in retention) but soft-delete
  // the metadata so re-uploads don't collide with old IDs.
  try {
    fs.unlinkSync(audioAbsPath(existing));
  } catch {
    /* file may already be missing — non-fatal */
  }
  store[id] = {
    ...existing,
    deleted: true,
    updatedAt: new Date().toISOString(),
    text: "",
    segments: [],
    notes: existing.notes,
  };
  writeStore(store);
}

export function getTranscript(id: string): TranscriptRecord | null {
  const store = readStore();
  const r = store[id];
  return r && !r.deleted ? r : null;
}

export function dataRoot(): string {
  return DATA_ROOT;
}

export function audioRootDir(): string {
  return AUDIO_ROOT;
}

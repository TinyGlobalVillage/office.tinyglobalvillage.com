/**
 * /api/transcripts/jobs
 *
 * The async transcription pipeline. The synchronous POST /api/transcripts
 * is gone — every modal POST now lands here. The request returns 202 with
 * a job id immediately; whisper runs in the background; the operator's
 * client polls GET /api/transcripts/jobs to learn when it finishes.
 *
 * Why orphan-Promise pattern instead of a queue/worker process: whisper.cpp
 * inference is sub-realtime on the base model, our typical job is <2 min,
 * and Office's request handlers run inside the same Node process that the
 * job state lives in. A real queue (BullMQ + Redis, or a separate worker
 * PM2 process) would be cleaner for horizontal scale or longer jobs, but
 * for v1 a fire-and-forget Promise is enough — the request completes
 * immediately, the work continues until done, and a process restart
 * marks any survivor "interrupted" via sweepStaleJobsOnBoot().
 *
 * GET ?context=user&username=<u>   personal bucket
 *     ?context=org&orgId=tgv-office shared org bucket
 *     (no context — both, scoped to caller)
 *
 * POST multipart:
 *   - file:    audio
 *   - payload: JSON of CreateTranscriptInput
 *   Response 202: { job: JobRecord }
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  createJob,
  listJobsForCaller,
  listJobsForOwner,
  ownerKey,
  patchJob,
  jobAudioAbs,
  sweepStaleJobsOnBoot,
} from "@/lib/transcripts-jobs-store";
import { createTranscript } from "@/lib/transcripts-store";
import {
  transcribe,
  WhisperEngineError,
} from "@tgv/module-transcriber/engine";
import type {
  CreateTranscriptInput,
  TranscriptContext,
} from "@tgv/module-transcriber/types";
import fs from "fs";

export const runtime = "nodejs";
// Whisper inference for an hour-long file takes ~10-20 min; keep some headroom.
// (Note: this is the orphan-Promise's max lifetime, NOT how long the client
// waits — clients see 202 within a second.)
export const maxDuration = 1200;

// One-time boot sweep when this module first loads in a new Node process.
// Runs synchronously; safe + fast (just marks stale entries).
let _bootSwept = false;
function bootSweepOnce() {
  if (_bootSwept) return;
  _bootSwept = true;
  try {
    const r = sweepStaleJobsOnBoot();
    if (r.swept > 0) console.log(`[transcripts.jobs] swept ${r.swept} stale job(s) on boot`);
  } catch (e) {
    console.error("[transcripts.jobs] boot sweep failed", e);
  }
}
bootSweepOnce();

function parseContextFromQuery(req: NextRequest): TranscriptContext | null | { error: string } {
  const url = new URL(req.url);
  const kind = url.searchParams.get("context");
  if (!kind) return null; // "no context" → list both
  if (kind === "user") {
    const username = url.searchParams.get("username") || "";
    if (!username) return { error: "missing username" };
    return { kind: "user", username };
  }
  if (kind === "org") {
    const orgId = url.searchParams.get("orgId") || "";
    if (orgId !== "tgv-office") return { error: "unknown orgId" };
    return { kind: "org", orgId };
  }
  return { error: "context must be 'user' or 'org' (or omit for both)" };
}

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctxOrErr = parseContextFromQuery(req);
  if (ctxOrErr && "error" in ctxOrErr) {
    return NextResponse.json({ error: ctxOrErr.error }, { status: 400 });
  }

  let jobs;
  if (ctxOrErr === null) {
    jobs = listJobsForCaller(token.username, "tgv-office");
  } else if (ctxOrErr.kind === "user") {
    if (ctxOrErr.username !== token.username) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    jobs = listJobsForOwner(token.username);
  } else {
    jobs = listJobsForOwner(`org:${ctxOrErr.orgId}`);
  }

  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  const payloadRaw = form.get("payload");
  if (!(file instanceof File) || typeof payloadRaw !== "string") {
    return NextResponse.json({ error: "Missing file or payload" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Audio file is empty" }, { status: 400 });
  }

  let payload: CreateTranscriptInput;
  try {
    payload = JSON.parse(payloadRaw) as CreateTranscriptInput;
  } catch {
    return NextResponse.json({ error: "Invalid payload JSON" }, { status: 400 });
  }
  if (!payload || typeof payload.name !== "string" || !payload.context) {
    return NextResponse.json({ error: "Payload missing name or context" }, { status: 400 });
  }
  // Personal bucket: caller may only write into their own bucket.
  if (payload.context.kind === "user" && payload.context.username !== token.username) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let audioBuf: Buffer;
  try {
    audioBuf = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Failed to read uploaded audio" }, { status: 400 });
  }

  // Persist the job + audio synchronously before returning. After this
  // point the client can hard-refresh; the job survives.
  let job;
  try {
    job = createJob({
      meta: payload,
      audioBytes: audioBuf,
      sourceFilename: file.name || "audio.bin",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create job" },
      { status: 400 },
    );
  }

  // Fire whisper in the background. Do NOT await — return 202 immediately.
  // The orphan Promise is intentional; cancellation on Node-process exit
  // is handled by sweepStaleJobsOnBoot() on next start.
  void runJob(job.id, audioBuf, file.name || "audio.bin", file.type || null, payload);

  return NextResponse.json({ job }, { status: 202 });
}

async function runJob(
  jobId: string,
  audioBytes: Buffer,
  sourceFilename: string,
  sourceMime: string | null,
  payload: CreateTranscriptInput,
) {
  try {
    patchJob(jobId, { status: "running" }, "system");
    const result = await transcribe({
      audio: audioBytes,
      filename: sourceFilename,
      language: payload.language,
      translate: payload.translate,
      lane: payload.lane,
      timestamps: true,
    });

    // The transcripts-store records its own copy of the audio bytes (so
    // browsing transcripts isn't dependent on jobs.json). The job's audio
    // file remains until the job is dismissed — this gives us "retry from
    // existing audio" for free in v2 without a re-upload.
    const transcript = createTranscript({
      meta: payload,
      audioBytes,
      sourceFilename,
      sourceMime,
      text: result.text,
      segments: result.segments,
      language: result.language,
      durationSec: result.durationSec,
      lane: result.lane,
      translate: !!payload.translate,
    });

    patchJob(
      jobId,
      {
        status: "done",
        finishedAt: new Date().toISOString(),
        transcriptId: transcript.id,
      },
      "system",
    );
  } catch (e) {
    const code = e instanceof WhisperEngineError ? e.code : "engine_error";
    const message = e instanceof Error ? e.message : "Transcription failed";
    try {
      patchJob(
        jobId,
        {
          status: "error",
          finishedAt: new Date().toISOString(),
          error: `[${code}] ${message}`,
        },
        "system",
      );
    } catch (patchErr) {
      console.error(`[transcripts.jobs] failed to record error on ${jobId}:`, patchErr);
    }
  } finally {
    // Try to delete the job's audio side-copy AFTER the transcript persists
    // its own copy. We keep audio for "interrupted" jobs so the operator can
    // retry without re-uploading. For "done" + "error" we'd ideally delete
    // here, but for "done" the same audio bytes are now under the transcript
    // record's audio path, and for "error" we keep it so the operator can
    // see what they uploaded if they need to debug. Leaving it on disk for
    // now — a retention sweep can clean up later.
    void 0;
    // Audio path retention guard (currently a no-op, see comment above).
    const job = (await import("@/lib/transcripts-jobs-store")).getJob(jobId);
    if (job && job.status === "done") {
      try { fs.unlinkSync(jobAudioAbs(job.audioPath)); } catch { /* best-effort */ }
    }
  }
}

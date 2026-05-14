/**
 * /api/transcripts/jobs/[id]
 *
 * PATCH  body: { seen?, dismissed?, retry? }
 *        - seen:      operator acknowledged the finished job (toast click)
 *        - dismissed: hide the job from the list (operator's queue cleanup)
 *        - retry:     re-queue an interrupted/error job. Re-uses the audio
 *                     bytes already on disk so no re-upload needed.
 * DELETE alias for { dismissed: true }.
 *
 * Note: status transitions like "pending" → "running" → "done" are driven
 * by the worker-side runJob() in route.ts; PATCH from the client is for
 * operator-driven flags only.
 */
import { type NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { requireAuth } from "@/lib/api-auth";
import {
  getJob,
  patchJob,
  jobAudioAbs,
  type TranscriptionJobRecord,
} from "@/lib/transcripts-jobs-store";
import { createTranscript } from "@/lib/transcripts-store";
import { transcribe, WhisperEngineError } from "@tgv/module-transcriber/engine";

export const runtime = "nodejs";
export const maxDuration = 1200;

function callerOwner(record: TranscriptionJobRecord, callerUsername: string): string | null {
  if (record.createdBy.startsWith("org:")) return record.createdBy;
  if (record.createdBy === callerUsername) return record.createdBy;
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = getJob(id);
  if (!job || job.dismissed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const owner = callerOwner(job, token.username);
  if (!owner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | { seen?: boolean; dismissed?: boolean; retry?: boolean }
    | null;
  if (!body) return NextResponse.json({ error: "Missing body" }, { status: 400 });

  // Retry: only valid on terminal failure states, requires audio still on disk.
  if (body.retry) {
    if (job.status === "pending" || job.status === "running") {
      return NextResponse.json({ error: "Job is still active — wait for it to finish first." }, { status: 409 });
    }
    if (job.status === "done") {
      return NextResponse.json({ error: "Job already completed; create a new one instead." }, { status: 409 });
    }
    let audioBytes: Buffer;
    try {
      audioBytes = fs.readFileSync(jobAudioAbs(job.audioPath));
    } catch {
      return NextResponse.json({ error: "Audio file no longer on disk — re-upload required." }, { status: 410 });
    }
    const updated = patchJob(
      id,
      { status: "pending", error: null, finishedAt: null, transcriptId: null },
      owner,
    );
    void requeueJob(id, audioBytes, job);
    return NextResponse.json({ job: updated });
  }

  const updated = patchJob(
    id,
    {
      seen: body.seen,
      dismissed: body.dismissed,
    },
    owner,
  );

  // If dismissed AND there's no associated transcript record (i.e. this was
  // an error/interrupted job), clean up the audio side-file. Done jobs keep
  // audio under the transcript's own path; we just orphan our copy.
  if (body.dismissed) {
    try { fs.unlinkSync(jobAudioAbs(job.audioPath)); } catch { /* best-effort */ }
  }

  return NextResponse.json({ job: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = getJob(id);
  if (!job || job.dismissed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const owner = callerOwner(job, token.username);
  if (!owner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  patchJob(id, { dismissed: true }, owner);
  try { fs.unlinkSync(jobAudioAbs(job.audioPath)); } catch { /* best-effort */ }
  return NextResponse.json({ ok: true });
}

async function requeueJob(jobId: string, audioBytes: Buffer, prior: TranscriptionJobRecord) {
  try {
    patchJob(jobId, { status: "running" }, "system");
    const result = await transcribe({
      audio: audioBytes,
      filename: prior.filename,
      language: prior.language ?? undefined,
      translate: prior.translate,
      lane: prior.lane,
      timestamps: true,
    });
    const transcript = createTranscript({
      meta: {
        name: prior.name,
        language: prior.language ?? undefined,
        translate: prior.translate,
        lane: prior.lane,
        notes: prior.notes,
        context: prior.createdBy.startsWith("org:")
          ? { kind: "org", orgId: "tgv-office" }
          : { kind: "user", username: prior.createdBy },
      },
      audioBytes,
      sourceFilename: prior.filename,
      sourceMime: null,
      text: result.text,
      segments: result.segments,
      language: result.language,
      durationSec: result.durationSec,
      lane: result.lane,
      translate: prior.translate,
    });
    patchJob(
      jobId,
      { status: "done", finishedAt: new Date().toISOString(), transcriptId: transcript.id },
      "system",
    );
    try { fs.unlinkSync(jobAudioAbs(prior.audioPath)); } catch { /* best-effort */ }
  } catch (e) {
    const code = e instanceof WhisperEngineError ? e.code : "engine_error";
    const message = e instanceof Error ? e.message : "Transcription failed";
    patchJob(
      jobId,
      { status: "error", finishedAt: new Date().toISOString(), error: `[${code}] ${message}` },
      "system",
    );
  }
}

/**
 * POST /api/transcripts/jobs/upload-with-ticket?ticket=<HMAC>
 *
 * The Cloudflare-bypass twin of POST /api/transcripts/jobs. Lives on the
 * direct.tinyglobalvillage.com hostname (no CF edge → no 100MB body limit)
 * and authenticates via HMAC ticket instead of session cookie.
 *
 * Flow:
 *   1. Modal calls /api/transcripts/jobs/ticket (cookie-authed) on
 *      office.tinyglobalvillage.com → mints a 5-min HMAC ticket.
 *   2. Modal POSTs the audio + payload here, with the ticket in the query.
 *   3. Server verifies the ticket, extracts the username, runs the same
 *      job-creation logic as the cookie-authed POST.
 *
 * Hardened against tunneling: the nginx server block on direct.tgv.com
 * sets `X-TGV-Bypass-Host`. We require that header to be present so the
 * cookie-authed route on office.tgv.com can't be tricked into accepting
 * tickets from clients that should be using cookies. (Defense in depth —
 * the ticket signature alone is sufficient, but this catches bugs.)
 */
import { type NextRequest, NextResponse } from "next/server";
import {
  isBypassRequest,
  verifyUploadTicket,
  gateContextForTicket,
} from "@/lib/upload-ticket";
import { createJob } from "@/lib/transcripts-jobs-store";
import { createTranscript } from "@/lib/transcripts-store";
import { transcribe, WhisperEngineError } from "@tgv/module-connect/whisper-client";
import type { CreateTranscriptInput } from "@tgv/module-connect/transcriber/types";
import { patchJob, jobAudioAbs } from "@/lib/transcripts-jobs-store";
import fs from "fs";

export const runtime = "nodejs";
export const maxDuration = 1200;

export async function POST(req: NextRequest) {
  // Hard gate: this endpoint only serves the bypass subdomain. nginx sets
  // X-TGV-Bypass-Host. If it's missing, refuse — caller should be using
  // the cookie-authed POST /api/transcripts/jobs instead.
  if (!isBypassRequest(req)) {
    return NextResponse.json(
      { error: "Use POST /api/transcripts/jobs (cookie-authed) for non-bypass uploads." },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const ticket = url.searchParams.get("ticket");
  if (!ticket) {
    return NextResponse.json({ error: "Missing ticket query param" }, { status: 400 });
  }

  let ticketPayload;
  try {
    ticketPayload = verifyUploadTicket(ticket);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid ticket", code: "ticket_invalid" },
      { status: 401 },
    );
  }

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

  const gate = gateContextForTicket(payload.context, ticketPayload.username);
  if (gate) return NextResponse.json({ error: gate }, { status: 403 });

  let audioBuf: Buffer;
  try {
    audioBuf = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Failed to read uploaded audio" }, { status: 400 });
  }

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
      { status: "done", finishedAt: new Date().toISOString(), transcriptId: transcript.id },
      "system",
    );
    const j = (await import("@/lib/transcripts-jobs-store")).getJob(jobId);
    if (j) try { fs.unlinkSync(jobAudioAbs(j.audioPath)); } catch { /* best-effort */ }
  } catch (e) {
    const code = e instanceof WhisperEngineError ? e.code : "engine_error";
    const message = e instanceof Error ? e.message : "Transcription failed";
    try {
      patchJob(
        jobId,
        { status: "error", finishedAt: new Date().toISOString(), error: `[${code}] ${message}` },
        "system",
      );
    } catch (patchErr) {
      console.error(`[transcripts.jobs] failed to record error on ${jobId}:`, patchErr);
    }
  }
}

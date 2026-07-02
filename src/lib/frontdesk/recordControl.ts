/**
 * Mid-call recording control over the FreeSWITCH event socket.
 *
 * Semantics (operator spec 2026-07-02): each toggle-ON opens a NEW segment
 * file; toggle-OFF ends (and keeps) the current one. A call can therefore
 * produce several recording files; the CDR carries them in recordingPaths[].
 *
 * Channel resolution: the browser only knows its SIP Call-ID. We list live
 * channels and match ${sip_call_id} server-side — the client-supplied id is
 * only ever COMPARED against ESL output, never interpolated into a command.
 * For inbound calls the recording runs on the PSTN a-leg while the browser
 * is the bridged b-leg, so we hop to ${signal_bond} when the browser's own
 * leg has no recording_file variable.
 *
 * Share-ready: recordings dir + encrypt hook are env-tunable
 * (FRONTDESK_RECORDINGS_DIR, FRONTDESK_RECORDING_ENCRYPT_SCRIPT); nothing
 * tenant-specific is hardcoded beyond defaults derived from process.cwd().
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { eslCommand } from "./esl";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RECORDINGS_DIR =
  process.env.FRONTDESK_RECORDINGS_DIR?.trim() ||
  path.resolve(process.cwd(), "telephony", "data", "recordings");

// Same hook the dialplan arms via api_hangup_hook (telephony-security Item 3).
// Staged — the script may not exist yet; every use is existence-guarded.
const ENCRYPT_SCRIPT =
  process.env.FRONTDESK_RECORDING_ENCRYPT_SCRIPT?.trim() ||
  "/srv/refusion-core/telephony/scripts/encrypt-recording.sh";

function assertUuid(uuid: string): void {
  if (!UUID_RE.test(uuid)) throw new Error(`invalid channel uuid: ${uuid}`);
}

/** uuid_getvar returns the literal string "_undef_" for unset variables. */
async function getVar(uuid: string, name: string): Promise<string | null> {
  assertUuid(uuid);
  if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`invalid var name: ${name}`);
  const out = (await eslCommand(`uuid_getvar ${uuid} ${name}`)).trim();
  if (!out || out === "_undef_" || out.startsWith("-ERR")) return null;
  return out;
}

type ChannelRow = { uuid?: string; context?: string };

async function listChannelUuids(): Promise<string[]> {
  const body = await eslCommand("show channels as json");
  try {
    const parsed = JSON.parse(body) as { rows?: ChannelRow[] };
    return (parsed.rows ?? [])
      .map(r => r.uuid ?? "")
      .filter(u => UUID_RE.test(u))
      .slice(0, 50);
  } catch {
    return [];
  }
}

export type RecordingAnchor = {
  /** Channel the recording media-bug lives (or would live) on. */
  uuid: string;
  /** Current recording_file channel variable (dialplan- or API-set). */
  recordingFile: string | null;
  /** Whether a session_record media bug is live on the anchor right now. */
  active: boolean;
};

/**
 * Resolve the recording anchor for a browser session's SIP Call-ID.
 * Returns null when no live channel matches.
 */
export async function resolveAnchorByCallId(sipCallId: string): Promise<RecordingAnchor | null> {
  const wanted = sipCallId.trim();
  if (!wanted || wanted.length > 256) return null;

  for (const uuid of await listChannelUuids()) {
    const callId = await getVar(uuid, "sip_call_id");
    if (callId !== wanted) continue;

    // Prefer the leg carrying recording_file (outbound: the browser leg
    // itself; inbound: the bridged PSTN a-leg).
    const ownFile = await getVar(uuid, "recording_file");
    let anchor = uuid;
    let recordingFile = ownFile;
    if (!ownFile) {
      const partner = await getVar(uuid, "signal_bond");
      if (partner && UUID_RE.test(partner)) {
        const partnerFile = await getVar(partner, "recording_file");
        if (partnerFile) {
          anchor = partner;
          recordingFile = partnerFile;
        }
      }
    }
    return { uuid: anchor, recordingFile, active: await isRecordingActive(anchor) };
  }
  return null;
}

export async function isRecordingActive(uuid: string): Promise<boolean> {
  assertUuid(uuid);
  const out = await eslCommand(`uuid_buglist ${uuid}`);
  return out.includes("session_record");
}

function segmentPath(uuid: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  let file = path.join(RECORDINGS_DIR, `${ts}_${uuid}.wav`);
  for (let n = 2; fs.existsSync(file) && n < 100; n++) {
    file = path.join(RECORDINGS_DIR, `${ts}_${uuid}_${n}.wav`);
  }
  return file;
}

/** Best-effort: encrypt a finished segment if the staged hook script exists. */
function encryptSegment(file: string): void {
  try {
    if (!fs.existsSync(ENCRYPT_SCRIPT)) return;
    spawn(ENCRYPT_SCRIPT, [file], { stdio: "ignore", detached: true }).unref();
  } catch { /* best-effort */ }
}

/**
 * Start a new recording segment on the anchor channel. Idempotent: when a
 * session_record bug is already live, returns the current file instead.
 */
export async function startSegment(anchor: RecordingAnchor): Promise<string> {
  assertUuid(anchor.uuid);
  if (await isRecordingActive(anchor.uuid)) {
    // Re-read the live var — the anchor snapshot can predate a concurrent
    // start's uuid_setvar (start + setvar are two ESL round-trips).
    return (await getVar(anchor.uuid, "recording_file")) ?? anchor.recordingFile ?? "";
  }
  const file = segmentPath(anchor.uuid);
  const res = await eslCommand(`uuid_record ${anchor.uuid} start ${file}`);
  if (res.startsWith("-ERR")) throw new Error(`uuid_record start failed: ${res.trim()}`);
  // Keep the dialplan's bookkeeping coherent: recording_file always points
  // at the ACTIVE segment, and the hangup encrypt-hook targets it too.
  await eslCommand(`uuid_setvar ${anchor.uuid} recording_file ${file}`);
  await eslCommand(
    `uuid_setvar ${anchor.uuid} api_hangup_hook system ${ENCRYPT_SCRIPT} ${file}`,
  );
  return file;
}

/**
 * Stop the active recording segment. The file is finalized and KEPT. Returns
 * the finished segment's path (null when nothing was recording).
 */
export async function stopSegment(anchor: RecordingAnchor): Promise<string | null> {
  assertUuid(anchor.uuid);
  if (!(await isRecordingActive(anchor.uuid))) return null;
  // Live var first — freshest under concurrent start; anchor is a fallback.
  const file = (await getVar(anchor.uuid, "recording_file")) ?? anchor.recordingFile;
  if (!file) return null;
  const res = await eslCommand(`uuid_record ${anchor.uuid} stop ${file}`);
  if (res.startsWith("-ERR")) throw new Error(`uuid_record stop failed: ${res.trim()}`);
  encryptSegment(file);
  return file;
}

/**
 * E.164 caller number of the anchor channel — used to attach mid-call
 * segments to the open inbound CDR (inbound CDRs are created at ring time
 * by the webhook path; outbound CDRs don't exist until the browser logs
 * them at hangup, so an inbound-shaped match can never hit an outbound row).
 */
export async function getAnchorCallerNumber(anchor: RecordingAnchor): Promise<string | null> {
  return getVar(anchor.uuid, "caller_id_number");
}

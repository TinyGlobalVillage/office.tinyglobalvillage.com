// src/lib/meet-captions-config.ts
//
// Office-owned shared config for meet live captions (Utils → Media & Transcription → Meet
// Captions tile). Office WRITES this JSON; the meet settings handler (@tgv/module-video-calls
// server/enablement.ts) and services/meet-captions READ the same file to honour the operator
// killswitch with no restart. Same box ⇒ no network seam needed. Mirrors lib/paypal-config.ts.
//
// Seeded with the killswitch ON: captions ship dark until the box RAM upgrade (§6b of the meet
// plan) — live Whisper on today's 7.8GB box would fight every prod app for memory. Flip it here
// when the new box lands.
import "server-only";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type MeetCaptionsConfig = {
  /** true = captions off platform-wide (the default until the RAM upgrade). */
  globalKillswitch: boolean;
  /** whisper.cpp server base URL — module-transcriber's multilingual PM2 lane by default. */
  whisperEndpoint: string;
  /** Informational — whisper.cpp fixes its model at boot; shown here, used by future lanes. */
  whisperModel: string;
  /** ISO code, or "" for whisper auto-detect. */
  language: string;
  /** Concurrent captioned rooms the meet-captions service will hold. */
  maxRooms: number;
  /** Reserved — meetings are platform-scoped today; rows appear when meet goes per-tenant. */
  perTenant: Record<string, { enabled: boolean; label?: string }>;
};

export const MEET_CAPTIONS_CONFIG_PATH =
  process.env.MEET_CAPTIONS_CONFIG_PATH ?? "/srv/refusion-core/data/meet-captions/meet-captions-config.json";

export const SEED_CONFIG: MeetCaptionsConfig = {
  globalKillswitch: true,
  whisperEndpoint: "http://127.0.0.1:8511",
  whisperModel: "ggml-base.bin",
  language: "",
  maxRooms: 1,
  perTenant: {},
};

function normalise(parsed: Partial<MeetCaptionsConfig>): MeetCaptionsConfig {
  return {
    globalKillswitch: parsed.globalKillswitch !== false, // absent/garbled leans OFF (killed)
    whisperEndpoint: typeof parsed.whisperEndpoint === "string" && parsed.whisperEndpoint ? parsed.whisperEndpoint : SEED_CONFIG.whisperEndpoint,
    whisperModel: typeof parsed.whisperModel === "string" && parsed.whisperModel ? parsed.whisperModel : SEED_CONFIG.whisperModel,
    language: typeof parsed.language === "string" ? parsed.language : "",
    maxRooms: typeof parsed.maxRooms === "number" && parsed.maxRooms > 0 ? Math.floor(parsed.maxRooms) : 1,
    perTenant:
      parsed.perTenant && typeof parsed.perTenant === "object" && !Array.isArray(parsed.perTenant)
        ? parsed.perTenant
        : {},
  };
}

export function readMeetCaptionsConfig(): MeetCaptionsConfig {
  try {
    return normalise(JSON.parse(readFileSync(MEET_CAPTIONS_CONFIG_PATH, "utf8")) as Partial<MeetCaptionsConfig>);
  } catch {
    // No file yet ⇒ hand back the seed so the tile resolves on first open.
    return SEED_CONFIG;
  }
}

/** Strict read for the WRITE path: distinguishes a MISSING file (mutate on the seed, audit
 *  before=null) from a CORRUPT one (abort — never clobber an unparseable config). */
export function readMeetCaptionsConfigStrict(): MeetCaptionsConfig | "missing" | "corrupt" {
  let raw: string;
  try {
    raw = readFileSync(MEET_CAPTIONS_CONFIG_PATH, "utf8");
  } catch {
    return "missing";
  }
  try {
    return normalise(JSON.parse(raw) as Partial<MeetCaptionsConfig>);
  } catch {
    return "corrupt";
  }
}

export function writeMeetCaptionsConfig(cfg: MeetCaptionsConfig): void {
  mkdirSync(dirname(MEET_CAPTIONS_CONFIG_PATH), { recursive: true });
  writeFileSync(MEET_CAPTIONS_CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

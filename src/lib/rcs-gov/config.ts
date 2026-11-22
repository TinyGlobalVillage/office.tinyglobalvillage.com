// Dev Server Pool — shared shapes + CLAMPS for rcs-gov (no node imports, so client components can use it).
// The server side (fs) is ./state.ts. CLAMPS mirror mono utils/scripts/build-pipeline/rcs-gov.py.
export type RcsGovConfig = {
  enabled: boolean;
  /** workingSet = memory.current − inactive_file; current = the raw cgroup figure. */
  metric: "workingSet" | "current";
  triggerGB: number;
  idleMin: number;
  cooldownSec: number;
  heapMB: number;
  floorMB: number;
  sliceHighGB: number;
  sliceMaxGB: number;
};
export type NumericKey = Exclude<keyof RcsGovConfig, "enabled" | "metric">;

export type RcsGovServer = {
  unit: string;
  lane: string;
  port: number;
  pid: number;
  alive: boolean;
  mb: number;
  workingSetMb: number;
  anonMb: number;
  idleMin: number | null;
  canRestart: boolean;
  eligible: boolean;
};
export type RcsGovStatus = {
  t: number;
  error?: string;
  over?: boolean;
  lastActionAt?: number | null;
  slice?: {
    currentMb: number;
    workingSetMb: number;
    anonMb: number;
    highMb: number | null;
    maxMb: number | null;
    usedMb: number;
    triggerMb: number;
  } | null;
  servers?: RcsGovServer[];
};
export type RcsGovLogLine = {
  t: number;
  kind: string;
  what: string;
  lane: string | null;
  pid: number | null;
  mb: number | null;
  reason: string;
  port?: number;
  ok?: boolean;
};

/** The protect window — never configurable below this (the daemon enforces it too). */
export const PROTECT_MIN = 10;

export const DEFAULTS: RcsGovConfig = {
  enabled: false,
  metric: "workingSet",
  triggerGB: 32,
  idleMin: 10,
  cooldownSec: 90,
  heapMB: 12288,
  floorMB: 1536,
  sliceHighGB: 36,
  sliceMaxGB: 40,
};

// CLAMPS — mirror rcs-gov.py's CLAMPS (box: 62 GB, prod floor 24 GB). Keep the two in step.
export const CLAMPS: Record<NumericKey, [number, number]> = {
  triggerGB: [8, 46],
  idleMin: [PROTECT_MIN, 240],
  cooldownSec: [30, 600],
  heapMB: [2048, 16384],
  floorMB: [0, 4096],
  sliceHighGB: [16, 46],
  sliceMaxGB: [18, 48],
};
export const TUNABLE = ["enabled", "metric", ...(Object.keys(CLAMPS) as NumericKey[])] as const;

/** Coerce anything into a valid config; bad fields fall back to `base`. Same rules as the daemon. */
export function coerce(raw: unknown, base: RcsGovConfig = DEFAULTS): RcsGovConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: RcsGovConfig = { ...base };
  if (typeof o.enabled === "boolean") out.enabled = o.enabled;
  if (o.metric === "workingSet" || o.metric === "current") out.metric = o.metric;
  for (const k of Object.keys(CLAMPS) as NumericKey[]) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      const [lo, hi] = CLAMPS[k];
      out[k] = Math.trunc(Math.min(hi, Math.max(lo, v)));
    }
  }
  if (out.sliceMaxGB < out.sliceHighGB + 2) out.sliceMaxGB = Math.min(CLAMPS.sliceMaxGB[1], out.sliceHighGB + 2);
  if (out.triggerGB > out.sliceHighGB - 2) out.triggerGB = Math.max(CLAMPS.triggerGB[0], out.sliceHighGB - 2);
  return out;
}

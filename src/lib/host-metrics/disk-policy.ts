/**
 * Per-target cleanup policy — the knobs behind each gear in the disk breakdown.
 *
 * The TARGET (which directory, which files match, what happens to them) is code
 * in disk-targets.ts and cannot be edited from the UI. The POLICY (how old, how
 * many to keep, whether the sweep button works at all) is data, and lives here.
 *
 * That split is the whole safety story: turning a knob can make a sweep smaller
 * or larger within one directory, and can never make it point somewhere else.
 *
 * Same posture as config.ts — reads never throw, out-of-range values are pulled
 * to the nearest allowed one rather than rejected.
 */
import "server-only";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { DISK_TARGETS, type DiskTarget, type SweepSpec } from "./disk-targets";

const DIR = path.join(process.cwd(), "data", "host-metrics");
const FILE = path.join(DIR, "disk-policy.json");

export type TargetPolicy = {
  /** Sweeping is armed. Off = the endpoint refuses even with an explicit apply. */
  enabled: boolean;
  /** Nothing younger than this is a candidate. */
  minAgeDays: number;
  /** Newest N matches are kept whatever their age. */
  keep: number;
};

export type DiskPolicyFile = {
  targets: Record<string, Partial<TargetPolicy>>;
  lastUpdated: string | null;
  _note?: string;
};

const CLAMPS = {
  minAgeDays: [0, 3650],
  keep: [0, 512],
} as const;

const NOTE =
  "Per-target cleanup policy for the Box Usage Monitor's disk breakdown. Which directory a target " +
  "points at, and what a sweep does to it, are in src/lib/host-metrics/disk-targets.ts and are NOT " +
  "editable from here — only how old a file must be, how many to keep, and whether the sweep is armed.";

function clamp(key: keyof typeof CLAMPS, v: unknown, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
  const [lo, hi] = CLAMPS[key];
  return Math.min(hi, Math.max(lo, n));
}

/** The policy a target ships with, before anything is overridden in the file. */
export function defaultPolicy(target: DiskTarget): TargetPolicy {
  const s: SweepSpec | null = target.sweep;
  if (!s) return { enabled: false, minAgeDays: 0, keep: 0 };
  if (s.kind === "command") return { enabled: true, minAgeDays: 0, keep: 0 };
  if (s.kind === "nested") return { enabled: true, minAgeDays: s.minAgeDays, keep: 0 };
  return { enabled: true, minAgeDays: s.minAgeDays, keep: s.keep };
}

function readFile(): DiskPolicyFile {
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as Partial<DiskPolicyFile>;
    return {
      targets: (raw.targets && typeof raw.targets === "object" ? raw.targets : {}) as Record<
        string,
        Partial<TargetPolicy>
      >,
      lastUpdated: typeof raw.lastUpdated === "string" ? raw.lastUpdated : null,
      _note: NOTE,
    };
  } catch {
    return { targets: {}, lastUpdated: null, _note: NOTE };
  }
}

/** Effective policy for one target: its defaults, with the file's overrides on top. */
export function policyFor(target: DiskTarget, file: DiskPolicyFile = readFile()): TargetPolicy {
  const base = defaultPolicy(target);
  if (!target.sweep) return base; // measured-only can't be armed by editing a file
  const o = file.targets[target.id] ?? {};
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : base.enabled,
    minAgeDays: clamp("minAgeDays", o.minAgeDays, base.minAgeDays),
    keep: clamp("keep", o.keep, base.keep),
  };
}

/** Every target's effective policy, keyed by ID — what the modal renders. */
export function allPolicies(): Record<string, TargetPolicy> {
  const file = readFile();
  return Object.fromEntries(DISK_TARGETS.map((t) => [t.id, policyFor(t, file)]));
}

/**
 * Merge an override for one target. Returns the new effective policy.
 * Writing for a measured-only target is a no-op: there is nothing to arm.
 */
export function writePolicy(targetId: string, patch: Partial<TargetPolicy>): TargetPolicy | null {
  const target = DISK_TARGETS.find((t) => t.id === targetId);
  if (!target || !target.sweep) return null;

  const file = readFile();
  const current = policyFor(target, file);
  const next: TargetPolicy = {
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : current.enabled,
    minAgeDays: clamp("minAgeDays", patch.minAgeDays ?? current.minAgeDays, current.minAgeDays),
    keep: clamp("keep", patch.keep ?? current.keep, current.keep),
  };

  file.targets[targetId] = next;
  file.lastUpdated = new Date().toISOString();
  file._note = NOTE;
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(FILE, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  } catch {
    // Same as config.ts: a read-only data dir shouldn't take the modal down.
  }
  return next;
}

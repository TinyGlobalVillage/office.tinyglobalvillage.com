/**
 * Box Usage Monitor — the disk breakdown: measure, preview, reclaim.
 *
 * The disk gauge says 93%. This is the part that says WHY, and offers to do
 * something about it without anyone opening an ssh session.
 *
 * MEASURING is `du`, which is genuinely expensive on a box with 1.1M inodes, so
 * a scan is cached (default 30 minutes), runs one at a time, and is niced and
 * ioniced to the floor — a monitor that browns out the box it is monitoring has
 * defeated itself. The filesystem totals come from statfs, not `df`: no
 * subprocess, no parsing.
 *
 * RECLAIMING is deliberately three steps — a target that opts in (disk-targets),
 * a policy that is armed (disk-policy), and an explicit apply. Preview is the
 * default: every sweep endpoint answers "here is exactly what I would delete and
 * how much it frees" until it is told, in a separate call, to do it. Nothing here
 * accepts a path from a request; candidates are derived from the target's own
 * directory and re-checked against the allow-list immediately before unlinking.
 */
import "server-only";
import { execFile } from "child_process";
import { readdir, realpath, rm, stat, statfs, truncate } from "fs/promises";
import path from "path";
import { promisify } from "util";
import {
  DISK_TARGETS,
  isPathAllowed,
  type DiskTarget,
  type SweepSpec,
} from "./disk-targets";
import { allPolicies, policyFor, type TargetPolicy } from "./disk-policy";

const exec = promisify(execFile);

const SCAN_TTL_MS = 30 * 60_000;
const DU_TIMEOUT_MS = 180_000;
const DAY_MS = 24 * 60 * 60_000;

export type FilesystemUsage = {
  mount: string;
  sizeBytes: number;
  usedBytes: number;
  availBytes: number;
  usePct: number;
};

export type TargetUsage = {
  id: string;
  label: string;
  path: string;
  group: DiskTarget["group"];
  what: string;
  consequence: string;
  /** null when the path doesn't exist on this box, or root was needed and refused. */
  bytes: number | null;
  unreadable?: string;
  sweepable: boolean;
  sweepKind: SweepSpec["kind"] | null;
  policy: TargetPolicy;
};

export type DiskScan = {
  fs: FilesystemUsage | null;
  targets: TargetUsage[];
  /** Bytes on the filesystem that no target accounts for. */
  unaccountedBytes: number | null;
  scannedAt: string;
  durationMs: number;
};

type ScanState = { scan: DiskScan | null; running: Promise<DiskScan> | null };
const KEY = Symbol.for("tgv.host-metrics.disk-scan");

function scanState(): ScanState {
  const g = globalThis as unknown as Record<symbol, ScanState | undefined>;
  if (!g[KEY]) g[KEY] = { scan: null, running: null };
  return g[KEY];
}

// ── measuring ────────────────────────────────────────────────────────────

async function readFilesystem(mount = "/"): Promise<FilesystemUsage | null> {
  try {
    const fs = await statfs(mount);
    const size = Number(fs.blocks) * Number(fs.bsize);
    const avail = Number(fs.bavail) * Number(fs.bsize);
    const free = Number(fs.bfree) * Number(fs.bsize);
    const used = size - free;
    return {
      mount,
      sizeBytes: size,
      usedBytes: used,
      availBytes: avail,
      // Matches what df prints: usage against what a non-root user can actually have.
      usePct: used + avail > 0 ? (used / (used + avail)) * 100 : 0,
    };
  } catch {
    return null;
  }
}

/**
 * `du -x -s -B1`, pinned to the lowest CPU and I/O priority the box offers.
 * `-x` keeps it on one filesystem so a bind mount can't send it wandering.
 */
async function duBytes(target: string, needsRoot = false): Promise<number | null> {
  const du = ["du", "-x", "-s", "-B1", target];
  const attempts: Array<[string, string[]]> = needsRoot
    ? [
        ["sudo", ["-n", "nice", "-n", "19", "ionice", "-c3", ...du]],
        ["sudo", ["-n", ...du]],
      ]
    : [
        ["nice", ["-n", "19", "ionice", "-c3", ...du]],
        [du[0], du.slice(1)],
      ];

  for (const [cmd, args] of attempts) {
    try {
      const { stdout } = await exec(cmd, args, {
        timeout: DU_TIMEOUT_MS,
        maxBuffer: 1 << 20,
      });
      const n = Number(stdout.trim().split(/\s+/)[0]);
      if (Number.isFinite(n)) return n;
    } catch (err) {
      // du exits non-zero on unreadable subdirectories but still prints a total.
      const out = (err as { stdout?: string }).stdout;
      if (out) {
        const n = Number(out.trim().split(/\s+/)[0]);
        if (Number.isFinite(n)) return n;
      }
    }
  }
  return null;
}

async function measure(target: DiskTarget, policy: TargetPolicy): Promise<TargetUsage> {
  const base = {
    id: target.id,
    label: target.label,
    path: target.path,
    group: target.group,
    what: target.what,
    consequence: target.consequence,
    sweepable: target.sweep !== null,
    sweepKind: target.sweep?.kind ?? null,
    policy,
  };
  try {
    await stat(target.path);
  } catch {
    return { ...base, bytes: null, unreadable: "not on this box" };
  }
  const bytes = await duBytes(target.path, target.needsRoot);
  return bytes === null
    ? { ...base, bytes: null, unreadable: target.needsRoot ? "needs root" : "unreadable" }
    : { ...base, bytes };
}

/**
 * Measure every target. Cached for SCAN_TTL_MS; concurrent callers share the
 * one in-flight scan rather than starting a second `du` storm.
 */
export async function scanDisk(force = false): Promise<DiskScan> {
  const s = scanState();
  if (s.running) return s.running;
  if (!force && s.scan && Date.now() - Date.parse(s.scan.scannedAt) < SCAN_TTL_MS) return s.scan;

  const run = (async (): Promise<DiskScan> => {
    const started = Date.now();
    const policies = allPolicies();
    const fs = await readFilesystem();

    // Serial on purpose: four parallel `du`s on a box that is already swapping
    // is exactly the kind of "helpful" monitoring that causes an incident.
    const targets: TargetUsage[] = [];
    for (const t of DISK_TARGETS) {
      targets.push(await measure(t, policies[t.id]));
    }

    // Nested targets (clients holds deploy-rollbacks; worktrees is inside .claude)
    // would be double-counted, so only count paths that aren't inside another.
    const roots = targets.filter(
      (t) => !targets.some((o) => o !== t && t.path.startsWith(`${o.path}/`)),
    );
    const counted = roots.reduce((sum, t) => sum + (t.bytes ?? 0), 0);

    const scan: DiskScan = {
      fs,
      targets,
      unaccountedBytes: fs ? Math.max(0, fs.usedBytes - counted) : null,
      scannedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
    };
    s.scan = scan;
    return scan;
  })();

  s.running = run;
  try {
    return await run;
  } finally {
    s.running = null;
  }
}

/** The cached scan, if there is one — for a fast paint before a refresh. */
export function cachedScan(): DiskScan | null {
  return scanState().scan;
}

// ── reclaiming ───────────────────────────────────────────────────────────

export type SweepCandidate = {
  path: string;
  bytes: number;
  ageDays: number;
  action: "delete" | "truncate";
};

export type SweepPlan = {
  targetId: string;
  /** false when the target is measured-only, or its policy is disarmed. */
  armed: boolean;
  reason?: string;
  candidates: SweepCandidate[];
  totalBytes: number;
  /** `pnpm store prune` and friends can't be previewed — they decide themselves. */
  opaqueCommand?: string;
};

const ageDays = (mtimeMs: number) => (Date.now() - mtimeMs) / DAY_MS;

/** Newest-first, minus the ones the policy keeps, minus anything too young. */
function applyKeepAndAge<T extends { mtimeMs: number }>(
  items: T[],
  policy: TargetPolicy,
): T[] {
  const sorted = [...items].sort((a, b) => b.mtimeMs - a.mtimeMs);
  return sorted.slice(policy.keep).filter((i) => ageDays(i.mtimeMs) >= policy.minAgeDays);
}

async function planFiles(
  target: DiskTarget,
  spec: Extract<SweepSpec, { kind: "files" }>,
  policy: TargetPolicy,
): Promise<SweepCandidate[]> {
  const re = new RegExp(spec.match);
  const entries = await readdir(target.path, { withFileTypes: true });
  const files: Array<{ path: string; bytes: number; mtimeMs: number }> = [];
  for (const e of entries) {
    if (!e.isFile() || !re.test(e.name)) continue;
    const full = path.join(target.path, e.name);
    try {
      const st = await stat(full);
      if (spec.minBytes && st.size < spec.minBytes) continue;
      files.push({ path: full, bytes: st.size, mtimeMs: st.mtimeMs });
    } catch {
      /* vanished between readdir and stat — fine, it's gone */
    }
  }
  return applyKeepAndAge(files, policy).map((f) => ({
    path: f.path,
    bytes: f.bytes,
    ageDays: Math.floor(ageDays(f.mtimeMs)),
    action: spec.truncate ? "truncate" : "delete",
  }));
}

async function planChildren(
  target: DiskTarget,
  spec: Extract<SweepSpec, { kind: "children" }>,
  policy: TargetPolicy,
): Promise<SweepCandidate[]> {
  const re = new RegExp(spec.match);
  const entries = await readdir(target.path, { withFileTypes: true });
  const kids: Array<{ path: string; mtimeMs: number; isDir: boolean }> = [];
  for (const e of entries) {
    if (!re.test(e.name)) continue;
    const full = path.join(target.path, e.name);
    try {
      const st = await stat(full);
      kids.push({ path: full, mtimeMs: st.mtimeMs, isDir: st.isDirectory() });
    } catch {
      /* gone */
    }
  }
  const chosen = applyKeepAndAge(kids, policy);
  const out: SweepCandidate[] = [];
  for (const k of chosen) {
    const bytes = k.isDir ? ((await duBytes(k.path)) ?? 0) : (await stat(k.path)).size;
    out.push({ path: k.path, bytes, ageDays: Math.floor(ageDays(k.mtimeMs)), action: "delete" });
  }
  return out;
}

async function planNested(
  target: DiskTarget,
  spec: Extract<SweepSpec, { kind: "nested" }>,
  policy: TargetPolicy,
): Promise<SweepCandidate[]> {
  const subdirs = await readdir(target.path, { withFileTypes: true });
  const out: SweepCandidate[] = [];
  for (const d of subdirs) {
    if (!d.isDirectory()) continue;
    const dir = path.join(target.path, d.name);
    for (const name of spec.entries) {
      const full = path.join(dir, name);
      try {
        const st = await stat(full);
        // Age is the artefact's own — a lane whose source was touched yesterday
        // can still be carrying a node_modules from March.
        if (ageDays(st.mtimeMs) < policy.minAgeDays) continue;
        out.push({
          path: full,
          bytes: (await duBytes(full)) ?? 0,
          ageDays: Math.floor(ageDays(st.mtimeMs)),
          action: "delete",
        });
      } catch {
        /* this lane doesn't have that entry */
      }
    }
  }
  return out;
}

/**
 * The planning rules for one target under one policy, with no lookup and no
 * file of overrides in the way — the seam the tests drive against a temp dir.
 */
export async function planFor(target: DiskTarget, policy: TargetPolicy): Promise<SweepPlan> {
  const targetId = target.id;
  if (!target.sweep)
    return { targetId, armed: false, reason: "measured only", candidates: [], totalBytes: 0 };
  if (!policy.enabled)
    return { targetId, armed: false, reason: "disarmed in policy", candidates: [], totalBytes: 0 };

  if (target.sweep.kind === "command") {
    return {
      targetId,
      armed: true,
      candidates: [],
      totalBytes: 0,
      opaqueCommand: target.sweep.argv.join(" "),
    };
  }

  let candidates: SweepCandidate[] = [];
  try {
    if (target.sweep.kind === "files") candidates = await planFiles(target, target.sweep, policy);
    else if (target.sweep.kind === "children")
      candidates = await planChildren(target, target.sweep, policy);
    else candidates = await planNested(target, target.sweep, policy);
  } catch (err) {
    return {
      targetId,
      armed: true,
      reason: err instanceof Error ? err.message : String(err),
      candidates: [],
      totalBytes: 0,
    };
  }

  candidates.sort((a, b) => b.bytes - a.bytes);
  return {
    targetId,
    armed: true,
    candidates,
    totalBytes: candidates.reduce((s, c) => s + c.bytes, 0),
  };
}

export async function planSweep(targetId: string): Promise<SweepPlan> {
  const target = DISK_TARGETS.find((t) => t.id === targetId);
  if (!target)
    return { targetId, armed: false, reason: "unknown target", candidates: [], totalBytes: 0 };
  return planFor(target, policyFor(target));
}

export type SweepResult = {
  targetId: string;
  applied: boolean;
  freedBytes: number;
  removed: number;
  errors: string[];
  commandOutput?: string;
};

/**
 * The last gate. A candidate is only touched if, at this moment, it still
 * resolves inside its own target and inside ALLOWED_ROOTS — symlink and all.
 * The plan was computed a moment ago; this is checked against the filesystem
 * now, so a path that changed underneath us is skipped rather than followed.
 */
export async function isInsideTarget(candidate: string, targetPath: string): Promise<boolean> {
  try {
    const real = await realpath(candidate);
    const realTarget = await realpath(targetPath);
    if (real === realTarget) return false; // never the target directory itself
    if (!real.startsWith(`${realTarget}/`)) return false;
    return isPathAllowed(real);
  } catch {
    return false;
  }
}

export async function applySweep(targetId: string): Promise<SweepResult> {
  const target = DISK_TARGETS.find((t) => t.id === targetId);
  const result: SweepResult = { targetId, applied: false, freedBytes: 0, removed: 0, errors: [] };
  if (!target || !target.sweep) {
    result.errors.push("target is measured only");
    return result;
  }
  if (!policyFor(target).enabled) {
    result.errors.push("target is disarmed in policy");
    return result;
  }

  if (target.sweep.kind === "command") {
    const [cmd, ...args] = target.sweep.argv;
    try {
      const { stdout, stderr } = await exec(cmd, args, {
        timeout: DU_TIMEOUT_MS,
        maxBuffer: 1 << 20,
      });
      result.applied = true;
      result.commandOutput = `${stdout}${stderr}`.trim().slice(0, 2000);
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }
    return result;
  }

  const plan = await planSweep(targetId);
  for (const c of plan.candidates) {
    if (!(await isInsideTarget(c.path, target.path))) {
      result.errors.push(`refused (outside target): ${c.path}`);
      continue;
    }
    try {
      if (c.action === "truncate") await truncate(c.path, 0);
      else await rm(c.path, { recursive: true, force: true });
      result.freedBytes += c.bytes;
      result.removed += 1;
    } catch (err) {
      result.errors.push(`${c.path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  result.applied = true;

  // The scan we have is now a lie about the box.
  scanState().scan = null;
  return result;
}

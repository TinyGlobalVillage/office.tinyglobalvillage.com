/**
 * Box Health — RAID + disk SMART. Pure, no I/O, tested with node --test (storage-policy.test.mjs).
 *
 * RCS2 is bare metal (OVH): two NVMe disks in Linux software RAID1 (md2 /boot, md3 /).
 * A dead member or a worn-out disk is ours to notice now — the RCS1 VM hid both.
 *   - RAID comes from /proc/mdstat (readable without root) → parseMdstat().
 *   - SMART needs root, so a root systemd timer (mono utils/scripts/system/disk-health-collect.sh)
 *     writes a normalized JSON that Office reads → DiskHealthFile.
 * A box with neither (a VM) is "not applicable", never an error.
 */
import type { HealthFinding, HealthLevel } from "./health-policy";

export type RaidState = "healthy" | "degraded" | "rebuilding" | "inactive";

export type RaidArray = {
  name: string;
  /** raid1, raid5, … */
  level: string;
  members: string[];
  /** Members marked (F)ailed. */
  failed: string[];
  /** [total/active] from the status line. */
  total: number | null;
  active: number | null;
  /** [UU] / [U_] */
  map: string | null;
  state: RaidState;
  /** recovery/resync progress, when one is running. */
  progressPct: number | null;
  /** What is running: recovery (rebuild), resync, check (a scrub — still healthy), reshape. */
  sync: string | null;
};

/** Parse /proc/mdstat. Arrays only; an empty list means the box has no md RAID. */
export function parseMdstat(text: string): RaidArray[] {
  const out: RaidArray[] = [];
  let cur: RaidArray | null = null;
  for (const line of text.split("\n")) {
    const head = line.match(/^(md\w+)\s*:\s*(\w+)\s+(?:\(\w[^)]*\)\s+)?(raid\d+|linear|multipath)?\s*(.*)$/);
    if (head) {
      const members: string[] = [];
      const failed: string[] = [];
      for (const m of head[4].matchAll(/(\S+?)\[\d+\](\([A-Z]\))?/g)) {
        members.push(m[1]);
        if (m[2] === "(F)") failed.push(m[1]);
      }
      cur = {
        name: head[1],
        level: head[3] ?? "unknown",
        members,
        failed,
        total: null,
        active: null,
        map: null,
        state: head[2] === "active" ? "healthy" : "inactive",
        progressPct: null,
        sync: null,
      };
      out.push(cur);
      continue;
    }
    if (!cur) continue;
    if (line.trim() === "") { cur = null; continue; }
    const st = line.match(/\[(\d+)\/(\d+)\]\s+\[([U_]+)\]/);
    if (st) {
      cur.total = Number(st[1]);
      cur.active = Number(st[2]);
      cur.map = st[3];
    }
    const sync = line.match(/\b(recovery|resync|reshape|check|repair)\s*=\s*([\d.]+)%/);
    if (sync) {
      cur.sync = sync[1];
      cur.progressPct = Number(sync[2]);
    }
    const pending = line.match(/\b(resync|recovery)\s*=\s*(DELAYED|PENDING)/);
    if (pending) cur.sync = pending[1];
  }
  for (const a of out) {
    if (a.state === "inactive") continue;
    const missing = (a.total !== null && a.active !== null && a.active < a.total) || (a.map?.includes("_") ?? false) || a.failed.length > 0;
    if (a.sync === "recovery" || a.sync === "resync" || a.sync === "reshape") a.state = "rebuilding";
    else if (missing) a.state = "degraded";
  }
  return out;
}

/** One disk as the collector writes it (normalized smartctl -j output). */
export type DiskHealth = {
  dev: string;
  model: string | null;
  serial: string | null;
  /** SMART overall-health self-assessment. null = smartctl could not say. */
  passed: boolean | null;
  /** NVMe "percentage used" — the drive's own wear estimate (can pass 100). */
  percentUsed: number | null;
  tempC: number | null;
  mediaErrors: number | null;
  /** NVMe critical_warning bitfield; 0 = none. */
  criticalWarning: number | null;
  powerOnHours: number | null;
  /** The collector's error for this disk, if smartctl failed. */
  error?: string | null;
};

export type DiskHealthFile = {
  /** ISO time the collector last ran. */
  at: string;
  host?: string;
  disks: DiskHealth[];
};

export type StorageReading = {
  /** null = /proc/mdstat unreadable (not Linux). [] = Linux without md RAID. */
  raid: RaidArray[] | null;
  /** null = no collector output on this box. */
  smart: DiskHealthFile | null;
};

export type StorageThresholds = {
  /** Warn when a disk's own wear estimate reaches this percent; critical at 100. */
  diskWearWarnPct: number;
  /** Warn at this temperature (°C); critical 10 °C above. */
  diskTempWarnC: number;
};

/** The SMART file is written every 15 min; older than this and the reading is stale. */
export const SMART_STALE_MS = 90 * 60_000;

const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(n % 1 ? 1 : 0)}%`);

export function raidFinding(raid: RaidArray[] | null): HealthFinding {
  if (raid === null || raid.length === 0) {
    return { check: "raid", level: "ok", label: "RAID n/a", detail: "No software RAID on this box (a virtual disk, or a single drive) — nothing to watch." };
  }
  const bad = raid.filter((a) => a.state === "degraded" || a.state === "inactive");
  const rebuilding = raid.filter((a) => a.state === "rebuilding");
  const level: HealthLevel = bad.length ? "critical" : rebuilding.length ? "warn" : "ok";
  const desc = (a: RaidArray) =>
    a.state === "rebuilding"
      ? `${a.name} rebuilding ${a.progressPct === null ? "" : pct(a.progressPct)}`.trim()
      : a.state === "degraded"
        ? `${a.name} DEGRADED ${a.map ? `[${a.map}]` : ""}${a.failed.length ? ` — failed: ${a.failed.join(", ")}` : ""}`.trim()
        : a.state === "inactive" ? `${a.name} INACTIVE` : `${a.name} ${a.map ? `[${a.map}]` : "ok"}`;
  return {
    check: "raid",
    level,
    label: bad.length ? `RAID degraded (${bad.map((a) => a.name).join(", ")})` : rebuilding.length ? "RAID rebuilding" : `RAID ok (${raid.length})`,
    detail: bad.length
      ? `${bad.map(desc).join("; ")}. The box is running on one disk: a second failure loses data. Replace the failed drive and re-add it (rcs-stack/host.md §RAID).`
      : rebuilding.length
        ? `${rebuilding.map(desc).join("; ")}. Redundancy returns when the rebuild finishes; heavy disk work slows it.`
        : `${raid.map(desc).join(", ")} — every mirror has all its members.`,
  };
}

export function diskFinding(smart: DiskHealthFile | null, t: StorageThresholds, now: number): HealthFinding {
  if (!smart) {
    return { check: "disks", level: "ok", label: "SMART n/a", detail: "No SMART readings on this box (a virtual disk, or the collector is not installed)." };
  }
  const age = now - Date.parse(smart.at);
  const stale = !Number.isFinite(age) || age > SMART_STALE_MS;
  const issues: Array<{ level: HealthLevel; text: string }> = [];
  for (const d of smart.disks) {
    const n = d.dev.replace("/dev/", "");
    if (d.error) issues.push({ level: "warn", text: `${n}: could not be read (${d.error})` });
    if (d.passed === false) issues.push({ level: "critical", text: `${n}: SMART self-assessment FAILED` });
    if (d.criticalWarning) issues.push({ level: "critical", text: `${n}: critical warning 0x${d.criticalWarning.toString(16)}` });
    if (d.mediaErrors) issues.push({ level: "critical", text: `${n}: ${d.mediaErrors} media errors` });
    if (d.percentUsed !== null && d.percentUsed >= 100) issues.push({ level: "critical", text: `${n}: worn out (${d.percentUsed}% used)` });
    else if (d.percentUsed !== null && d.percentUsed >= t.diskWearWarnPct) issues.push({ level: "warn", text: `${n}: ${d.percentUsed}% worn` });
    if (d.tempC !== null && d.tempC >= t.diskTempWarnC + 10) issues.push({ level: "critical", text: `${n}: ${d.tempC} °C` });
    else if (d.tempC !== null && d.tempC >= t.diskTempWarnC) issues.push({ level: "warn", text: `${n}: ${d.tempC} °C` });
  }
  if (stale) issues.push({ level: "warn", text: `the last SMART reading is ${Number.isFinite(age) ? `${Math.round(age / 60_000)} min` : "of unknown"} old — is the disk-health timer running?` });
  const level: HealthLevel = issues.some((i) => i.level === "critical") ? "critical" : issues.length ? "warn" : "ok";
  const summary = smart.disks
    .map((d) => `${d.dev.replace("/dev/", "")} ${d.passed === false ? "FAILED" : d.passed ? "passed" : "?"} · ${pct(d.percentUsed)} used · ${d.tempC ?? "—"} °C`)
    .join("; ");
  return {
    check: "disks",
    level,
    label: level === "ok" ? `disks ok (${smart.disks.length})` : level === "critical" ? "disk failing" : "disk needs a look",
    detail: issues.length
      ? `${issues.map((i) => i.text).join("; ")}. ${level === "critical" ? "Order a replacement drive now — the mirror is only as good as its healthiest member." : ""}`.trim()
      : `${summary} — every disk passes, wear under ${t.diskWearWarnPct}%, under ${t.diskTempWarnC} °C.`,
  };
}

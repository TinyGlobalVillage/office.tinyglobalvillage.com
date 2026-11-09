/**
 * Box Health — WHAT counts as unhealthy. Pure, no I/O, tested with node --test.
 *
 * Capacity (compute.ts) answers "how full is the box". This answers the other
 * question an operator asks after a bad night: "was anything WRONG" — a pm2 app
 * restarting in a loop, an error log growing by the megabyte, swap climbing,
 * the disk about to hit the floor, a kernel patch waiting on a reboot for four
 * months. None of those is a percentage of a resource, so none of them fits
 * the capacity model; each is its own check with its own threshold.
 *
 * Rates, not counters. pm2's restart_time is a lifetime counter (one app here
 * reads 345,567), and a counter says nothing about tonight. Each check that
 * grows keeps a short history of readings and reports the change over the
 * last hour, scaled to an hour, so "5 restarts per hour" means the same thing
 * whether the box was sampled every 2 minutes or every 10.
 */

export type HealthCheck = "diskFree" | "swap" | "reboot" | "restarts" | "errorLog";
export type HealthLevel = "ok" | "warn" | "critical";

export type AppReading = {
  name: string;
  status: string;
  /** pm2's lifetime restart counter for the app. */
  restarts: number;
  /** Size of the app's pm2 error log in bytes, null when unreadable. */
  errBytes: number | null;
};

export type HealthReading = {
  at: number;
  diskFreeGb: number | null;
  swapPct: number | null;
  rebootRequired: boolean;
  rebootPkgs: string[];
  uptimeDays: number | null;
  apps: AppReading[];
};

/** One remembered reading, kept only as long as the rate window needs. */
export type HealthPoint = {
  at: number;
  apps: Record<string, { restarts: number; errBytes: number | null }>;
};

export type AppRate = {
  name: string;
  status: string;
  restarts: number;
  /** Restarts over the last window, scaled to an hour. Null while warming up. */
  restartsPerHour: number | null;
  /** Error-log growth over the last window, in KB per hour. Null while warming up. */
  errorKbPerHour: number | null;
};

export type HealthThresholds = {
  diskFreeWarnGb: number;
  swapWarnPct: number;
  restartsPerHourWarn: number;
  errorLogKbPerHourWarn: number;
  rebootAlerts: boolean;
};

export type HealthFinding = {
  check: HealthCheck;
  level: HealthLevel;
  /** Short, for the pill. */
  label: string;
  /** One sentence, for the alert and the modal. */
  detail: string;
  /** The apps a per-app check is about, for the alert payload. */
  apps?: string[];
};

export const HEALTH_DEFAULTS = {
  /** How far back a rate looks. */
  windowMs: 60 * 60_000,
  /** Two readings closer than this say nothing about a rate. */
  minSpanMs: 10 * 60_000,
  /** How long points are kept — a little over one window. */
  keepMs: 2 * 60 * 60_000,
  /** Consecutive agreeing ticks before a health level is believed. */
  minStreak: 2,
} as const;

/** Fold a reading into the history and drop what the window no longer needs. */
export function pushPoint(points: HealthPoint[], reading: HealthReading, keepMs: number = HEALTH_DEFAULTS.keepMs): HealthPoint[] {
  const apps: HealthPoint["apps"] = {};
  for (const a of reading.apps) apps[a.name] = { restarts: a.restarts, errBytes: a.errBytes };
  const next = points.filter((p) => reading.at - p.at <= keepMs && p.at < reading.at);
  next.push({ at: reading.at, apps });
  return next;
}

/**
 * Per-app rates over the window ending at `now`. The oldest point inside the
 * window is the baseline; a counter that went DOWN (pm2 was reset, the daemon
 * restarted) resets the baseline to the newest point after the drop instead
 * of reporting a negative rate — or a huge positive one — for an hour.
 */
export function appRates(
  points: HealthPoint[],
  reading: HealthReading,
  now: number = reading.at,
  windowMs: number = HEALTH_DEFAULTS.windowMs,
  minSpanMs: number = HEALTH_DEFAULTS.minSpanMs,
): AppRate[] {
  const inWindow = points.filter((p) => now - p.at <= windowMs && p.at <= now).sort((a, b) => a.at - b.at);
  return reading.apps.map((a) => {
    let restartsPerHour: number | null = null;
    let errorKbPerHour: number | null = null;
    // Walk back from the newest point to the oldest one whose counters are not
    // above the current reading's — that is where the last reset happened.
    let base: HealthPoint | null = null;
    for (let i = inWindow.length - 1; i >= 0; i--) {
      const p = inWindow[i].apps[a.name];
      if (!p) break;
      if (p.restarts > a.restarts) break;
      if (p.errBytes !== null && a.errBytes !== null && p.errBytes > a.errBytes) break;
      base = inWindow[i];
    }
    if (base && base.at < reading.at) {
      const span = reading.at - base.at;
      if (span >= minSpanMs) {
        const b = base.apps[a.name];
        const hours = span / 3_600_000;
        restartsPerHour = (a.restarts - b.restarts) / hours;
        if (a.errBytes !== null && b.errBytes !== null) errorKbPerHour = (a.errBytes - b.errBytes) / 1024 / hours;
      }
    }
    return { name: a.name, status: a.status, restarts: a.restarts, restartsPerHour, errorKbPerHour };
  });
}

function fmt(n: number, d = 0): string {
  return n.toFixed(d);
}

/** Every check's current level, in a fixed order, so the modal is stable. */
export function assessHealth(reading: HealthReading, rates: AppRate[], t: HealthThresholds): HealthFinding[] {
  const out: HealthFinding[] = [];

  // Disk free in GB, not percent: the capacity gauge already has the percent,
  // and the number that matters for "can the next build land" is gigabytes.
  if (reading.diskFreeGb === null) {
    out.push({ check: "diskFree", level: "ok", label: "disk —", detail: "Disk free space could not be read." });
  } else {
    const gb = reading.diskFreeGb;
    const level: HealthLevel = gb < t.diskFreeWarnGb / 2 ? "critical" : gb < t.diskFreeWarnGb ? "warn" : "ok";
    out.push({
      check: "diskFree",
      level,
      label: `${fmt(gb)} GB free`,
      detail:
        level === "ok"
          ? `${fmt(gb)} GB free on / — above the ${t.diskFreeWarnGb} GB floor.`
          : `${fmt(gb, 1)} GB free on / — below the ${t.diskFreeWarnGb} GB floor. A build staging needs room; swap lives on this disk and a full one takes the box down rather than failing gracefully.`,
    });
  }

  if (reading.swapPct === null) {
    out.push({ check: "swap", level: "ok", label: "swap —", detail: "Swap usage could not be read." });
  } else {
    const s = reading.swapPct;
    const level: HealthLevel = s >= Math.min(100, t.swapWarnPct + 40) ? "critical" : s >= t.swapWarnPct ? "warn" : "ok";
    out.push({
      check: "swap",
      level,
      label: `swap ${fmt(s)}%`,
      detail:
        level === "ok"
          ? `Swap at ${fmt(s)}% — under the ${t.swapWarnPct}% line.`
          : `Swap at ${fmt(s)}% — over the ${t.swapWarnPct}% line. RAM is oversubscribed; the next build or clone on this box runs from disk.`,
    });
  }

  {
    const level: HealthLevel = reading.rebootRequired && t.rebootAlerts ? "warn" : "ok";
    const up = reading.uptimeDays === null ? "" : ` Up ${fmt(reading.uptimeDays)} days.`;
    out.push({
      check: "reboot",
      level,
      label: reading.rebootRequired ? "reboot required" : "no reboot pending",
      detail: reading.rebootRequired
        ? `The OS has a restart pending${reading.rebootPkgs.length ? ` for ${reading.rebootPkgs.slice(0, 4).join(", ")}${reading.rebootPkgs.length > 4 ? "…" : ""}` : ""}.${up} Patches are not live until the box reboots; pick a window and run it on purpose.`
        : `No restart pending.${up}`,
    });
  }

  {
    const hot = rates.filter((r) => r.restartsPerHour !== null && r.restartsPerHour >= t.restartsPerHourWarn);
    const worst = Math.max(0, ...hot.map((r) => r.restartsPerHour ?? 0));
    const level: HealthLevel = worst >= t.restartsPerHourWarn * 4 ? "critical" : hot.length ? "warn" : "ok";
    const warming = rates.length > 0 && rates.every((r) => r.restartsPerHour === null);
    out.push({
      check: "restarts",
      level,
      label: hot.length ? `${hot.length} app${hot.length === 1 ? "" : "s"} restarting` : warming ? "restarts: warming up" : "restarts quiet",
      detail: hot.length
        ? `${hot.map((r) => `${r.name} ${fmt(r.restartsPerHour ?? 0)}×/h`).join(", ")} — over the ${t.restartsPerHourWarn}/h line. pm2 keeps relaunching it, so the tile stays green while the app is actually down between crashes; read its error log.`
        : warming
          ? "Restart rates need two readings at least ten minutes apart."
          : `No pm2 app restarted more than ${t.restartsPerHourWarn} times in the last hour.`,
      apps: hot.map((r) => r.name),
    });
  }

  {
    const loud = rates.filter((r) => r.errorKbPerHour !== null && r.errorKbPerHour >= t.errorLogKbPerHourWarn);
    const level: HealthLevel = loud.length ? "warn" : "ok";
    out.push({
      check: "errorLog",
      level,
      label: loud.length ? `${loud.length} error log${loud.length === 1 ? "" : "s"} growing` : "error logs quiet",
      detail: loud.length
        ? `${loud.map((r) => `${r.name} +${fmt(r.errorKbPerHour ?? 0)} KB/h`).join(", ")} — over the ${t.errorLogKbPerHourWarn} KB/h line. Something is failing on every request or every tick; pm2 logs <name> --err shows what.`
        : `No pm2 error log grew more than ${t.errorLogKbPerHourWarn} KB in the last hour.`,
      apps: loud.map((r) => r.name),
    });
  }

  return out;
}

const RANK: Record<HealthLevel, number> = { ok: 0, warn: 1, critical: 2 };

/** The worst level across findings — the section's pill. */
export function worstLevel(findings: HealthFinding[]): HealthLevel {
  return findings.reduce<HealthLevel>((w, f) => (RANK[f.level] > RANK[w] ? f.level : w), "ok");
}

/**
 * Box Health — reads the box, keeps the short history the rates need, and
 * turns findings into team alerts through the same edge-triggered policy the
 * capacity alert uses. The decisions live in health-policy.ts (pure, tested);
 * this file is the I/O around them.
 *
 * Runs inside the sampler's tick (sampler.ts), so it inherits the cadence knob
 * and the one-writer rule, and needs no samples table: a restart storm is
 * reported whether or not collection has been set up.
 *
 * pm2 is read with `pm2 jlist` as the Office user, which is the user the apps
 * run under. On a box without pm2 (a Mac, a container) the app list is simply
 * empty and the other four checks still run; /proc missing (a Mac) leaves swap
 * null, which the policy reports as "could not be read" rather than 0%.
 */
import "server-only";
import { execFile } from "child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { statfs } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { type AlertState, INITIAL_ALERT_STATE, decideAlert } from "./alert-policy";
import { sendTeamAlert } from "./alerts";
import { hostName, readConfig } from "./config";
import {
  HEALTH_DEFAULTS,
  type AppRate,
  type AppReading,
  type HealthCheck,
  type HealthFinding,
  type HealthLevel,
  type HealthPoint,
  type HealthReading,
  appRates,
  assessHealth,
  pushPoint,
  worstLevel,
} from "./health-policy";
import { hostMetricsState } from "./state";

const DIR = path.join(process.cwd(), "data", "host-metrics");
const FILE = path.join(DIR, "health-state.json");
const execFileP = promisify(execFile);

export type HealthReport = {
  at: number;
  host: string;
  reading: HealthReading;
  rates: AppRate[];
  findings: HealthFinding[];
  /** Worst-of the findings — the section's pill. */
  level: HealthLevel;
  /** Per-check alert state, so the modal can say "alerting since". */
  alerts: Partial<Record<HealthCheck, AlertState>>;
  /** What this evaluation actually sent. */
  fired: Array<{ check: HealthCheck; kind: "raise" | "recover"; level: HealthLevel }>;
};

type StateFile = {
  points: HealthPoint[];
  /** `${host}:${check}` → state. Multi-box from day one, like alert-state.json. */
  alerts: Record<string, AlertState>;
};

function readState(): StateFile {
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as Partial<StateFile>;
    return {
      points: Array.isArray(raw.points) ? raw.points : [],
      alerts: raw.alerts && typeof raw.alerts === "object" ? raw.alerts : {},
    };
  } catch {
    return { points: [], alerts: {} };
  }
}

function writeState(state: StateFile): void {
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
  } catch {
    // Losing the file costs one duplicate alert and one warm-up window —
    // both better than a check that stops because it could not write.
  }
}

async function diskFreeGb(): Promise<number | null> {
  try {
    const fs = await statfs("/");
    return (Number(fs.bavail) * Number(fs.bsize)) / 1e9;
  } catch {
    return null;
  }
}

function swapPct(): number | null {
  try {
    const text = readFileSync("/proc/meminfo", "utf8");
    const grab = (k: string) => {
      const m = text.match(new RegExp(`^${k}:\\s+(\\d+)`, "m"));
      return m ? Number(m[1]) : null;
    };
    const total = grab("SwapTotal");
    const free = grab("SwapFree");
    if (total === null || free === null) return null;
    if (total === 0) return 0;
    return ((total - free) / total) * 100;
  } catch {
    return null;
  }
}

function rebootRequired(): { required: boolean; pkgs: string[] } {
  const required = existsSync("/var/run/reboot-required");
  let pkgs: string[] = [];
  if (required) {
    try {
      pkgs = readFileSync("/var/run/reboot-required.pkgs", "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    } catch {
      pkgs = [];
    }
  }
  return { required, pkgs };
}

type Pm2Row = {
  name?: string;
  pm2_env?: { status?: string; restart_time?: number; pm_err_log_path?: string };
};

async function pm2Apps(): Promise<AppReading[]> {
  try {
    const { stdout } = await execFileP("pm2", ["jlist"], {
      timeout: 20_000,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, PM2_SILENT: "true" },
    });
    // pm2 occasionally prefixes a notice line; the array starts at the first '['.
    const start = stdout.indexOf("[");
    if (start < 0) return [];
    const rows = JSON.parse(stdout.slice(start)) as Pm2Row[];
    return rows
      .filter((r) => typeof r.name === "string")
      .map((r) => {
        let errBytes: number | null = null;
        const p = r.pm2_env?.pm_err_log_path;
        if (p) {
          try {
            errBytes = statSync(p).size;
          } catch {
            errBytes = null;
          }
        }
        return {
          name: r.name as string,
          status: r.pm2_env?.status ?? "unknown",
          restarts: Number(r.pm2_env?.restart_time ?? 0) || 0,
          errBytes,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/** One reading of everything the checks look at. Never throws. */
export async function readHealth(at: number = Date.now()): Promise<HealthReading> {
  const [disk, apps] = await Promise.all([diskFreeGb(), pm2Apps()]);
  const reboot = rebootRequired();
  return {
    at,
    diskFreeGb: disk,
    swapPct: swapPct(),
    rebootRequired: reboot.required,
    rebootPkgs: reboot.pkgs,
    uptimeDays: os.uptime() / 86_400,
    apps,
  };
}

function titleFor(host: string, f: HealthFinding, kind: "raise" | "recover"): string {
  if (kind === "recover") return `${host} health recovered: ${f.label}`;
  const word = f.level === "critical" ? "CRITICAL" : "warning";
  return `${host} ${word}: ${f.label}`;
}

function descriptionFor(host: string, f: HealthFinding, kind: "raise" | "recover"): string {
  if (kind === "recover") {
    return `${f.detail} This closes out the previous ${f.check} alert for ${host}.`;
  }
  return `${f.detail} Open Utils → Hardening → Box Usage → Box health for the per-app table and the thresholds.`;
}

/**
 * Read, remember, assess, alert. Called by the sampler on every tick; the
 * per-check streak (2 agreeing ticks) and edge-only firing come from
 * alert-policy.ts, so a one-off spike between two reads is not an alert and a
 * box that stays broken is told about once, plus once more when it recovers.
 */
export async function evaluateHealth(now: number = Date.now()): Promise<HealthReport> {
  const cfg = readConfig();
  const host = hostName();
  const reading = await readHealth(now);
  const state = readState();

  state.points = pushPoint(state.points, reading);
  const rates = appRates(state.points, reading, now);
  const findings = assessHealth(reading, rates, cfg);

  const alerts: HealthReport["alerts"] = {};
  const fired: HealthReport["fired"] = [];

  for (const f of findings) {
    const key = `${host}:${f.check}`;
    const prev = state.alerts[key] ?? INITIAL_ALERT_STATE;
    const { next, fire } = decideAlert(prev, f.level, now, { minStreak: HEALTH_DEFAULTS.minStreak });
    state.alerts[key] = next;
    alerts[f.check] = next;
    // Same ordering rule as the capacity alert: the state advances even with
    // alerts muted, so switching them on does not replay an old crossing.
    if (!fire || !cfg.alertsEnabled) continue;
    try {
      await sendTeamAlert({
        title: titleFor(host, f, fire.kind),
        description: descriptionFor(host, f, fire.kind),
        at: now,
        payload: { host, check: f.check, level: fire.level, kind: fire.kind, apps: f.apps ?? [] },
        action: `host-metrics.health.${f.check}.${fire.kind}`,
        target: host,
        success: fire.kind === "recover",
        details: { level: fire.level, label: f.label, apps: f.apps ?? [] },
      });
      fired.push({ check: f.check, kind: fire.kind, level: fire.level });
    } catch {
      // Not delivered: keep the previous marker so the next tick retries.
      state.alerts[key] = prev;
      alerts[f.check] = prev;
    }
  }

  writeState(state);
  return { at: now, host, reading, rates, findings, level: worstLevel(findings), alerts, fired };
}

/**
 * What the modal shows. The sampler's last report when there is one;
 * otherwise a fresh read-only look (no state written, nothing sent), so the
 * section has numbers the first time it is opened and on a box where the
 * sampler is not this process.
 */
export async function healthStatus(): Promise<HealthReport | null> {
  const s = hostMetricsState();
  if (s.lastHealth) return s.lastHealth;
  const cfg = readConfig();
  if (!cfg.healthEnabled) return null;
  const host = hostName();
  const reading = await readHealth();
  const state = readState();
  const rates = appRates(pushPoint(state.points, reading), reading, reading.at);
  const findings = assessHealth(reading, rates, cfg);
  const alerts: HealthReport["alerts"] = {};
  for (const f of findings) {
    const st = state.alerts[`${host}:${f.check}`];
    if (st) alerts[f.check] = st;
  }
  return { at: reading.at, host, reading, rates, findings, level: worstLevel(findings), alerts, fired: [] };
}

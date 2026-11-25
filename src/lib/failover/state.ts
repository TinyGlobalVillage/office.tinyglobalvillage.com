import "server-only";
// Failover (RCS1 warm standby) — the Office side of mono utils/scripts/system/failover/.
//
// RCS1 keeps a live copy of RCS2 (streaming Postgres + Redis, files every 5 min, builds nightly) and
// takes over when RCS2 is down (two witnesses agree for DOWN_MINUTES). Root cron jobs on RCS2 publish
// what Office shows into one dir owned by admin:tgv:
//   rcs1-status.json  RCS1's watcher status (witnesses, copy lag, last drill, takeover)
//   health.json       problems RCS2 sees with the standby (edge-alerted by email + team alert)
//   next-drill.json   date of the next sealed quarterly drill
//   last-sync-*.json  the data / full file copies to RCS1
//   settings.env      tunables — Office writes; RCS2 pushes it to RCS1 every minute
//   drill-request     Office drops it; RCS2 starts a sealed drill on RCS1 at its next 5-min tick
// Office never touches RCS1 or a service itself, so it needs no root. The dir is an env var so another
// deployment can point Office at its own standby.
import fs from "node:fs";
import path from "node:path";
import { coerce, DEFAULTS, type FailoverSettings, type FailoverSnapshot } from "./config";

export * from "./config";

export const FAILOVER_DIR = process.env.FAILOVER_DIR || "/srv/refusion-core/data/failover";
const P = (f: string) => path.join(FAILOVER_DIR, f);

const KEYS: Record<string, keyof FailoverSettings> = {
  AUTO_TAKEOVER: "autoTakeover",
  HOLD: "hold",
  DOWN_MINUTES: "downMinutes",
  WARN_MINUTE: "warnMinute",
  MAX_LAG_MINUTES: "maxLagMinutes",
  ALERT_TO: "alertTo",
  DRILL_MONTHS: "drillMonths",
};

function readJson<T>(f: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(P(f), "utf8")) as T;
  } catch {
    return null;
  }
}

export function readSettings(): FailoverSettings {
  let text = "";
  try {
    text = fs.readFileSync(P("settings.env"), "utf8");
  } catch {
    return { ...DEFAULTS };
  }
  const raw: Record<string, unknown> = {};
  for (const line of text.split("\n")) {
    const m = /^([A-Z_]+)=["']?([^"'\r]*)["']?\s*$/.exec(line.trim());
    if (!m || !KEYS[m[1]]) continue;
    const k = KEYS[m[1]];
    const v = m[2].trim();
    raw[k] = k === "autoTakeover" || k === "hold" ? v === "1" : k === "drillMonths" ? v.split(/\s+/).map(Number) : k === "alertTo" ? v : Number(v);
  }
  return coerce(raw);
}

export function writeSettings(patch: Partial<FailoverSettings>): FailoverSettings {
  const next = coerce({ ...readSettings(), ...patch }, readSettings());
  const body = [
    "# Written by Office → Utils → System Hardening → Failover. Parsed (never sourced) by failover.env.",
    `AUTO_TAKEOVER=${next.autoTakeover ? 1 : 0}`,
    `HOLD=${next.hold ? 1 : 0}`,
    `DOWN_MINUTES=${next.downMinutes}`,
    `WARN_MINUTE=${next.warnMinute}`,
    `MAX_LAG_MINUTES=${next.maxLagMinutes}`,
    `ALERT_TO=${next.alertTo}`,
    `DRILL_MONTHS="${next.drillMonths.join(" ")}"`,
    "",
  ].join("\n");
  const tmp = P(`settings.env.${process.pid}.tmp`);
  fs.writeFileSync(tmp, body, { mode: 0o664 });
  fs.renameSync(tmp, P("settings.env"));
  return next;
}

export function requestDrill(): void {
  fs.writeFileSync(P("drill-request"), new Date().toISOString() + "\n", { mode: 0o664 });
}

export function readSnapshot(): FailoverSnapshot {
  return {
    installed: fs.existsSync(FAILOVER_DIR),
    settings: readSettings(),
    rcs1: readJson("rcs1-status.json"),
    health: readJson("health.json"),
    nextDrill: readJson<{ next_drill: string }>("next-drill.json")?.next_drill ?? null,
    sync: { data: readJson("last-sync-data.json"), full: readJson("last-sync-full.json") },
    drillRequested: fs.existsSync(P("drill-request")),
  };
}

/**
 * Box Usage Monitor — WHERE an alert goes, and the state that keeps it quiet.
 * The decision of WHEN lives in alert-policy.ts, pure and tested.
 *
 * Delivery is a `user_alerts` row with `visibility: "team"` and `source: "rcs"`
 * — the same table the Front Desk board and My Alerts already read, so a
 * capacity warning lands where staff are already looking instead of inventing a
 * private notification channel nobody has open.
 *
 * The per-host state is persisted to disk rather than kept in memory, because
 * the most likely reason this process restarts is the box being in trouble.
 * In-memory state would forget it had already alerted and page again on the way
 * back up — exactly when someone is mid-fix and least wants it.
 */
import "server-only";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { user_alerts } from "@tgv/module-calendar/alerts/db";
import { alertsDb } from "../alerts-db";
import { logHardeningAction } from "../audit-log";
import {
  type AlertLevel,
  type AlertState,
  INITIAL_ALERT_STATE,
  decideAlert,
  levelFor,
} from "./alert-policy";
import { readConfig } from "./config";
import type { Resource } from "./compute";

const DIR = path.join(process.cwd(), "data", "host-metrics");
const FILE = path.join(DIR, "alert-state.json");

/** host → state. Multi-box from day one; a second box is another key. */
type StateFile = Record<string, AlertState>;

function readState(): StateFile {
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8"));
    return raw && typeof raw === "object" ? (raw as StateFile) : {};
  } catch {
    return {};
  }
}

function writeState(state: StateFile): void {
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
  } catch {
    // Losing the file means the next crossing may alert twice. That is the
    // right way to fail: a duplicate alert beats a silent one.
  }
}

const RESOURCE_LABEL: Record<Resource, string> = {
  cpu: "CPU",
  ram: "RAM",
  disk: "disk",
  bandwidth: "bandwidth",
};

function title(host: string, level: AlertLevel, worst: Resource, pct: number): string {
  if (level === "ok") return `${host} capacity recovered`;
  const word = level === "critical" ? "CRITICAL" : "warning";
  return `${host} ${word}: ${RESOURCE_LABEL[worst]} at ${pct.toFixed(0)}%`;
}

function description(host: string, level: AlertLevel, worst: Resource, pct: number): string {
  if (level === "ok") {
    return `${host} has been back under its warning threshold for several consecutive samples. Nothing to do — this closes out the previous capacity alert.`;
  }
  const lead =
    level === "critical"
      ? `${host} is nearly out of ${RESOURCE_LABEL[worst]}`
      : `${host} is running low on ${RESOURCE_LABEL[worst]}`;
  return (
    `${lead} — sustained at ${pct.toFixed(1)}% across several consecutive samples, ` +
    `so this is load, not a spike. Open Utils → Hardening → Box Usage for the history ` +
    `and the per-resource breakdown.`
  );
}

/**
 * Fold one sample into the alert state for `host` and send anything due.
 *
 * Never throws: the sampler calls this inside its tick, and an alerting failure
 * must not stop collection — losing the history is a bigger loss than missing
 * one notification.
 */
export async function evaluateAlert(
  host: string,
  worstPct: number,
  worst: Resource,
  now: number = Date.now(),
): Promise<{ fired: "raise" | "recover" | null; level: AlertLevel }> {
  const cfg = readConfig();
  const all = readState();
  const prev = all[host] ?? INITIAL_ALERT_STATE;

  const observed = levelFor(
    worstPct,
    cfg.warnPct,
    cfg.criticalPct,
    prev.firedLevel !== null,
  );
  const { next, fire } = decideAlert(prev, observed, now);

  all[host] = next;
  writeState(all);

  // The switch is checked AFTER the state update on purpose: with alerts off we
  // still track levels, so turning them back on doesn't immediately replay a
  // crossing that happened while they were muted.
  if (!fire || !cfg.alertsEnabled) return { fired: null, level: observed };

  try {
    await alertsDb.insert(user_alerts).values({
      user_id: "rcs",
      title: title(host, fire.level, worst, worstPct),
      description: description(host, fire.level, worst, worstPct),
      trigger_at: new Date(now).toISOString(),
      channels: ["dashboard"],
      recurrence: "none",
      visibility: "team",
      source: "rcs",
      payload: { host, level: fire.level, kind: fire.kind, worst, worstPct },
    });
    logHardeningAction({
      action: `host-metrics.alert.${fire.kind}`,
      target: host,
      user: "rcs",
      success: fire.kind === "recover",
      details: { level: fire.level, worst, pct: Number(worstPct.toFixed(1)) },
    });
  } catch {
    // Roll the fired marker back so the next tick retries rather than treating
    // an alert that never left the building as delivered.
    all[host] = prev;
    writeState(all);
    return { fired: null, level: observed };
  }

  return { fired: fire.kind, level: observed };
}

/** Current per-host alert state — the modal shows this next to the sampler's. */
export function alertState(host: string): AlertState {
  return readState()[host] ?? INITIAL_ALERT_STATE;
}

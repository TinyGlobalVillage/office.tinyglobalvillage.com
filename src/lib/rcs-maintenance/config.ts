/**
 * RCS Maintenance — the tunables the Hardening modal owns.
 * `data/rcs-maintenance/rcs-maintenance-config.json`; reads never throw, a
 * missing or corrupt file yields the defaults (Gio's rulings, 2026-11-01).
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export const MAINT_DIR = path.join(process.cwd(), "data", "rcs-maintenance");
const FILE = path.join(MAINT_DIR, "rcs-maintenance-config.json");

export type UpdatesScope = "security" | "all";

export type MaintenanceConfig = {
  /** Master switch: off = still measured and shown, nothing sent. */
  enabled: boolean;
  /** "RCS UPDATES AND REBOOT NEEDED" while /var/run/reboot-required exists. */
  rebootAlerts: boolean;
  /** "RCS UPDATES NEEDED" when updates wait past the threshold. */
  updatesAlerts: boolean;
  /** Which pending updates count: security only (default) or every upgradable package. */
  updatesScope: UpdatesScope;
  /** Hours updates may wait before the first notice. */
  updatesThresholdHours: number;
  /** Hours a pending reboot may wait before the first notice. 0 = at once. */
  rebootThresholdHours: number;
  /** Days between repeats while it is still pending. */
  reminderDays: number;
  /** Post to the Front Desk team alerts board. */
  frontDesk: boolean;
  /** Email the recipients below. */
  email: boolean;
  recipients: string[];
  /** apt-check is a slow python script — run it at most this often. */
  aptCheckEveryMin: number;
  lastUpdated: string | null;
  updatedBy: string | null;
};

export const MAINT_DEFAULTS: MaintenanceConfig = {
  enabled: true,
  rebootAlerts: true,
  updatesAlerts: true,
  updatesScope: "security",
  updatesThresholdHours: 24,
  rebootThresholdHours: 0,
  reminderDays: 3,
  frontDesk: true,
  email: true,
  recipients: ["admin@tinyglobalvillage.com"],
  aptCheckEveryMin: 60,
  lastUpdated: null,
  updatedBy: null,
};

const CLAMPS = {
  updatesThresholdHours: [0, 24 * 30],
  rebootThresholdHours: [0, 24 * 30],
  reminderDays: [0.25, 30],
  aptCheckEveryMin: [5, 24 * 60],
} as const;

function num(key: keyof typeof CLAMPS, v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : MAINT_DEFAULTS[key];
  const [lo, hi] = CLAMPS[key];
  return Math.min(hi, Math.max(lo, n));
}

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

function coerce(raw: unknown): MaintenanceConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<MaintenanceConfig>;
  const recipients = Array.isArray(o.recipients)
    ? [...new Set(o.recipients.filter((r): r is string => typeof r === "string").map((r) => r.trim().toLowerCase()).filter((r) => EMAIL.test(r)))].slice(0, 20)
    : MAINT_DEFAULTS.recipients;
  return {
    enabled: o.enabled !== false,
    rebootAlerts: o.rebootAlerts !== false,
    updatesAlerts: o.updatesAlerts !== false,
    updatesScope: o.updatesScope === "all" ? "all" : "security",
    updatesThresholdHours: num("updatesThresholdHours", o.updatesThresholdHours),
    rebootThresholdHours: num("rebootThresholdHours", o.rebootThresholdHours),
    reminderDays: num("reminderDays", o.reminderDays),
    frontDesk: o.frontDesk !== false,
    email: o.email !== false,
    recipients,
    aptCheckEveryMin: num("aptCheckEveryMin", o.aptCheckEveryMin),
    lastUpdated: typeof o.lastUpdated === "string" ? o.lastUpdated : null,
    updatedBy: typeof o.updatedBy === "string" ? o.updatedBy : null,
  };
}

export function readMaintenanceConfig(): MaintenanceConfig {
  try {
    return coerce(JSON.parse(readFileSync(FILE, "utf8")));
  } catch {
    return { ...MAINT_DEFAULTS, recipients: [...MAINT_DEFAULTS.recipients] };
  }
}

export function writeMaintenanceConfig(patch: Partial<MaintenanceConfig>, by: string): MaintenanceConfig {
  const next = coerce({ ...readMaintenanceConfig(), ...patch, lastUpdated: new Date().toISOString(), updatedBy: by });
  mkdirSync(MAINT_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

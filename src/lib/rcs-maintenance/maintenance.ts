/**
 * RCS Maintenance — reads whether the box needs a reboot or is sitting on
 * updates, and keeps telling the team until somebody acts. The decisions live
 * in policy.ts (pure, tested); this file is the I/O around them.
 *
 * Runs inside the host-metrics sampler's tick (instance 0 only, one writer),
 * so it needs no cron of its own. Two channels, both tunable in Utils →
 * System Hardening → RCS Maintenance:
 *   - Front Desk: a `user_alerts` team row through `sendTeamAlert`, the same
 *     board the capacity and health alerts land on.
 *   - Email: Office's house SMTP sender, to the configured recipients
 *     (admin@tinyglobalvillage.com by default). Subjects are fixed so a mail
 *     rule can catch them: "RCS UPDATES AND REBOOT NEEDED" / "RCS UPDATES NEEDED".
 *
 * Reboot history is written by the Mac-side reboot runner
 * (utils/scripts/system/rcs-reboot.sh) as one JSON line per reboot in
 * data/rcs-maintenance/reboots.jsonl; this file only reads it. A boot that did
 * NOT come through the runner (the host provider, a kernel panic) is still
 * noticed here, from the boot time moving, and audit-logged.
 */
import "server-only";
import { execFile } from "child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { logHardeningAction } from "../audit-log";
import { sendMail } from "../email/sendMail";
import { sendTeamAlert } from "../host-metrics/alerts";
import { hostName } from "../host-metrics/config";
import { MAINT_DIR, type MaintenanceConfig, readMaintenanceConfig } from "./config";
import {
  INITIAL_NOTICE,
  type NoticeKind,
  type NoticeSend,
  type NoticeState,
  type NoticeTiming,
  ageText,
  decideNotice,
  nextDueAt,
  parseAptCheck,
  uniquePkgs,
} from "./policy";

const STATE_FILE = path.join(MAINT_DIR, "state.json");
const REBOOTS_FILE = path.join(MAINT_DIR, "reboots.jsonl");
const APT_CHECK = "/usr/lib/update-notifier/apt-check";
const OFFICE_URL = process.env.OFFICE_PUBLIC_URL || "https://office.tinyglobalvillage.com";
const execFileP = promisify(execFile);
const KEY = Symbol.for("tgv.rcs-maintenance.last");

export type AptReading = { at: number; all: number; security: number } | { at: number; error: string };

export type SendRecord = {
  at: number;
  kind: NoticeKind;
  send: NoticeSend;
  frontDesk: "sent" | "off" | string;
  email: "sent" | "off" | string;
};

type StateFile = {
  reboot: NoticeState;
  updates: NoticeState;
  apt: AptReading | null;
  bootAt: number | null;
  sends: SendRecord[];
};

/** One reboot as the Mac-side runner recorded it. */
export type RebootRecord = {
  id: string;
  by: string;
  reason?: string;
  startedAt: string;
  finishedAt?: string;
  outcome: "ok" | "partial" | "failed" | "aborted";
  /** Sites unreachable → every site answering again. The headline number. */
  downtimeMs: number | null;
  /** Stage name → ms after the reboot command. */
  stages: Record<string, number | null>;
  sites?: Array<{ host: string; code: number; backAtMs: number | null }>;
  pm2?: { online: number; total: number };
  maintenancePage?: boolean;
  notes?: string[];
};

export type MaintenanceReport = {
  at: number;
  host: string;
  rebootRequired: boolean;
  rebootSince: number | null;
  rebootPkgs: string[];
  apt: AptReading | null;
  pendingCount: number | null;
  bootAt: number;
  uptimeDays: number;
  reboot: NoticeState & { nextDueAt: number | null };
  updates: NoticeState & { nextDueAt: number | null };
  sends: SendRecord[];
  config: MaintenanceConfig;
};

function readState(): StateFile {
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, "utf8")) as Partial<StateFile>;
    return {
      reboot: raw.reboot ?? INITIAL_NOTICE,
      updates: raw.updates ?? INITIAL_NOTICE,
      apt: raw.apt ?? null,
      bootAt: typeof raw.bootAt === "number" ? raw.bootAt : null,
      sends: Array.isArray(raw.sends) ? raw.sends : [],
    };
  } catch {
    return { reboot: INITIAL_NOTICE, updates: INITIAL_NOTICE, apt: null, bootAt: null, sends: [] };
  }
}

function writeState(s: StateFile): void {
  try {
    mkdirSync(MAINT_DIR, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + "\n", "utf8");
  } catch {
    // A lost state file costs one early repeat — better than a check that stops.
  }
}

function readRebootRequired(): { required: boolean; since: number | null; pkgs: string[] } {
  const f = "/var/run/reboot-required";
  if (!existsSync(f)) return { required: false, since: null, pkgs: [] };
  let since: number | null = null;
  try {
    since = statSync(f).mtimeMs;
  } catch {
    since = null;
  }
  let pkgs: string[] = [];
  try {
    pkgs = uniquePkgs(readFileSync(`${f}.pkgs`, "utf8").split("\n"));
  } catch {
    pkgs = [];
  }
  return { required: true, since, pkgs };
}

async function runAptCheck(now: number): Promise<AptReading | null> {
  if (!existsSync(APT_CHECK)) return null; // not Ubuntu (a Mac dev box)
  try {
    const { stderr, stdout } = await execFileP(APT_CHECK, [], { timeout: 90_000 });
    const parsed = parseAptCheck(`${stdout}\n${stderr}`);
    return parsed ? { at: now, ...parsed } : { at: now, error: "unreadable apt-check output" };
  } catch (err) {
    // apt-check exits non-zero while dpkg holds its lock (unattended-upgrades
    // mid-run); its stderr may still carry the counts.
    const e = err as { stderr?: string; message?: string };
    const parsed = e.stderr ? parseAptCheck(e.stderr) : null;
    return parsed ? { at: now, ...parsed } : { at: now, error: (e.message ?? "apt-check failed").slice(0, 200) };
  }
}

export function readReboots(limit = 20): RebootRecord[] {
  try {
    return readFileSync(REBOOTS_FILE, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as RebootRecord;
        } catch {
          return null;
        }
      })
      .filter((r): r is RebootRecord => r !== null && typeof r.startedAt === "string")
      .slice(-limit)
      .reverse();
  } catch {
    return [];
  }
}

function timings(cfg: MaintenanceConfig): Record<NoticeKind, NoticeTiming> {
  const reminderMs = cfg.reminderDays * 86_400_000;
  return {
    reboot: { thresholdMs: cfg.rebootThresholdHours * 3_600_000, reminderMs },
    updates: { thresholdMs: cfg.updatesThresholdHours * 3_600_000, reminderMs },
  };
}

function pendingOf(apt: AptReading | null, scope: MaintenanceConfig["updatesScope"]): number | null {
  if (!apt || "error" in apt) return null;
  return scope === "all" ? apt.all : apt.security;
}

// ── message text ────────────────────────────────────────────────────────────

type Msg = { subject: string; title: string; lines: string[] };

function compose(kind: NoticeKind, send: NoticeSend, r: MaintenanceReport, n: NoticeState): Msg {
  const age = n.activeSince !== null ? ageText(r.at - n.activeSince) : null;
  const sinceTxt = n.activeSince !== null ? new Date(n.activeSince).toUTCString() : "unknown";
  const updatesLine =
    r.apt && !("error" in r.apt)
      ? `Pending updates: ${r.apt.security} security, ${r.apt.all} total.`
      : "Pending updates: could not be read.";
  const how = [
    `How to reboot: in any Claude lane, say "reboot". Claude runs the preflight, puts the TGV maintenance page in front of every site, reboots RCS, measures the downtime and takes the page down again (procedure: ~/.claude/procedures/rcs-reboot.md).`,
    `Status and settings: ${OFFICE_URL}/dashboard/utils?view=rcs-maintenance`,
  ];
  if (kind === "reboot" && send !== "resolve") {
    const nth = send === "remind" ? ` (reminder ${n.sentCount - 1})` : "";
    return {
      subject: `RCS UPDATES AND REBOOT NEEDED${age ? ` — pending ${age}` : ""}`,
      title: `RCS UPDATES AND REBOOT NEEDED${nth}`,
      lines: [
        `${r.host} has been waiting for a reboot since ${sinceTxt}${age ? ` (${age})` : ""}. Installed patches are not live until it reboots.`,
        r.rebootPkgs.length ? `Waiting on: ${r.rebootPkgs.join(", ")}.` : "",
        updatesLine,
        `Up ${r.uptimeDays.toFixed(0)} days.`,
        ...how,
        `This repeats every ${r.config.reminderDays} day${r.config.reminderDays === 1 ? "" : "s"} until the box reboots.`,
      ].filter(Boolean),
    };
  }
  if (kind === "reboot") {
    const last = readReboots(1)[0];
    const recent = last && Math.abs(Date.parse(last.startedAt) - r.bootAt) < 6 * 3_600_000 ? last : null;
    return {
      subject: "RCS REBOOTED — updates are live",
      title: "RCS rebooted — updates are live",
      lines: [
        `${r.host} booted at ${new Date(r.bootAt).toUTCString()} and no longer needs a reboot.`,
        recent?.downtimeMs != null ? `Measured downtime: ${(recent.downtimeMs / 1000).toFixed(0)} s (sites down → every site back).` : "",
        updatesLine,
        `History: ${OFFICE_URL}/dashboard/utils?view=rcs-maintenance`,
      ].filter(Boolean),
    };
  }
  if (send !== "resolve") {
    const count = pendingOf(r.apt, r.config.updatesScope) ?? 0;
    const what = r.config.updatesScope === "all" ? "package updates" : "security updates";
    const nth = send === "remind" ? ` (reminder ${n.sentCount - 1})` : "";
    return {
      subject: `RCS UPDATES NEEDED — ${count} ${what} waiting${age ? ` ${age}` : ""}`,
      title: `RCS UPDATES NEEDED${nth}`,
      lines: [
        `${r.host} has had ${count} ${what} pending since ${sinceTxt}${age ? ` (${age})` : ""}.`,
        r.config.updatesScope === "security"
          ? "unattended-upgrades normally installs security updates within a day, so this usually means it is failing — check /var/log/unattended-upgrades/."
          : "",
        updatesLine,
        ...how,
        `This repeats every ${r.config.reminderDays} day${r.config.reminderDays === 1 ? "" : "s"} until they are installed.`,
      ].filter(Boolean),
    };
  }
  return {
    subject: "RCS UPDATES INSTALLED",
    title: "RCS updates installed",
    lines: [`${r.host} has no ${r.config.updatesScope === "all" ? "package" : "security"} updates pending any more.`, updatesLine],
  };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Mail clients drop CSS variables and stylesheets, so the email carries inline hex.
const MAIL = {
  accent: "#ffc53d", // colour-literal: email inline style, no CSS vars in mail clients
  bg: "#0b0b10", // colour-literal: email inline style, no CSS vars in mail clients
  text: "#e8e8ef", // colour-literal: email inline style, no CSS vars in mail clients
  title: "#fff", // colour-literal: email inline style, no CSS vars in mail clients
};

function html(m: Msg): string {
  const body = m.lines.map((l) => `<p style="margin:0 0 12px;line-height:1.5">${esc(l).replace(/(https:\/\/[^\s]+)/g, `<a href="$1" style="color:${MAIL.accent}">$1</a>`)}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:${MAIL.bg};font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:${MAIL.text}">
<div style="max-width:560px;margin:0 auto;padding:28px 24px">
<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${MAIL.accent};font-weight:700">Tiny Global Village · RCS</div>
<h1 style="font-size:20px;margin:10px 0 18px;color:${MAIL.title}">${esc(m.title)}</h1>
<div style="border-left:3px solid ${MAIL.accent};padding-left:14px;font-size:14px">${body}</div>
</div></body></html>`;
}

async function deliver(kind: NoticeKind, send: NoticeSend, r: MaintenanceReport, n: NoticeState, cfg: MaintenanceConfig, testBy: string | null = null): Promise<SendRecord> {
  const m = compose(kind, send, r, n);
  if (testBy) {
    m.subject = `[TEST] ${m.subject}`;
    m.title = `[TEST] ${m.title}`;
    m.lines.unshift(`This is a test sent by ${testBy} from Utils → System Hardening → RCS Maintenance. Nothing needs doing because of it.`);
  }
  const rec: SendRecord = { at: r.at, kind, send, frontDesk: "off", email: "off" };
  if (cfg.frontDesk) {
    try {
      await sendTeamAlert({
        title: m.title,
        description: m.lines.join(" "),
        at: r.at,
        payload: { host: r.host, kind, send, since: n.activeSince, pkgs: r.rebootPkgs, apt: r.apt },
        action: `rcs-maintenance.${kind}.${send}`,
        target: r.host,
        success: send === "resolve",
        details: { since: n.activeSince ? new Date(n.activeSince).toISOString() : null, count: n.sentCount },
      });
      rec.frontDesk = "sent";
    } catch (err) {
      rec.frontDesk = `failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 200);
    }
  }
  // Closing notices for updates stay on the board only — the inbox gets the
  // things that need doing, plus the one that says the reboot happened.
  const mailIt = cfg.email && cfg.recipients.length > 0 && !(kind === "updates" && send === "resolve");
  if (mailIt) {
    try {
      await sendMail({ to: cfg.recipients, subject: m.subject, text: m.lines.join("\n\n"), html: html(m) });
      rec.email = "sent";
      logHardeningAction({ action: `rcs-maintenance.email.${kind}.${send}`, target: cfg.recipients.join(","), user: "rcs", success: true, details: { subject: m.subject } });
    } catch (err) {
      rec.email = `failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 200);
      logHardeningAction({ action: `rcs-maintenance.email.${kind}.${send}`, target: cfg.recipients.join(","), user: "rcs", success: false, details: { error: rec.email } });
    }
  }
  return rec;
}

const delivered = (rec: SendRecord) => rec.frontDesk === "sent" || rec.email === "sent";

// ── evaluation ──────────────────────────────────────────────────────────────

async function observe(state: StateFile, cfg: MaintenanceConfig, now: number, refreshApt: boolean) {
  const rr = readRebootRequired();
  let apt = state.apt;
  if (refreshApt && (!apt || now - apt.at >= cfg.aptCheckEveryMin * 60_000)) {
    apt = (await runAptCheck(now)) ?? apt;
  }
  const bootAt = Math.round((now - os.uptime() * 1000) / 60_000) * 60_000;
  return { rr, apt, bootAt };
}

function report(now: number, cfg: MaintenanceConfig, state: StateFile, o: Awaited<ReturnType<typeof observe>>): MaintenanceReport {
  const t = timings(cfg);
  return {
    at: now,
    host: hostName(),
    rebootRequired: o.rr.required,
    rebootSince: o.rr.since,
    rebootPkgs: o.rr.pkgs,
    apt: o.apt,
    pendingCount: pendingOf(o.apt, cfg.updatesScope),
    bootAt: o.bootAt,
    uptimeDays: os.uptime() / 86_400,
    reboot: { ...state.reboot, nextDueAt: cfg.rebootAlerts ? nextDueAt(state.reboot, t.reboot) : null },
    updates: { ...state.updates, nextDueAt: cfg.updatesAlerts && !state.reboot.activeSince ? nextDueAt(state.updates, t.updates) : null },
    sends: state.sends.slice(-30).reverse(),
    config: cfg,
  };
}

/** One tick: read, decide, send what is due, remember. Never throws. */
export async function evaluateMaintenance(now: number = Date.now()): Promise<MaintenanceReport> {
  const cfg = readMaintenanceConfig();
  const state = readState();
  const o = await observe(state, cfg, now, true);
  state.apt = o.apt;

  // A boot the reboot runner did not announce (the provider, a panic) is
  // still a fact worth a line in the audit trail.
  if (state.bootAt !== null && Math.abs(o.bootAt - state.bootAt) > 5 * 60_000) {
    logHardeningAction({ action: "rcs-maintenance.boot.detected", target: hostName(), user: "rcs", success: true, details: { bootAt: new Date(o.bootAt).toISOString(), previousBootAt: new Date(state.bootAt).toISOString() } });
  }
  state.bootAt = o.bootAt;

  const t = timings(cfg);
  const pending = pendingOf(o.apt, cfg.updatesScope);
  const rebootActive = o.rr.required;
  // Unknown (apt-check failed) holds the previous answer rather than flapping
  // an episode closed and open again.
  const updatesActive = pending === null ? state.updates.activeSince !== null : pending > 0;

  const r = decideNotice(state.reboot, rebootActive, now, t.reboot, o.rr.since, !cfg.rebootAlerts);
  // While a reboot notice is running it already carries the update counts, so
  // the updates notice tracks its episode silently instead of sending a second mail.
  const u = decideNotice(state.updates, updatesActive, now, t.updates, null, !cfg.updatesAlerts || (rebootActive && cfg.rebootAlerts));

  const prevReboot = state.reboot;
  const prevUpdates = state.updates;
  state.reboot = r.next;
  state.updates = u.next;
  const rep = report(now, cfg, state, o);

  for (const [kind, d, prev] of [
    ["reboot", r, prevReboot],
    ["updates", u, prevUpdates],
  ] as const) {
    if (!d.send) continue;
    // A resolve for a muted notice is pointless; a raise with the master
    // switch off is tracked (so turning it on doesn't replay) but not sent.
    if (!cfg.enabled) continue;
    const noticeState = d.send === "resolve" ? prev : d.next;
    const rec = await deliver(kind, d.send, rep, noticeState, cfg);
    state.sends = [...state.sends, rec].slice(-60);
    if (!delivered(rec) && d.send !== "resolve") {
      // Nothing left the building: keep the old marker so the next tick retries.
      state[kind] = { ...d.next, lastSentAt: prev.lastSentAt, sentCount: prev.sentCount };
    }
  }

  writeState(state);
  const out = report(now, cfg, state, o);
  (globalThis as unknown as Record<symbol, MaintenanceReport>)[KEY] = out;
  return out;
}

/**
 * What the modal shows: the sampler's last report, or a fresh read-only look
 * (nothing written, nothing sent, apt-check not re-run) when this process is
 * not the sampler or it has not ticked yet.
 */
export async function maintenanceStatus(): Promise<MaintenanceReport> {
  const last = (globalThis as unknown as Record<symbol, MaintenanceReport | undefined>)[KEY];
  const cfg = readMaintenanceConfig();
  const state = readState();
  if (last && Date.now() - last.at < 15 * 60_000) return { ...last, config: cfg, sends: state.sends.slice(-30).reverse() };
  const now = Date.now();
  const o = await observe(state, cfg, now, false);
  return report(now, cfg, state, o);
}

/** The modal's "send a test" — both channels, marked as a test, no state change. */
export async function sendMaintenanceTest(by: string): Promise<SendRecord> {
  const cfg = readMaintenanceConfig();
  const rep = await maintenanceStatus();
  const n: NoticeState = rep.reboot.activeSince !== null ? rep.reboot : { activeSince: rep.at, lastSentAt: null, sentCount: 1 };
  const rec = await deliver("reboot", "raise", rep, n, { ...cfg, enabled: true }, by);
  logHardeningAction({ action: "rcs-maintenance.test.send", target: rep.host, user: by, success: delivered(rec), details: { frontDesk: rec.frontDesk, email: rec.email } });
  return rec;
}

/** Whether this module owns the reboot notice (so Box Health stays quiet about it). */
export function maintenanceOwnsReboot(): boolean {
  const cfg = readMaintenanceConfig();
  return cfg.enabled && cfg.rebootAlerts;
}

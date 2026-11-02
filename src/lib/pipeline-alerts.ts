/**
 * Pipeline alerts — tell the team when a deploy is stuck, instead of letting it
 * sit silently (Gio 2026-11-01: "this has become a nightmare to track"; rulings:
 * alert + email after 10 min blocked; an expired deploy request alerts).
 *
 * Runs inside the host-metrics sampler tick (sampler.ts), in its own try.
 * Two shapes:
 *   - EPISODES that repeat until they clear (decideNotice, the same policy as
 *     RCS Maintenance): a deploy blocked ≥ blockedMin, the mesh policed while
 *     something waits on it and the direct route is closed (→ "say go direct";
 *     opening stays Gio's call). The watcher offline ≥ offlineMin is an episode
 *     too, but only while work is waiting on it, and it is told ONCE — an idle
 *     Mac asleep overnight sends nothing (Gio 2026-11-02).
 *   - ONE-SHOT events read from the jsonl histories RCS appends to: a deploy
 *     request that expired or failed, the direct route opening or closing.
 *     Cursors start at "now" on first run so history is never replayed.
 *
 * Delivery: Front Desk (a team `user_alerts` row via sendTeamAlert) + email,
 * both switchable in Office → Utils → System Hardening → Pipeline.
 * State: data/pipeline-alerts/state.json (Office cwd).
 */
import "server-only";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";
import { logHardeningAction } from "./audit-log";
import { sendMail } from "./email/sendMail";
import { sendTeamAlert } from "./host-metrics/alerts";
import { ageText, decideNotice, INITIAL_NOTICE, type NoticeSend, type NoticeState } from "./rcs-maintenance/policy";
import {
  budgetHistoryFiles, PIPELINE_FILES, readJsonl, readPipeline,
  type BudgetReport, type DirectRouteEvent, type Pipeline, type PipelineAlertConfig, type PipelineClient, type PromoteRequest,
} from "./workshop-deploy";

const DIR = path.join(process.cwd(), "data", "pipeline-alerts");
const STATE_FILE = path.join(DIR, "state.json");
const OFFICE_URL = process.env.OFFICE_PUBLIC_URL || "https://office.tinyglobalvillage.com";
const BOARD = `${OFFICE_URL}/dashboard/utils?view=pipeline`;
/** A link probe older than this says nothing about the mesh now. */
const LINK_FRESH_MS = 30 * 60_000;

export type Episode = NoticeState & { title: string; detail: string };
export type PipelineSend = {
  at: number;
  key: string;
  send: NoticeSend | "event";
  title: string;
  frontDesk: string;
  email: string;
};
type StateFile = {
  episodes: Record<string, Episode>;
  cursors: { requests: string | null; direct: string | null; budget: string | null };
  sends: PipelineSend[];
};

function readState(): StateFile {
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, "utf8")) as Partial<StateFile>;
    return {
      episodes: raw.episodes && typeof raw.episodes === "object" ? raw.episodes : {},
      cursors: { requests: raw.cursors?.requests ?? null, direct: raw.cursors?.direct ?? null, budget: raw.cursors?.budget ?? null },
      sends: Array.isArray(raw.sends) ? raw.sends : [],
    };
  } catch {
    return { episodes: {}, cursors: { requests: null, direct: null, budget: null }, sends: [] };
  }
}

function writeState(s: StateFile): void {
  try {
    mkdirSync(DIR, { recursive: true });
    const tmp = `${STATE_FILE}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(s, null, 2) + "\n", "utf8");
    renameSync(tmp, STATE_FILE);
  } catch {
    // A lost state file costs one early repeat — better than a check that stops.
  }
}

// ── what is wrong right now ─────────────────────────────────────────────────

type Condition = {
  key: string; title: string; detail: string; since: number | null; thresholdMs: number;
  /** false = tell once and stop (no reminders); the resolved notice still closes it. */
  remind?: boolean;
};

const short = (sha: string | null | undefined) => (sha ? sha.slice(0, 8) : "?");

function blockerText(c: PipelineClient): string {
  const b = c.blocked;
  if (!b) return `${c.client}: ${c.phase || "blocked"}`;
  switch (b.kind) {
    case "unpushed":
      return `${b.repo} main has ${b.commits?.length ?? "some"} commit(s) not on origin — ${(b.commits ?? []).slice(0, 3).map((x) => `${short(x.sha)} "${x.subject}"`).join(", ")}. Whoever made them pushes them (lane-push), or they get moved to a lane.`;
    case "dirty":
      return `${b.repo} main checkout has uncommitted files: ${(b.files ?? []).slice(0, 6).join(", ")}. Somebody is editing the shared checkout — that work belongs on a lane.`;
    case "off-main":
      return `${b.repo} main checkout is on branch "${b.branch ?? "?"}" instead of main. Switch it back to main.`;
    case "fetch":
      return `the Mac could not fetch ${b.repo} from origin (network or credentials).`;
    case "ff":
      return `${b.repo} main checkout could not fast-forward to origin/main (it has diverged).`;
    default:
      return `${b.repo}: ${b.kind}`;
  }
}

function conditions(p: Pipeline, a: PipelineAlertConfig): Condition[] {
  const out: Condition[] = [];
  // Blocked: one episode per BLOCKER, not per client — TGV and demo-hq blocked by
  // the same unpushed commit are one problem with one fix.
  const groups = new Map<string, PipelineClient[]>();
  for (const c of p.clients) {
    if (c.state !== "blocked") continue;
    const key = c.blocked ? `blocked:${c.blocked.repo}:${c.blocked.kind}` : `blocked:${c.client}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  for (const [key, cs] of groups) {
    const since = Math.min(...cs.map((c) => Date.parse(c.blockedSince ?? "") || Date.now()));
    out.push({
      key,
      title: `Deploys blocked: ${cs.map((c) => c.client).join(", ")}`,
      detail: blockerText(cs[0]),
      since,
      thresholdMs: a.blockedMin * 60_000,
    });
  }
  // Watcher offline — only while it is supposed to be running AND something is
  // waiting on it. A Mac that is asleep or away with nothing to build is not
  // news (Gio 2026-11-02, after 14 hourly reminders overnight: "I don't need
  // emails coming in like this when my mac is offline"). Told once, no repeats.
  const pending = p.clients.filter((c) =>
    c.request?.status === "waiting" || c.state === "queued" || c.state === "building" || c.state === "debouncing"
    || (!!c.mainMono && c.mainMono !== c.stagedMono && c.mainMono !== c.liveMono));
  if (p.config.enabled && !p.health.online && pending.length) {
    const what = pending.map((c) => `${c.client}${c.request?.status === "waiting" ? " (deploy asked)" : ""}`).join(", ");
    out.push({
      key: "watcher-offline",
      title: "Deploy watcher offline with work waiting",
      detail: p.health.at
        ? `The Mac's deploy-watch last checked in ${ageText(Date.now() - Date.parse(p.health.at))} ago (${p.health.host ?? "?"}) and ${what} ${pending.length === 1 ? "is" : "are"} waiting on it. Nothing builds or promotes until the Mac is back. This is the only notice; the board shows when it returns.`
        : `The Mac's deploy-watch has never checked in, and ${what} ${pending.length === 1 ? "is" : "are"} waiting on it.`,
      since: p.health.at ? Date.parse(p.health.at) : null,
      thresholdMs: a.offlineMin * 60_000,
      remind: false,
    });
  }
  // A policed mesh only matters while something is waiting to cross it.
  const link = p.mac?.link;
  const waiting = p.clients.some((c) => c.request?.status === "waiting" || c.state === "building" || c.state === "queued");
  if (a.linkAlerts && link && /^mesh-/.test(link.verdict) && Date.now() - Date.parse(link.at) < LINK_FRESH_MS && !p.directRoute?.open && waiting) {
    out.push({
      key: "mesh-policed",
      title: link.verdict === "mesh-down" ? "Mesh down — deploys are crawling" : "Mesh throttled — deploys are crawling",
      detail: `${link.why}. A build is waiting to reach RCS. If this network is policing the mesh, say "go direct" to open the self-closing direct route — it is Gio's call, and it closes itself when the build is done.`,
      since: Date.parse(link.at),
      thresholdMs: 0,
    });
  }
  return out;
}

// ── delivery ────────────────────────────────────────────────────────────────

type Msg = { subject: string; title: string; lines: string[] };

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
<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${MAIL.accent};font-weight:700">Tiny Global Village · Pipeline</div>
<h1 style="font-size:20px;margin:10px 0 18px;color:${MAIL.title}">${esc(m.title)}</h1>
<div style="border-left:3px solid ${MAIL.accent};padding-left:14px;font-size:14px">${body}</div>
</div></body></html>`;
}

async function deliver(key: string, send: PipelineSend["send"], m: Msg, a: PipelineAlertConfig, mail: boolean, payload: Record<string, unknown>): Promise<PipelineSend> {
  const at = Date.now();
  const rec: PipelineSend = { at, key, send, title: m.title, frontDesk: "off", email: "off" };
  if (!a.enabled) return { ...rec, frontDesk: "disabled", email: "disabled" };
  if (a.frontDesk) {
    try {
      await sendTeamAlert({
        title: m.title,
        description: m.lines.join(" "),
        at,
        payload: { key, send, ...payload },
        action: `pipeline.alert.${send}`,
        target: key,
        success: send === "resolve",
        details: payload,
      });
      rec.frontDesk = "sent";
    } catch (err) {
      rec.frontDesk = `failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 200);
    }
  }
  if (mail && a.email && a.recipients.length) {
    try {
      await sendMail({ to: a.recipients, subject: m.subject, text: m.lines.join("\n\n"), html: html(m) });
      rec.email = "sent";
      logHardeningAction({ action: `pipeline.email.${send}`, target: a.recipients.join(","), user: "rcs", success: true, details: { key, subject: m.subject } });
    } catch (err) {
      rec.email = `failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 200);
      logHardeningAction({ action: `pipeline.email.${send}`, target: a.recipients.join(","), user: "rcs", success: false, details: { key, error: rec.email } });
    }
  }
  return rec;
}

function episodeMsg(c: Condition | Episode, send: NoticeSend, n: NoticeState): Msg {
  const age = n.activeSince ? ageText(Date.now() - n.activeSince) : "a while";
  if (send === "resolve") {
    return { subject: `RESOLVED: ${c.title}`, title: `Resolved: ${c.title}`, lines: [`Cleared after ${age}.`, `Board: ${BOARD}`] };
  }
  const again = send === "remind" ? ` (still, reminder ${n.sentCount})` : "";
  return {
    subject: `PIPELINE: ${c.title}${again}`,
    title: `${c.title}${again}`,
    lines: [`For ${age}: ${c.detail}`, `Board: ${BOARD}`],
  };
}

// One-shot events: an expired/failed deploy request; the direct route opening/closing.
const ABNORMAL_CLOSE = new Set(["ip-changed", "mac-silent", "hard-cap", "open-check-failed"]);

function requestMsg(r: PromoteRequest): Msg {
  const who = (r.by ?? []).join(", ") || "someone";
  const what = r.status === "expired"
    ? `A "deploy" of ${r.client} asked by ${who} expired after ${r.ttlMin} min without being promoted — the build it asked for (mono ${short(r.wantMono)}) never got staged. Nothing was deployed.`
    : `A "deploy" of ${r.client} asked by ${who} FAILED while promoting${r.note ? `: ${r.note}` : ""}. The previous build is serving.`;
  return { subject: `DEPLOY ${r.status.toUpperCase()}: ${r.client}`, title: `Deploy ${r.status}: ${r.client}`, lines: [what, `Board: ${BOARD}`] };
}

function directMsg(e: DirectRouteEvent): Msg {
  if (e.event === "close") {
    return {
      subject: `Direct route closed (${e.why ?? "?"})`,
      title: `Direct route closed — ${e.why ?? "?"}`,
      lines: [`The go-direct firewall opening for ${e.ip ?? "?"} closed after ${e.openMin ?? "?"} min (${e.why ?? "?"}${e.by ? `, by ${e.by}` : ""}).`, `Board: ${BOARD}`],
    };
  }
  return {
    subject: `Direct route OPEN for ${e.ip ?? "?"}`,
    title: `Direct route open for ${e.ip ?? "?"}`,
    lines: [`${e.by ?? "?"} opened the go-direct SSH route on RCS for ${e.ip ?? "?"}${e.adopted ? " (adopted an existing manual rule)" : ""}. It closes itself when the builds are done, on an IP change, or at the hard cap — or from the Pipeline board.`, `Board: ${BOARD}`],
  };
}

function budgetMsg(b: BudgetReport): Msg {
  const worst = b.over[0];
  const enforced = b.status === "over-enforced";
  const commits = b.range ? ` Commits: ${b.range}.` : b.mono ? ` Mono ${short(b.mono)}.` : "";
  const rest = b.over.slice(1, 4).map((o) => `${o.route} ${o.kb} KB (+${o.overKb})`).join("; ");
  const what = enforced
    ? `The ${b.client} build was STOPPED before it shipped: ${worst.route} loads ${worst.kb} KB gz of JS against a budget of ${worst.budgetKb} KB (+${worst.overKb} KB, +${worst.overPct}%).${commits} Prod is untouched.`
    : `${b.client}: ${worst.route} loads ${worst.kb} KB gz of JS against a budget of ${worst.budgetKb} KB (+${worst.overKb} KB).${commits} Warn-only until ${b.warnUntil}; after that this build would be stopped.`;
  const lines = [what];
  if (b.over.length > 1) lines.push(`${b.over.length - 1} more over budget${rest ? `: ${rest}` : ""}.`);
  lines.push("Cut the route (next/dynamic) or raise its budget in data/perf/budgets.json in a reviewed commit.", `Board: ${BOARD}`);
  return {
    subject: `${enforced ? "PERF BUDGET STOP" : "Perf budget warning"}: ${b.client} ${worst.route}`,
    title: `${enforced ? "Over budget — stage stopped" : "Over budget (warn)"}: ${b.client}`,
    lines,
  };
}

// ── evaluation ──────────────────────────────────────────────────────────────

export type PipelineAlertReport = {
  at: number;
  config: PipelineAlertConfig;
  episodes: Record<string, Episode>;
  sends: PipelineSend[];
};

export async function evaluatePipelineAlerts(now: number = Date.now()): Promise<PipelineAlertReport> {
  const p = readPipeline();
  const a = p.config.alerts;
  const state = readState();
  const reminderMs = a.reminderMin * 60_000;
  const sends: PipelineSend[] = [];

  const active = conditions(p, a);
  const keys = new Set([...Object.keys(state.episodes), ...active.map((c) => c.key)]);
  for (const key of keys) {
    const c = active.find((x) => x.key === key) ?? null;
    const prev = state.episodes[key] ?? { ...INITIAL_NOTICE, title: c?.title ?? key, detail: c?.detail ?? "" };
    const d = decideNotice(prev, !!c, now, { thresholdMs: c?.thresholdMs ?? 0, reminderMs: c?.remind === false ? Infinity : reminderMs }, c?.since ?? null);
    if (d.send) {
      const about = c ?? prev;
      // Resolutions go to the board only; the inbox gets what needs doing.
      const rec = await deliver(key, d.send, episodeMsg(about, d.send, d.send === "resolve" ? prev : d.next), a, d.send !== "resolve", { title: about.title });
      sends.push(rec);
      // An undelivered raise is retried next tick instead of being counted as told.
      if (d.send !== "resolve" && rec.frontDesk !== "sent" && rec.email !== "sent" && a.enabled) {
        state.episodes[key] = { ...prev, activeSince: d.next.activeSince, title: about.title, detail: about.detail };
        continue;
      }
    }
    if (c) state.episodes[key] = { ...d.next, title: c.title, detail: c.detail };
    else delete state.episodes[key];
  }

  // One-shot events, read past the cursor. First run: start at now, replay nothing.
  const nowIso = new Date(now).toISOString();
  if (state.cursors.requests === null) state.cursors.requests = nowIso;
  else {
    const rows = readJsonl<PromoteRequest>(PIPELINE_FILES.requestHistory, 200).filter((r) => (r.finishedAt ?? "") > state.cursors.requests!);
    for (const r of rows) {
      if (r.status === "expired" || r.status === "failed") {
        sends.push(await deliver(`request:${r.client}`, "event", requestMsg(r), a, true, { client: r.client, status: r.status, by: r.by, wantMono: r.wantMono }));
      }
      if (r.finishedAt && r.finishedAt > state.cursors.requests!) state.cursors.requests = r.finishedAt;
    }
  }
  if (state.cursors.direct === null) state.cursors.direct = nowIso;
  else {
    const rows = readJsonl<DirectRouteEvent>(PIPELINE_FILES.directHistory, 200).filter((e) => e.at > state.cursors.direct!);
    for (const e of rows) {
      if (e.event === "open" || e.event === "close") {
        const mail = e.event === "open" || ABNORMAL_CLOSE.has(e.why ?? "");
        sends.push(await deliver(`direct:${e.event}`, "event", directMsg(e), a, mail, { ip: e.ip, why: e.why ?? null, by: e.by ?? null }));
      }
      if (e.at > state.cursors.direct!) state.cursors.direct = e.at;
    }
  }

  // Perf budgets: a hard stop goes to Front Desk AND email; a warning to Front Desk only.
  if (state.cursors.budget === null) state.cursors.budget = nowIso;
  else {
    const rows = budgetHistoryFiles()
      .flatMap((f) => readJsonl<BudgetReport>(f, 50))
      .filter((b) => (b.at ?? "") > state.cursors.budget!)
      .sort((x, y) => x.at.localeCompare(y.at));
    for (const b of rows) {
      if ((b.status === "over-warn" || b.status === "over-enforced") && b.over?.length) {
        sends.push(await deliver(`budget:${b.client}`, "event", budgetMsg(b), a, b.status === "over-enforced", {
          client: b.client, status: b.status, route: b.over[0].route, kb: b.over[0].kb, budgetKb: b.over[0].budgetKb, range: b.range || null,
        }));
      }
      if (b.at > state.cursors.budget!) state.cursors.budget = b.at;
    }
  }

  state.sends = [...sends, ...state.sends].slice(0, 50);
  writeState(state);
  return { at: now, config: a, episodes: state.episodes, sends: state.sends };
}

/** For the modal: what is open and what was sent, without evaluating. */
export function pipelineAlertStatus(): { episodes: Record<string, Episode>; sends: PipelineSend[] } {
  const s = readState();
  return { episodes: s.episodes, sends: s.sends };
}

/** The Settings tab's "Send test" button. */
export async function sendPipelineTest(by: string): Promise<PipelineSend> {
  const a = readPipeline().config.alerts;
  const rec = await deliver("test", "event", {
    subject: "[TEST] Pipeline alert",
    title: "[TEST] Pipeline alert",
    lines: [`This is a test sent by ${by} from Utils → System Hardening → Pipeline. Nothing needs doing because of it.`, `Board: ${BOARD}`],
  }, { ...a, enabled: true }, true, { by });
  logHardeningAction({ action: "pipeline.test.send", target: "pipeline", user: by, success: rec.frontDesk === "sent" || rec.email === "sent", details: { frontDesk: rec.frontDesk, email: rec.email } });
  const s = readState();
  s.sends = [rec, ...s.sends].slice(0, 50);
  writeState(s);
  return rec;
}

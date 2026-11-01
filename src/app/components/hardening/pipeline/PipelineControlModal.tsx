"use client";

// PipelineControlModal — Utils → System Hardening → Pipeline (pipeline control,
// 2026-11-01; Gio: "this has become a nightmare to track"). Everything that
// decides whether a "deploy" will happen, on one board: the Mac's watcher, each
// app's state and WHAT is blocking it, queued deploy requests, the Mac's build
// lock / deploy line / shared checkouts / memory, the mesh link verdict, and the
// self-closing direct route (closable here). Plus who gets told, and when.
// Reads /api/hardening/pipeline; settings save through /api/hardening/deploy-watcher.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb } from "@/app/theme";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";
import ConfirmModal from "../../frontdesk/ConfirmModal";

type Blocker = { kind: string; repo: string; branch?: string; files?: string[]; commits?: Array<{ sha: string; at: string; subject: string }> };
type Req = { client: string; status: string; by: string[]; at: string; expiresAt: string; ttlMin: number; wantMono: string | null; finishedAt?: string | null; note?: string | null };
type Client = {
  client: string; follows: string | null; state: string | null; phase: string | null; updatedAt: string | null;
  blocked: Blocker | null; blockedSince: string | null; request: Req | null;
  liveMono: string | null; stagedMono: string | null; mainMono: string | null;
};
type Lease = { host: string; pid: number; label: string; at: string };
type Direct = {
  open: boolean; ip: string | null; by: string | null; openedAt: string | null; closeBy: string | null; adopted: boolean;
  leases: Lease[]; everLeased: boolean; idleSince: string | null; heartbeatAt: string | null; currentIp: string | null;
  closeRequested: { by: string; at: string } | null; closedAt: string | null; closeWhy: string | null; closedBy: string | null;
};
type DirectEvent = { at: string; event: string; ip: string | null; by?: string | null; why?: string; openMin?: number };
type Mac = {
  at: string; host: string;
  checkouts: Array<{ repo: string; branch: string; dirty: string[]; unpushed: Array<{ sha: string; subject: string }> }>;
  buildLock: { label: string; pid: number | null; ageSec: number; alive: boolean } | null;
  queue: Array<{ label: string; pid: number; waitingSec: number; turnSec: number | null }>;
  running: Array<{ pid: number; elapsed: string; cmd: string; lane: string | null }>;
  memory: { pressure: string; availGb: number; swapUsedGb: number; sessions: Array<{ lane: string; gb: number }> } | null;
  link: { at: string; verdict: string; why: string; mesh: { loss: number; avgMs: number | null }; direct: { loss: number; avgMs: number | null } } | null;
};
type AlertCfg = { enabled: boolean; frontDesk: boolean; email: boolean; recipients: string[]; blockedMin: number; reminderMin: number; offlineMin: number; linkAlerts: boolean };
type DirectCfg = { hardCapMin: number; closeWhenIdle: boolean; closeOnIpChange: boolean; idleGraceSec: number; unusedMin: number; silentMin: number };
type Pipeline = {
  at: string;
  health: { online: boolean; host: string | null; at: string | null; enabled: boolean | null };
  mac: Mac | null; clients: Client[]; directRoute: Direct | null; directHistory: DirectEvent[]; requestHistory: Req[];
  config: { enabled: boolean; updatedAt?: string; directRoute: DirectCfg; alerts: AlertCfg };
};
type Episode = { activeSince: number | null; lastSentAt: number | null; sentCount: number; title: string; detail: string };
type Send = { at: number; key: string; send: string; title: string; frontDesk: string; email: string };

const ago = (t?: string | number | null) => {
  if (!t) return "—";
  const s = Math.max(0, Math.round((Date.now() - (typeof t === "number" ? t : Date.parse(t))) / 1000));
  return s < 90 ? `${s}s` : s < 5400 ? `${Math.round(s / 60)}m` : s < 172800 ? `${(s / 3600).toFixed(1)}h` : `${Math.round(s / 86400)}d`;
};
const clock = (t?: string | null) => (t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");
const sha = (s?: string | null) => (s ? s.slice(0, 8) : "—");

const STATE_TONE: Record<string, Tone> = {
  live: "ok", staged: "info", building: "info", queued: "info", promoting: "info", debouncing: "none",
  blocked: "critical", failed: "critical", stale: "warn", rolled_back: "warn",
};

function blockerLine(b: Blocker | null): string {
  if (!b) return "build guard refused (memory / disk / lock) — retried every poll";
  switch (b.kind) {
    case "unpushed": return `${b.repo} main has unpushed commit(s): ${(b.commits ?? []).slice(0, 3).map((c) => `${sha(c.sha)} ${c.subject}`).join(" · ")}`;
    case "dirty": return `${b.repo} main checkout has uncommitted files: ${(b.files ?? []).slice(0, 5).join(", ")}`;
    case "off-main": return `${b.repo} main checkout is on "${b.branch ?? "?"}", not main`;
    case "fetch": return `could not fetch ${b.repo} from origin`;
    case "ff": return `${b.repo} main could not fast-forward (diverged)`;
    default: return `${b.repo}: ${b.kind}`;
  }
}

export default function PipelineControlModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });
  const [p, setP] = useState<Pipeline | null>(null);
  const [episodes, setEpisodes] = useState<Record<string, Episode>>({});
  const [sends, setSends] = useState<Send[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [askClose, setAskClose] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [recipients, setRecipients] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/hardening/pipeline");
      const d = await r.json();
      if (!d?.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
      setP(d.pipeline);
      setEpisodes(d.alerts?.episodes ?? {});
      setSends(d.alerts?.sends ?? []);
      setErr(d.samplerError ?? null);
      setRecipients((cur) => cur || (d.pipeline?.config?.alerts?.recipients ?? []).join(", "));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

  const put = async (patch: { alerts?: Partial<AlertCfg>; directRoute?: Partial<DirectCfg> }) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/hardening/deploy-watcher", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (!r.ok) setMsg(`Save failed (HTTP ${r.status})`);
      await load();
    } finally { setBusy(false); }
  };
  const post = async (action: "close-direct" | "test") => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/hardening/pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const d = await r.json().catch(() => ({}));
      if (action === "test") setMsg(d?.send ? `Test — Front Desk: ${d.send.frontDesk} · Email: ${d.send.email}` : "Test failed");
      else setMsg(d?.ok ? "Close requested — RCS removes the rule within a minute." : (d?.error ?? `HTTP ${r.status}`));
      await load();
    } finally { setBusy(false); }
  };

  const a = p?.config.alerts;
  const dc = p?.config.directRoute;
  const dr = p?.directRoute;
  const mac = p?.mac;
  const link = mac?.link;
  const linkFresh = !!link && Date.now() - Date.parse(link.at) < 30 * 60_000;
  const openEpisodes = Object.entries(episodes).filter(([, e]) => e.activeSince);

  const num = <K extends string>(block: "alerts" | "directRoute", key: K, label: string, unit: string, value: number | undefined) => (
    <Cell key={key}>
      <StatLabel>{label}</StatLabel>
      <Rowline>
        <Input
          type="number" defaultValue={value} key={`${key}-${p?.config.updatedAt ?? ""}`} disabled={busy || value === undefined}
          onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== value) void put({ [block]: { [key]: v } }); }}
          style={{ width: "5rem" }}
        />
        <Muted>{unit}</Muted>
      </Rowline>
    </Cell>
  );
  const flag = (block: "alerts" | "directRoute", key: string, label: string, on: boolean | undefined) => (
    <Rowline key={key}>
      <StatLabel style={{ minWidth: "9rem" }}>{label}</StatLabel>
      <TBtn $active={on === true} disabled={busy} onClick={() => void put({ [block]: { [key]: true } })}>On</TBtn>
      <TBtn $active={on === false} disabled={busy} onClick={() => void put({ [block]: { [key]: false } })}>Off</TBtn>
    </Rowline>
  );

  const sections: HCMSection[] = [
    {
      id: "board",
      title: "Board",
      qmbm: "Each app's place in the pipeline. The Mac's deploy-watch builds when main moves and stages the build on RCS; \"deploy\" promotes it. BLOCKED names what is in the way — almost always somebody's unpushed commit or uncommitted file on the Mac's shared main checkout. A queued \"deploy\" waits here until main is staged, then promotes on its own.",
      body: (
        <Body>
          <Rowline>
            <Pill $tone={p?.health.online ? "ok" : "critical"}>{p?.health.online ? `WATCHER ONLINE · ${p.health.host ?? "mac"}` : "WATCHER OFFLINE"}</Pill>
            {p && !p.config.enabled && <Pill $tone="warn">PAUSED</Pill>}
            <Muted>seen {ago(p?.health.at)} ago</Muted>
            {link && (
              <Pill $tone={!linkFresh ? "none" : link.verdict === "ok" ? "ok" : link.verdict === "network-bad" ? "critical" : "warn"}>
                LINK {link.verdict.toUpperCase()}
              </Pill>
            )}
          </Rowline>
          {link && linkFresh && /^mesh-/.test(link.verdict) && !dr?.open && (
            <Callout $tone="warn">{link.why}. Builds crawl over a policed mesh — say <b>&ldquo;go direct&rdquo;</b> to open the self-closing direct route. Gio&rsquo;s call.</Callout>
          )}
          <Table>
            <thead><tr><th>App</th><th>State</th><th>Live</th><th>Staged</th><th>main</th><th>Updated</th></tr></thead>
            <tbody>
              {(p?.clients ?? []).map((c) => (
                <FragmentRows key={c.client} c={c} />
              ))}
            </tbody>
          </Table>
          {err && <ErrText>{err}</ErrText>}
        </Body>
      ),
    },
    {
      id: "mac",
      title: "The Mac",
      qmbm: "The Mac's half, shipped with every watcher heartbeat (about once a minute). One build runs per Mac at a time: the build lock is who holds it, the deploy line is who waits. A shared main checkout that is not clean main blocks every build.",
      body: mac ? (
        <Body>
          <Muted>{mac.host} · snapshot {ago(mac.at)} ago</Muted>
          <Rowline>
            <StatLabel style={{ minWidth: "6rem" }}>Build lock</StatLabel>
            {mac.buildLock
              ? <Pill $tone={mac.buildLock.alive ? "info" : "critical"}>{mac.buildLock.alive ? "" : "STALE · "}{mac.buildLock.label} · {Math.round(mac.buildLock.ageSec / 60)}m</Pill>
              : <Pill $tone="ok">FREE</Pill>}
          </Rowline>
          <Rowline>
            <StatLabel style={{ minWidth: "6rem" }}>Deploy line</StatLabel>
            {mac.queue.length
              ? mac.queue.map((q) => <Pill key={q.pid} $tone="info">{q.label} · {q.turnSec != null ? `turn ${Math.round(q.turnSec / 60)}m` : `waiting ${Math.round(q.waitingSec / 60)}m`}</Pill>)
              : <Muted>empty</Muted>}
          </Rowline>
          {mac.running.map((r) => (
            <Rowline key={r.pid}><StatLabel style={{ minWidth: "6rem" }}>In flight</StatLabel><Mono>{r.cmd}</Mono><Muted>{r.lane ? `lane ${r.lane}` : "main checkout"} · {r.elapsed}</Muted></Rowline>
          ))}
          {mac.checkouts.map((k) => {
            const bad = k.branch !== "main" || k.dirty.length > 0 || k.unpushed.length > 0;
            return (
              <Rowline key={k.repo}>
                <StatLabel style={{ minWidth: "6rem" }}>Checkout</StatLabel>
                <Mono>{k.repo}</Mono>
                <Pill $tone={bad ? "critical" : "ok"}>{k.branch}{bad ? "" : " · CLEAN"}</Pill>
                {k.dirty.length > 0 && <Muted>{k.dirty.length} uncommitted: {k.dirty.slice(0, 3).join(", ")}</Muted>}
                {k.unpushed.length > 0 && <Muted>{k.unpushed.length} unpushed: {sha(k.unpushed[0].sha)} {k.unpushed[0].subject}</Muted>}
              </Rowline>
            );
          })}
          {mac.memory && (
            <Rowline>
              <StatLabel style={{ minWidth: "6rem" }}>Memory</StatLabel>
              <Pill $tone={mac.memory.pressure === "normal" ? "ok" : "critical"}>{mac.memory.pressure.toUpperCase()}</Pill>
              <Muted>{mac.memory.availGb} GB free · swap {mac.memory.swapUsedGb} GB · {mac.memory.sessions.length} Claude sessions</Muted>
            </Rowline>
          )}
          {link && (
            <Rowline>
              <StatLabel style={{ minWidth: "6rem" }}>Link</StatLabel>
              <Muted>mesh {link.mesh.loss}% loss{link.mesh.avgMs != null ? ` · ${Math.round(link.mesh.avgMs)} ms` : ""} — public {link.direct.loss}% loss{link.direct.avgMs != null ? ` · ${Math.round(link.direct.avgMs)} ms` : ""} · probed {ago(link.at)} ago</Muted>
            </Rowline>
          )}
        </Body>
      ) : (
        <Body><Muted>No Mac snapshot yet — the watcher ships one with its heartbeat once it runs the pipeline-control version.</Muted></Body>
      ),
    },
    {
      id: "direct",
      title: "Direct route",
      qmbm: "\"go direct\" opens SSH on RCS's public IP to this Mac's public IP, around a policed mesh. Opening is Gio's command only. It closes itself: when the builds using it are done, if nothing used it, when the Mac's IP changes, if the Mac goes silent, and at the hard cap — or from here. RCS enforces the cap by cron, so a sleeping Mac cannot leave it open.",
      body: (
        <Body>
          {dr?.open ? (
            <>
              <Rowline>
                <Pill $tone="warn">OPEN · {dr.ip}</Pill>
                {dr.adopted && <Pill $tone="none">ADOPTED MANUAL RULE</Pill>}
                <Muted>by {dr.by ?? "?"} · {ago(dr.openedAt)} ago · closes by {clock(dr.closeBy)} at the latest</Muted>
              </Rowline>
              <Rowline>
                <StatLabel style={{ minWidth: "6rem" }}>Using it</StatLabel>
                {dr.leases.length ? dr.leases.map((l) => <Pill key={`${l.host}-${l.pid}`} $tone="info">{l.label} · {ago(l.at)}</Pill>)
                  : <Muted>{dr.everLeased ? `nothing — builds done ${ago(dr.idleSince)} ago, closing` : "nothing yet"}</Muted>}
              </Rowline>
              {dr.currentIp && dr.currentIp !== dr.ip && <Callout $tone="critical">The Mac&rsquo;s public IP is now {dr.currentIp} — the rule closes on the next check.</Callout>}
              <Rowline>
                {dr.closeRequested
                  ? <Muted>Close requested by {dr.closeRequested.by} {ago(dr.closeRequested.at)} ago — RCS removes the rule within a minute.</Muted>
                  : <Danger disabled={busy} onClick={() => setAskClose(true)}>Close now</Danger>}
                <Muted>Mac heartbeat {ago(dr.heartbeatAt)} ago</Muted>
              </Rowline>
            </>
          ) : (
            <Rowline>
              <Pill $tone="ok">CLOSED</Pill>
              {dr?.closedAt && <Muted>{ago(dr.closedAt)} ago · {dr.closeWhy ?? "?"}{dr.closedBy ? ` · by ${dr.closedBy}` : ""}</Muted>}
            </Rowline>
          )}
          {(p?.directHistory ?? []).length > 0 && (
            <Table>
              <thead><tr><th>When</th><th>Event</th><th>IP</th><th>Why / by</th><th>Open for</th></tr></thead>
              <tbody>
                {p!.directHistory.slice(0, 10).map((e, i) => (
                  <tr key={`${e.at}-${i}`}>
                    <td>{new Date(e.at).toLocaleString()}</td><td>{e.event}</td><td><Mono>{e.ip ?? "—"}</Mono></td>
                    <td>{[e.why, e.by].filter(Boolean).join(" · ") || "—"}</td><td>{e.openMin != null ? `${e.openMin} min` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {msg && <Muted>{msg}</Muted>}
        </Body>
      ),
    },
    {
      id: "alerts",
      title: "Alerts",
      qmbm: "Office checks the pipeline every sampler tick. A deploy blocked past the threshold, the watcher offline, or a policed mesh while a build waits raises a Front Desk notice + email, repeats on the reminder interval, and closes with a resolved notice. An expired or failed deploy request, and the direct route opening (or closing for an abnormal reason), alert once.",
      body: (
        <Body>
          {openEpisodes.length ? openEpisodes.map(([k, e]) => (
            <Callout key={k} $tone="critical">
              <b>{e.title}</b> — {ago(e.activeSince)} · {e.sentCount ? `told ${e.sentCount}×, last ${ago(e.lastSentAt)} ago` : "under threshold, not sent yet"}
              <div>{e.detail}</div>
            </Callout>
          )) : <Pill $tone="ok">NOTHING STUCK</Pill>}
          <Grid>
            {flag("alerts", "enabled", "Alerts", a?.enabled)}
            {flag("alerts", "frontDesk", "Front Desk", a?.frontDesk)}
            {flag("alerts", "email", "Email", a?.email)}
            {flag("alerts", "linkAlerts", "Policed-mesh alert", a?.linkAlerts)}
          </Grid>
          <Grid>
            {num("alerts", "blockedMin", "Blocked for", "min", a?.blockedMin)}
            {num("alerts", "offlineMin", "Watcher offline for", "min", a?.offlineMin)}
            {num("alerts", "reminderMin", "Repeat every", "min", a?.reminderMin)}
          </Grid>
          <Cell>
            <StatLabel>Email recipients</StatLabel>
            <Rowline>
              <Input value={recipients} onChange={(e) => setRecipients(e.target.value)} style={{ flex: 1, minWidth: "14rem" }} disabled={busy} />
              <Save disabled={busy} onClick={() => void put({ alerts: { recipients: recipients.split(/[\s,]+/).filter(Boolean) } })}>Save</Save>
              <Save disabled={busy} onClick={() => void post("test")}>Send test</Save>
            </Rowline>
          </Cell>
          {msg && <Muted>{msg}</Muted>}
          {sends.length > 0 && (
            <Table>
              <thead><tr><th>Sent</th><th>Alert</th><th>Kind</th><th>Front Desk</th><th>Email</th></tr></thead>
              <tbody>
                {sends.slice(0, 12).map((s, i) => (
                  <tr key={`${s.at}-${i}`}>
                    <td>{new Date(s.at).toLocaleString()}</td><td>{s.title}</td><td>{s.send}</td><td>{s.frontDesk}</td><td>{s.email}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Body>
      ),
    },
    {
      id: "direct-settings",
      title: "Direct route rules",
      qmbm: "When the direct route closes itself. Read by RCS's reaper (every minute) and by every Mac-side check — a change applies on the next one.",
      body: (
        <Body>
          <Grid>
            {flag("directRoute", "closeWhenIdle", "Close when builds done", dc?.closeWhenIdle)}
            {flag("directRoute", "closeOnIpChange", "Close on IP change", dc?.closeOnIpChange)}
          </Grid>
          <Grid>
            {num("directRoute", "hardCapMin", "Hard cap", "min", dc?.hardCapMin)}
            {num("directRoute", "idleGraceSec", "Grace after last build", "s", dc?.idleGraceSec)}
            {num("directRoute", "unusedMin", "Close if unused for", "min", dc?.unusedMin)}
            {num("directRoute", "silentMin", "Close if Mac silent for", "min", dc?.silentMin)}
          </Grid>
        </Body>
      ),
    },
  ];

  return (
    <>
      <HardeningControlModal
        title="Pipeline"
        subtitle="what stands between main and live · who gets told when it sticks"
        sections={sections}
        auditLogView={<AuditLogTimeline endpoint="/api/hardening/pipeline/audit-log" />}
        onClose={onClose}
      />
      <ConfirmModal
        open={askClose}
        title="Close the direct route?"
        message={`RCS removes the firewall opening for ${dr?.ip ?? "the Mac"} within a minute.`}
        detail={dr?.leases.length ? `${dr.leases.length} build(s) are using it right now — they fall back to the mesh, or fail and retry.` : "Nothing is using it right now."}
        confirmLabel="Close it"
        intent="danger"
        onConfirm={async () => { setAskClose(false); await post("close-direct"); }}
        onCancel={() => setAskClose(false)}
      />
    </>
  );
}

function FragmentRows({ c }: { c: Client }) {
  const st = c.state ?? "idle";
  return (
    <>
      <tr>
        <td><Mono>{c.follows ? "↳ " : ""}{c.client}</Mono></td>
        <td><Pill $tone={STATE_TONE[st] ?? "none"}>{st.toUpperCase()}</Pill></td>
        <td><Mono>{sha(c.liveMono)}</Mono></td>
        <td><Mono>{sha(c.stagedMono)}</Mono></td>
        <td><Mono>{sha(c.mainMono)}</Mono></td>
        <td>{ago(c.updatedAt)}</td>
      </tr>
      {(c.phase || st === "blocked" || c.request) && (
        <tr>
          <td />
          <td colSpan={5}>
            {st === "blocked" ? (
              <Detail $tone="critical">blocked {ago(c.blockedSince)} — {blockerLine(c.blocked)}</Detail>
            ) : c.phase ? <Detail $tone="none">{c.phase}</Detail> : null}
            {c.request && (c.request.status === "waiting" || c.request.status === "promoting") && (
              <Detail $tone="warn">&ldquo;deploy&rdquo; {c.request.status} — asked by {c.request.by.join(", ")} {ago(c.request.at)} ago · expires {clock(c.request.expiresAt)}</Detail>
            )}
            {c.request && !(c.request.status === "waiting" || c.request.status === "promoting") && (
              <Detail $tone={c.request.status === "done" ? "ok" : "warn"}>last &ldquo;deploy&rdquo; {c.request.status} {ago(c.request.finishedAt)} ago{c.request.note ? ` — ${c.request.note}` : ""}</Detail>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

type Tone = "ok" | "info" | "warn" | "critical" | "none";
const TONE: Record<Tone, string> = {
  ok: colors.green,
  info: colors.cyan,
  warn: colors.gold,
  critical: colors.red,
  none: "var(--t-textFaint)",
};
const TONE_RGB: Record<Tone, string> = { ok: rgb.green, info: rgb.cyan, warn: rgb.gold, critical: rgb.red, none: rgb.cyan };

const Body = styled.div`display: flex; flex-direction: column; gap: 0.75rem;`;
const Rowline = styled.div`display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap;`;
const Pill = styled.span<{ $tone: Tone }>`
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; padding: 0.2rem 0.6rem; border-radius: 999px; width: fit-content;
  color: ${(p) => TONE[p.$tone]}; border: 1px solid ${(p) => (p.$tone === "none" ? "var(--t-border)" : TONE[p.$tone])}; background: var(--t-inputBg);
`;
const Callout = styled.div<{ $tone: Tone }>`
  font-size: 0.75rem; line-height: 1.45; padding: 0.55rem 0.75rem; border-radius: 0.5rem; color: var(--t-text);
  border: 1px solid rgba(${(p) => TONE_RGB[p.$tone]}, 0.45); background: rgba(${(p) => TONE_RGB[p.$tone]}, 0.08);
  div { margin-top: 0.25rem; color: var(--t-textMuted); }
`;
const Detail = styled.div<{ $tone: Tone }>`font-size: 0.72rem; color: ${(p) => (p.$tone === "none" ? "var(--t-textFaint)" : TONE[p.$tone])}; padding: 0.1rem 0;`;
const Muted = styled.div`font-size: 0.72rem; color: var(--t-textFaint);`;
const Mono = styled.span`font-family: var(--font-geist-mono), monospace; font-size: 0.72rem; color: var(--t-text);`;
const ErrText = styled.div`font-size: 0.6875rem; color: ${colors.red}; font-family: var(--font-geist-mono), monospace;`;
const Grid = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0.625rem;`;
const Cell = styled.div`display: flex; flex-direction: column; gap: 0.2rem;`;
const StatLabel = styled.span`font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--t-textFaint);`;
const TBtn = styled.button<{ $active: boolean }>`
  padding: 0.3rem 0.7rem; font-size: 0.72rem; font-weight: 650; border-radius: 0.4rem; cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.16)` : "transparent")};
  color: ${(p) => (p.$active ? colors.gold : "var(--t-textMuted)")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.5)` : "var(--t-border)")};
  &:hover:not(:disabled) { color: ${colors.gold}; border-color: rgba(${rgb.gold}, 0.5); }
  &:disabled { opacity: 0.5; cursor: default; }
`;
const Save = styled(TBtn).attrs({ $active: false })``;
const Danger = styled.button`
  padding: 0.35rem 0.8rem; font-size: 0.72rem; font-weight: 700; border-radius: 0.4rem; cursor: pointer;
  background: rgba(${rgb.red}, 0.12); color: ${colors.red}; border: 1px solid rgba(${rgb.red}, 0.5);
  &:disabled { opacity: 0.5; cursor: default; }
`;
const Input = styled.input`
  font-size: 0.78rem; font-variant-numeric: tabular-nums; padding: 0.3rem 0.5rem; border-radius: 0.4rem;
  background: var(--t-inputBg); color: var(--t-text); border: 1px solid var(--t-border);
  &:focus { outline: none; border-color: rgba(${rgb.gold}, 0.5); }
`;
const Table = styled.table`
  width: 100%; border-collapse: collapse; font-size: 12px;
  th { text-align: left; font-weight: 600; color: var(--t-textGhost); padding: 4px 8px 4px 0; border-bottom: 1px solid rgba(${rgb.cyan},0.18); }
  td { padding: 4px 8px 4px 0; border-bottom: 1px solid rgba(${rgb.cyan},0.08); font-variant-numeric: tabular-nums; vertical-align: top; }
`;

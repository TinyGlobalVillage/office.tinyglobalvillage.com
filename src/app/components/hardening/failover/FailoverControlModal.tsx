"use client";
// Failover — Utils tile (Gio 2026-11-22). RCS1 is a warm standby for RCS2: it streams RCS2's databases,
// gets files every 5 min and builds nightly, and takes over when RCS2 is down — only when two witnesses
// agree (RCS2 unreachable from RCS1 AND the public site failing at Cloudflare) for DOWN_MINUTES. Once a
// quarter a sealed drill boots everything on RCS1 with the network cut and emails the results.
// This panel shows the standby live, flips auto-takeover / hold, tunes the timings, the alert address and
// the drill months, and can ask for a drill now. Runtime: mono utils/scripts/system/failover/.
import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";
import Tooltip from "@/app/components/ui/Tooltip";
import NeonButton from "@tgv/module-component-library/components/ui/NeonButton";
import Lightswitch from "@tgv/module-component-library/components/ui/Lightswitch";
import { askConfirm } from "../../dialogService";
import { CLAMPS, type FailoverSettings, type FailoverSnapshot, type NumericKey, type SyncResult } from "@/lib/failover/config";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const secsSince = (iso?: string | null) => (iso ? Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000) : null);
const ago = (iso?: string | null) => {
  const s = secsSince(iso);
  if (s == null) return "never";
  return s < 90 ? `${Math.round(s)}s ago` : s < 5400 ? `${Math.round(s / 60)}m ago` : s < 172800 ? `${Math.round(s / 3600)}h ago` : new Date(iso!).toLocaleString();
};
const dur = (s?: number | null) => (s == null ? "—" : s < 90 ? `${Math.round(s)}s` : s < 5400 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`);

const FIELDS: { key: NumericKey; label: string; unit: string; hint: string }[] = [
  { key: "warnMinute", label: "Warn after", unit: "min", hint: "Email “RCS2 looks down” once it has been down this long." },
  { key: "downMinutes", label: "Take over after", unit: "min", hint: "Both witnesses must agree RCS2 is down for this many minutes in a row." },
  { key: "maxLagMinutes", label: "Max copy age", unit: "min", hint: "No automatic takeover if RCS1's database copy is older than this." },
];

type Form = Record<NumericKey, string> & { alertTo: string; drillMonths: number[] };
const toForm = (s: FailoverSettings): Form => ({
  warnMinute: String(s.warnMinute), downMinutes: String(s.downMinutes), maxLagMinutes: String(s.maxLagMinutes),
  alertTo: s.alertTo, drillMonths: [...s.drillMonths],
});

export default function FailoverControlModal({ onClose }: { onClose: () => void }) {
  const [snap, setSnap] = useState<FailoverSnapshot | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (resetForm = false) => {
    try {
      const r = await fetch("/api/admin/failover", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setSnap(j);
      if (resetForm) setForm(toForm(j.settings));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { void load(true); }, [load]);
  useEffect(() => {
    const t = setInterval(() => void load(false), 20000);
    return () => clearInterval(t);
  }, [load]);

  const send = async (method: "PATCH" | "POST", payload: unknown) => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/failover", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setSnap(j);
      if (method === "PATCH") setForm(toForm(j.settings));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runDrill = async () => {
    const ok = await askConfirm({
      title: "Run a sealed drill now?",
      message: "RCS1 cuts its own network, starts every site, database, call and video service on its copy, checks them, then goes back to standby.",
      detail: "Takes about 10 minutes. Nothing live is touched and RCS2 keeps serving. The results are emailed and posted as a team alert.",
      confirmLabel: "Run drill",
    });
    if (ok) await send("POST", { action: "drill" });
  };

  const s = snap?.settings;
  const r1 = snap?.rcs1;
  const problems = snap?.health?.problems ?? [];
  const tookOver = r1?.role === "primary";
  const lag = r1?.replica?.replay_age_s;
  const drill = r1?.drill_last;
  const dirty = !!s && !!form && (
    FIELDS.some((f) => form[f.key] !== String(s[f.key])) || form.alertTo !== s.alertTo || form.drillMonths.join(" ") !== s.drillMonths.join(" ")
  );
  const syncRow = (label: string, x: SyncResult | null, every: string) => (
    <tr>
      <td>{label}</td>
      <td>{every}</td>
      <td>{ago(x?.at)}</td>
      <td style={{ color: !x ? "var(--t-textFaint)" : x.ok ? colors.green : colors.red }}>{!x ? "not run yet" : x.ok ? `ok · ${dur(x.seconds)}` : `${x.failures} failed`}</td>
    </tr>
  );

  const sections: HCMSection[] = [
    {
      id: "standby",
      title: "Standby now",
      qmbm: "RCS1 keeps a live copy of RCS2. Databases stream continuously; uploads, certificates and data files copy every 5 minutes; code, builds and config copy nightly and after every deploy. RCS2 checks the copy every 5 minutes and emails once when something breaks and once when it clears.",
      body: !snap ? <Muted>{error ? `Could not load: ${error}` : "Loading…"}</Muted> : (
        <Body>
          {!snap.installed && <Warn>Failover is not installed on this box. Run <code>install.sh rcs2</code>.</Warn>}
          {tookOver && <Crit>RCS1 has TAKEN OVER and is serving every site. When RCS2 is healthy again, run <code>failover-failback.sh</code> on RCS2.</Crit>}
          <Rowline>
            <Pill $tone={tookOver ? "critical" : problems.length ? "warn" : r1 ? "ok" : "warn"}>
              {tookOver ? "RCS1 serving" : problems.length ? `${problems.length} problem${problems.length > 1 ? "s" : ""}` : r1 ? "Ready to take over" : "No report yet"}
            </Pill>
            <Muted>RCS1 {r1?.role ?? "—"} · watcher {ago(r1?.at)} · {r1?.action ?? "—"}</Muted>
          </Rowline>
          {problems.length > 0 && <Problems>{problems.map((p) => <li key={p}>{p}</li>)}</Problems>}
          <Table>
            <thead><tr><th>Copy</th><th>How often</th><th>Last</th><th>Result</th></tr></thead>
            <tbody>
              <tr>
                <td>Databases</td>
                <td>streaming</td>
                <td>{lag == null ? "—" : `${dur(lag)} behind`}</td>
                <td style={{ color: r1?.replica?.receiver === "streaming" ? colors.green : colors.gold }}>{r1?.replica?.receiver ?? r1?.replica?.error ?? "—"}</td>
              </tr>
              {syncRow("Data files", snap.sync.data, "5 min")}
              {syncRow("Code + builds", snap.sync.full, "nightly + deploys")}
            </tbody>
          </Table>
          {r1?.witness && (
            <Rowline>
              <Label as="span">Witnesses</Label>
              <Muted>
                RCS2 web {r1.witness.rcs2_https ? "up" : "DOWN"} · RCS2 mesh {r1.witness.rcs2_mesh_ssh ? "up" : "DOWN"} ·
                {" "}public site {r1.witness.public ? "FAILING" : "ok"} · RCS1 online {r1.witness.self_online ? "yes" : "NO"}
                {r1.down_minutes ? ` · down ${r1.down_minutes} min` : ""}
              </Muted>
            </Rowline>
          )}
        </Body>
      ),
    },
    {
      id: "takeover",
      title: "Takeover",
      qmbm: "Auto on: when RCS2 is unreachable from RCS1 AND the public site fails at Cloudflare for the set minutes, RCS1 promotes its copy, starts everything and points DNS at itself. Auto off: it only emails. Hold: no takeover and no scheduled drill — use it while working on RCS2. RCS2 fences itself (stops serving) if it comes back while RCS1 serves.",
      body: !s ? <Muted>Loading…</Muted> : (
        <Body>
          <Rowline>
            <Tooltip label={s.autoTakeover ? "Auto-takeover on" : "Auto-takeover off"}>
              <Lightswitch on={s.autoTakeover} disabled={busy || !snap?.installed} ariaLabel="Automatic takeover" onChange={(on) => void send("PATCH", { autoTakeover: on })} />
            </Tooltip>
            <Muted>{s.autoTakeover ? "RCS1 takes over on its own when both witnesses agree" : "Watch + email only — a takeover needs failover-promote.sh"}</Muted>
          </Rowline>
          <Rowline>
            <Tooltip label={s.hold ? "Hold on" : "Hold off"}>
              <Lightswitch on={s.hold} disabled={busy || !snap?.installed} ariaLabel="Hold failover" onChange={(on) => void send("PATCH", { hold: on })} />
            </Tooltip>
            <Muted>{s.hold ? "HOLD — no takeover, no scheduled drill" : "Hold off"}</Muted>
          </Rowline>
        </Body>
      ),
    },
    {
      id: "settings",
      title: "Timings, alerts, drill months",
      qmbm: "Every number is clamped to a safe range and the warning always comes before the takeover. Alerts (problems, takeovers, drills, reminders) go by email to the address below and as Office team alerts. Drills run on the first Sunday of each ticked month at 04:00 Pacific; a reminder goes out 7 days before, and November's also asks for the yearly real switch.",
      body: !s || !form ? <Muted>Loading…</Muted> : (
        <Body>
          <Grid>
            {FIELDS.map((f) => (
              <Field key={f.key}>
                <Label htmlFor={`fo-${f.key}`}>{f.label}</Label>
                <Rowline>
                  <Num id={`fo-${f.key}`} type="number" min={CLAMPS[f.key][0]} max={CLAMPS[f.key][1]} value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                  <Muted>{f.unit} · {CLAMPS[f.key][0]}–{CLAMPS[f.key][1]}</Muted>
                </Rowline>
                <Muted>{f.hint}</Muted>
              </Field>
            ))}
            <Field>
              <Label htmlFor="fo-alertTo">Alert email</Label>
              <Text id="fo-alertTo" type="email" value={form.alertTo} onChange={(e) => setForm({ ...form, alertTo: e.target.value })} />
              <Muted>Problems, takeovers, drill results and reminders.</Muted>
            </Field>
          </Grid>
          <Field>
            <Label as="span">Drill months</Label>
            <Rowline>
              {MONTHS.map((m, i) => {
                const on = form.drillMonths.includes(i + 1);
                return (
                  <Tooltip key={m} label={on ? `Drill in ${m}` : `No drill in ${m}`}>
                    <NeonButton strong={on} disabled={busy} onClick={() => setForm({ ...form, drillMonths: on ? form.drillMonths.filter((x) => x !== i + 1) : [...form.drillMonths, i + 1].sort((a, b) => a - b) })}>
                      {m}
                    </NeonButton>
                  </Tooltip>
                );
              })}
            </Rowline>
          </Field>
          <Rowline>
            <Spacer />
            <Tooltip label="Reset">
              <NeonButton disabled={busy || !dirty} onClick={() => setForm(toForm(s))}>Reset</NeonButton>
            </Tooltip>
            <Tooltip label="Save settings">
              <NeonButton strong disabled={busy || !dirty || !snap?.installed || form.drillMonths.length === 0}
                onClick={() => void send("PATCH", {
                  warnMinute: Number(form.warnMinute), downMinutes: Number(form.downMinutes), maxLagMinutes: Number(form.maxLagMinutes),
                  alertTo: form.alertTo, drillMonths: form.drillMonths,
                })}>
                Save
              </NeonButton>
            </Tooltip>
          </Rowline>
        </Body>
      ),
    },
    {
      id: "drill",
      title: "Drills",
      qmbm: "A sealed drill cuts RCS1 off the network, boots a throwaway copy of every database, starts every site, Keycloak, Documenso, calls and video, checks each one, then returns RCS1 to standby. Nothing live is touched. Once a year (November) do a real switch with Gio watching.",
      body: !snap ? <Muted>Loading…</Muted> : (
        <Body>
          <Rowline>
            <Label as="span">Next</Label>
            <Muted>{snap.nextDrill ? new Date(`${snap.nextDrill}T12:00:00`).toDateString() : "—"} · 04:00 Pacific{s?.hold ? " · skipped while on hold" : ""}</Muted>
            <Spacer />
            <Tooltip label="Run drill now">
              <NeonButton strong disabled={busy || !snap.installed || snap.drillRequested || tookOver} onClick={() => void runDrill()}>
                {snap.drillRequested ? "Drill requested…" : "Run drill now"}
              </NeonButton>
            </Tooltip>
          </Rowline>
          {!drill ? <Muted>No drill has run yet.</Muted> : (
            <>
              <Rowline>
                <Pill $tone={drill.failed ? "critical" : "ok"}>{drill.failed ? `Failed ${drill.failed}` : "Passed"}</Pill>
                <Muted>{new Date(drill.at).toLocaleString()} · {drill.passed + drill.failed} checks · {dur(drill.seconds)} · {drill.memory ?? ""}</Muted>
              </Rowline>
              <Results>
                {drill.results.map((line, i) => (
                  <li key={i} style={{ color: line.startsWith("FAIL") ? colors.red : "var(--t-text)" }}>{line}</li>
                ))}
              </Results>
            </>
          )}
        </Body>
      ),
    },
  ];

  return (
    <HardeningControlModal
      title="Failover"
      subtitle="RCS1 stands by for RCS2"
      qmbm={error ? `Error: ${error}` : "If RCS2 goes down, RCS1 takes over every site, Keycloak, Office, Documenso, calls and video within minutes — automatically, but only when two independent witnesses agree. This panel shows how fresh RCS1's copy is, controls the takeover, and runs the quarterly drill."}
      sections={sections}
      auditLogView={<AuditLogTimeline endpoint="/api/admin/failover/audit-log" />}
      onClose={onClose}
    />
  );
}

const Body = styled.div`display: flex; flex-direction: column; gap: 0.75rem;`;
const Rowline = styled.div`display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap;`;
const Spacer = styled.div`flex: 1 1 auto;`;
const Muted = styled.div`font-size: 0.72rem; color: var(--t-textFaint);`;
const Warn = styled.div`
  font-size: 0.78rem; color: ${colors.gold};
  border: 1px solid rgba(${rgb.gold}, 0.4); background: rgba(${rgb.gold}, 0.08);
  border-radius: 0.5rem; padding: 0.5rem 0.75rem;
`;
const Crit = styled(Warn)`color: ${colors.red}; border-color: currentColor; background: transparent;`;
const Pill = styled.span<{ $tone: "ok" | "warn" | "critical" }>`
  font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 999px;
  color: ${(p) => (p.$tone === "ok" ? colors.green : p.$tone === "warn" ? colors.gold : colors.red)};
  border: 1px solid currentColor;
`;
const Problems = styled.ul`margin: 0; padding-left: 1.1rem; font-size: 0.75rem; color: ${colors.gold}; display: flex; flex-direction: column; gap: 0.2rem;`;
const Label = styled.label`font-size: 0.75rem; font-weight: 650; color: var(--t-textMuted); min-width: 5.5rem;`;
const Grid = styled.div`display: grid; gap: 0.875rem; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));`;
const Field = styled.div`display: flex; flex-direction: column; gap: 0.3rem;`;
const Num = styled.input`
  width: 6.5rem; padding: 0.35rem 0.5rem; border-radius: 0.4rem; font-size: 0.8rem;
  background: var(--t-inputBg, transparent); color: var(--t-text); border: 1px solid var(--t-border);
  color-scheme: dark;
`;
const Text = styled(Num)`width: 100%; max-width: 18rem;`;
const Table = styled.table`
  width: 100%; border-collapse: collapse; font-size: 0.75rem;
  th { text-align: left; font-weight: 650; color: var(--t-textMuted); padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--t-border); }
  td { padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--t-border); color: var(--t-text); }
  @media (max-width: 520px) { th:nth-child(2), td:nth-child(2) { display: none; } }
`;
const Results = styled.ul`
  list-style: none; margin: 0; padding: 0; max-height: 16rem; overflow-y: auto;
  display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.72rem; font-family: var(--font-mono, monospace);
`;

"use client";
// Dev Server Pool — Utils tile (Gio 2026-11-21). The workshop's dev servers on RCS2 share one
// memory pool: each lean-dev server may grow to a big heap ceiling and keeps a guaranteed floor,
// and when tgv-workshop.slice passes the trigger, rcs-gov (a root systemd daemon, mono
// utils/scripts/build-pipeline/rcs-gov.py) restarts the IDLE ones — never one that served a
// request in the last 10 minutes. This panel shows the pool live, flips the governor on/off,
// tunes its thresholds and the slice's caps (all clamped), and shows what it did.
import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";
import Tooltip from "@/app/components/ui/Tooltip";
import NeonButton from "@tgv/module-component-library/components/ui/NeonButton";
import Lightswitch from "@tgv/module-component-library/components/ui/Lightswitch";
import { CLAMPS, PROTECT_MIN, type NumericKey, type RcsGovConfig, type RcsGovLogLine, type RcsGovStatus } from "@/lib/rcs-gov/config";

type Snapshot = { config: RcsGovConfig; status: RcsGovStatus | null; installed: boolean; stale: boolean };

const gb = (mb?: number | null) => (typeof mb === "number" ? `${(mb / 1024).toFixed(1)} GB` : "—");
const ago = (t?: number | null) => {
  if (!t) return "never";
  const s = Math.max(0, Math.round(Date.now() / 1000 - t));
  return s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)}m ago` : new Date(t * 1000).toLocaleString();
};

const FIELDS: { key: NumericKey; label: string; unit: string; hint: string }[] = [
  { key: "triggerGB", label: "Trigger", unit: "GB", hint: "Above this the governor starts restarting idle dev servers." },
  { key: "idleMin", label: "Idle for", unit: "min", hint: `A server must have had no request this long to be restarted (never under ${PROTECT_MIN}).` },
  { key: "cooldownSec", label: "Cooldown", unit: "s", hint: "Wait between restarts so the freed memory shows first." },
  { key: "heapMB", label: "Heap ceiling", unit: "MB", hint: "Per dev server. Applies to servers started after the change." },
  { key: "floorMB", label: "Floor", unit: "MB", hint: "Guaranteed memory per dev server (its MemoryLow). New servers only." },
  { key: "sliceHighGB", label: "Slice soft cap", unit: "GB", hint: "MemoryHigh: the kernel reclaims hard above this." },
  { key: "sliceMaxGB", label: "Slice hard cap", unit: "GB", hint: "MemoryMax: the wall. The OOM killer acts inside the workshop above it." },
  { key: "cpuCapThreads", label: "CPU cap", unit: "threads", hint: "Most CPU threads the workshop may use at once (0 = no cap). Production keeps the rest." },
  { key: "cpuAlertPct", label: "CPU alert at", unit: "%", hint: "Raise an alert when the whole box stays at or above this." },
  { key: "cpuAlertMin", label: "CPU alert after", unit: "min", hint: "How long it must stay that high before the alert." },
  { key: "teglovIdleThreads", label: "Teglov, no builds", unit: "threads", hint: "Threads Teglov may use while no build runs. Taken out of the workshop's CPU cap while it answers." },
  { key: "teglovBuildThreads", label: "Teglov, during builds", unit: "threads", hint: "Threads Teglov may use while a build runs." },
  { key: "teglovMemHighGB", label: "Teglov soft memory", unit: "GB", hint: "MemoryHigh for Teglov's model server. The model needs about 25 GB; lower makes it slow." },
  { key: "teglovMemMaxGB", label: "Teglov hard memory", unit: "GB", hint: "MemoryMax for Teglov's model server: the wall." },
];

export default function RcsGovControlModal({ onClose }: { onClose: () => void }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [log, setLog] = useState<RcsGovLogLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<NumericKey, string> | null>(null);

  const toForm = (c: RcsGovConfig) => Object.fromEntries(FIELDS.map((f) => [f.key, String(c[f.key])])) as Record<NumericKey, string>;

  const load = useCallback(async (resetForm = false) => {
    try {
      const [r, l] = await Promise.all([
        fetch("/api/admin/rcs-gov", { cache: "no-store" }),
        fetch("/api/admin/rcs-gov/log?limit=60", { cache: "no-store" }),
      ]);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setSnap(j);
      if (resetForm) setForm(toForm(j.config));
      if (l.ok) setLog((await l.json()).lines ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { void load(true); }, [load]);
  useEffect(() => {
    const t = setInterval(() => void load(false), 15000);
    return () => clearInterval(t);
  }, [load]);

  const save = async (patch: Partial<RcsGovConfig>) => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/rcs-gov", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setSnap(j);
      setForm(toForm(j.config));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cfg = snap?.config;
  const st = snap?.status;
  const sl = st?.slice;
  const dirty = !!cfg && !!form && FIELDS.some((f) => form[f.key] !== String(cfg[f.key]));
  const pct = (mb?: number | null) => (sl?.maxMb && typeof mb === "number" ? Math.min(100, (mb / sl.maxMb) * 100) : 0);

  const sections: HCMSection[] = [
    {
      id: "pool",
      title: "Pool now",
      qmbm: "The bar is tgv-workshop.slice against its hard cap: dev servers, builds, lane Claude sessions, Playwright. Markers: trigger (governor acts), soft cap (kernel reclaims), hard cap (the wall). Each dev server below can grow as it needs; idle ones are the governor's to restart.",
      body: !snap ? <Muted>{error ? `Could not load: ${error}` : "Loading…"}</Muted> : (
        <Body>
          {!snap.installed && <Warn>rcs-gov is not installed on this box. Run <code>rcs-gov.py install</code>.</Warn>}
          {snap.installed && snap.stale && <Warn>The daemon has not reported for over a minute — check <code>systemctl status rcs-gov</code>.</Warn>}
          {st?.error && <Warn>{st.error}</Warn>}
          {sl && (
            <>
              <Rowline>
                <Pill $tone={st?.over ? (cfg?.enabled ? "warn" : "critical") : "ok"}>
                  {st?.over ? (cfg?.enabled ? "Over trigger — governing" : "Over trigger — governor off") : "Under trigger"}
                </Pill>
                <Muted>{gb(sl.usedMb)} {cfg?.metric === "workingSet" ? "working set" : "in use"} · {gb(sl.anonMb)} anon · last action {ago(st?.lastActionAt)}</Muted>
                {st?.cpu && <Muted>CPU: box at {st.cpu.boxPct}% · workshop capped at {st.cpu.capThreads || "no"} thread{st.cpu.capThreads === 1 ? "" : "s"}{st.cpu.lentToTeglov ? ` (${st.cpu.lentToTeglov} lent to Teglov)` : ""}{st.cpu.alerted ? " · high-CPU alert raised" : ""}</Muted>}
                {st?.teglov?.running && <Muted>Teglov: {st.teglov.busy ? `answering, ${st.teglov.threads ?? "?"} threads` : "idle"} · cap {st.teglov.capThreads} thread{st.teglov.capThreads === 1 ? "" : "s"}{st.teglov.build ? " (build running)" : ""} · {Math.round((st.teglov.memMb ?? 0) / 1024)} of {st.teglov.memHighGB} GB</Muted>}
              </Rowline>
              <Bar aria-label="Workshop slice memory">
                <Fill style={{ width: `${pct(sl.usedMb)}%` }} $over={!!st?.over} />
                <Mark style={{ left: `${pct(sl.triggerMb)}%` }} $c="gold" />
                {sl.highMb && <Mark style={{ left: `${pct(sl.highMb)}%` }} $c="orange" />}
              </Bar>
              <Muted>trigger {gb(sl.triggerMb)} · soft cap {gb(sl.highMb)} · hard cap {gb(sl.maxMb)}</Muted>
            </>
          )}
          <Table>
            <thead><tr><th>Lane</th><th>Port</th><th>Memory</th><th>Idle</th><th>Governor</th></tr></thead>
            <tbody>
              {(st?.servers ?? []).length === 0 && <tr><td colSpan={5}><Muted>No lean-dev servers running.</Muted></td></tr>}
              {(st?.servers ?? []).map((s) => (
                <tr key={s.unit}>
                  <td>{s.lane}</td>
                  <td>{s.port}</td>
                  <td>{gb(s.mb)}</td>
                  <td>{s.idleMin == null ? "—" : `${Math.round(s.idleMin)}m`}</td>
                  <td style={{ color: s.eligible ? colors.gold : colors.green }}>
                    {!s.alive ? "launcher gone" : s.eligible ? (s.canRestart ? "may restart" : "may stop (old lean-dev)") : "protected (active)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Body>
      ),
    },
    {
      id: "switch",
      title: "Governor",
      qmbm: "On: over the trigger it restarts the dev server idle longest, then the largest idle one, one per cooldown. Off: it only watches and logs. The slice caps stay in force either way.",
      body: !cfg ? <Muted>Loading…</Muted> : (
        <Body>
          <Rowline>
            <Tooltip label={cfg.enabled ? "Governor on" : "Governor off"}>
              <Lightswitch on={cfg.enabled} disabled={busy || !snap?.installed} ariaLabel="Dev server pool governor" onChange={(on) => void save({ enabled: on })} />
            </Tooltip>
            <Muted>{cfg.enabled ? "Restarts idle dev servers when the pool is over the trigger" : "Watching only — no restarts"}</Muted>
          </Rowline>
          <Rowline>
            <Label as="span">Measure</Label>
            <Tooltip label="Working set">
              <NeonButton strong={cfg.metric === "workingSet"} disabled={busy} onClick={() => void save({ metric: "workingSet" })}>Working set</NeonButton>
            </Tooltip>
            <Tooltip label="Raw cgroup memory">
              <NeonButton strong={cfg.metric === "current"} disabled={busy} onClick={() => void save({ metric: "current" })}>All memory</NeonButton>
            </Tooltip>
          </Rowline>
          <Muted>Working set leaves out file cache the kernel drops first.</Muted>
        </Body>
      ),
    },
    {
      id: "thresholds",
      title: "Thresholds",
      qmbm: "Every value is clamped to a safe range (the box has 62 GB and prod keeps a 24 GB floor). The trigger stays at least 2 GB under the soft cap, and the hard cap at least 2 GB above it.",
      body: !cfg || !form ? <Muted>Loading…</Muted> : (
        <Body>
          <Grid>
            {FIELDS.map((f) => (
              <Field key={f.key}>
                <Label htmlFor={`gov-${f.key}`}>{f.label}</Label>
                <Rowline>
                  <Num
                    id={`gov-${f.key}`}
                    type="number"
                    min={CLAMPS[f.key][0]}
                    max={CLAMPS[f.key][1]}
                    value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                  <Muted>{f.unit} · {CLAMPS[f.key][0]}–{CLAMPS[f.key][1]}</Muted>
                </Rowline>
                <Muted>{f.hint}</Muted>
              </Field>
            ))}
          </Grid>
          <Rowline>
            <Spacer />
            <Tooltip label="Reset">
              <NeonButton disabled={busy || !dirty} onClick={() => setForm(toForm(cfg))}>Reset</NeonButton>
            </Tooltip>
            <Tooltip label="Save thresholds">
              <NeonButton strong disabled={busy || !dirty || !snap?.installed} onClick={() => void save(Object.fromEntries(FIELDS.map((f) => [f.key, Number(form[f.key])])) as Partial<RcsGovConfig>)}>
                Save
              </NeonButton>
            </Tooltip>
          </Rowline>
        </Body>
      ),
    },
    {
      id: "actions",
      title: "Governor log",
      qmbm: "What the daemon did, newest first: when the pool went over or back under the trigger, each restart (and why that server), holds when nothing was idle, and slice cap changes.",
      body: (
        <Body>
          {log.length === 0 ? <Muted>Nothing logged yet.</Muted> : (
            <LogList>
              {log.map((l, i) => (
                <li key={`${l.t}-${i}`}>
                  <LogKind $k={l.kind}>{l.kind}</LogKind>
                  <span>{new Date(l.t * 1000).toLocaleString()}</span>
                  {l.lane && <strong>{l.lane}{l.port ? `:${l.port}` : ""}</strong>}
                  <span>{l.reason}</span>
                </li>
              ))}
            </LogList>
          )}
        </Body>
      ),
    },
  ];

  return (
    <HardeningControlModal
      title="Dev Server Pool"
      subtitle="workshop dev servers share one memory pool"
      qmbm={error ? `Error: ${error}` : "Up to a dozen lanes' dev servers on RCS2 share the workshop's memory: a server that needs 8 GB can have it while idle ones sit small. When the pool fills, the governor restarts idle servers to give memory back — never one in use."}
      sections={sections}
      auditLogView={<AuditLogTimeline endpoint="/api/admin/rcs-gov/audit-log" />}
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
const Pill = styled.span<{ $tone: "ok" | "warn" | "critical" }>`
  font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 999px;
  color: ${(p) => (p.$tone === "ok" ? colors.green : p.$tone === "warn" ? colors.gold : colors.red)};
  border: 1px solid currentColor;
`;
const Bar = styled.div`
  position: relative; height: 0.75rem; border-radius: 999px; overflow: hidden;
  background: var(--t-border);
`;
const Fill = styled.div<{ $over: boolean }>`
  height: 100%; border-radius: 999px; transition: width 0.4s ease;
  background: ${(p) => (p.$over ? colors.gold : colors.green)};
`;
const Mark = styled.div<{ $c: "gold" | "orange" }>`
  position: absolute; top: 0; bottom: 0; width: 2px;
  background: ${(p) => (p.$c === "gold" ? colors.gold : colors.red)};
`;
const Label = styled.label`font-size: 0.75rem; font-weight: 650; color: var(--t-textMuted); min-width: 5.5rem;`;
const Grid = styled.div`
  display: grid; gap: 0.875rem; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
`;
const Field = styled.div`display: flex; flex-direction: column; gap: 0.3rem;`;
const Num = styled.input`
  width: 6.5rem; padding: 0.35rem 0.5rem; border-radius: 0.4rem; font-size: 0.8rem;
  background: var(--t-inputBg, transparent); color: var(--t-text); border: 1px solid var(--t-border);
  color-scheme: dark;
`;
const Table = styled.table`
  width: 100%; border-collapse: collapse; font-size: 0.75rem;
  th { text-align: left; font-weight: 650; color: var(--t-textMuted); padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--t-border); }
  td { padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--t-border); color: var(--t-text); }
  @media (max-width: 520px) { th:nth-child(2), td:nth-child(2) { display: none; } }
`;
const LogList = styled.ul`
  list-style: none; margin: 0; padding: 0; max-height: 18rem; overflow-y: auto;
  display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.72rem; color: var(--t-text);
  li { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: baseline; border-bottom: 1px solid var(--t-border); padding-bottom: 0.3rem; }
  li > span:nth-of-type(1) { color: var(--t-textFaint); }
`;
const LogKind = styled.span<{ $k: string }>`
  font-weight: 700; text-transform: uppercase; font-size: 0.65rem; letter-spacing: 0.04em; min-width: 4rem;
  color: ${(p) => (p.$k === "restart" || p.$k === "stop" ? colors.gold : p.$k === "error" ? colors.red : p.$k === "calm" ? colors.green : "var(--t-textMuted)")};
`;

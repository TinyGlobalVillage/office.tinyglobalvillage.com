"use client";

// BenchPanel — the deploy clock on the Deploy page (Gio 2026-10-29: "tracks the stamp and
// benchmarks how long things are actually taking. include speed tests"). Reads
// /api/deploy/bench: every pipeline step's start/end stamp, joined per run, plus the
// Mac→RCS link tests. Shows what to expect, the run in progress, one run's waterfall, the
// per-step trend, and the link. WARN ONLY: nothing here changes how a deploy is routed.

import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import ADDM from "@tgv/module-component-library/components/ui/ADDM";
import { colors, rgb } from "../../theme";
import Tooltip from "../ui/Tooltip";

type Step = { step: string; startMs: number; secs: number | null; ok: boolean | null; bytes?: number; compile?: number; code?: string; note?: string };
type Promote = { id: string; at: string; by?: string; ok: boolean | null; secs: number | null; steps: Step[] };
type Run = {
  run: string; at: string; secs: number | null; open: boolean; result: string | null; ok: boolean | null;
  by?: string; note?: string; mono?: string; contended: boolean;
  ctx: { devMb?: number; playwrightMb?: number; pressure?: number; swapUsedMb?: number; diskFreeGb?: number } | null;
  steps: Step[]; promotes: Promote[];
};
type Trend = { step: string; n: number; median: number; p90: number; last: number; series: Array<{ run: string; secs: number; contended: boolean; ok: boolean }> };
type Route = { route: string; host?: string; sameAs?: string; error?: string; rttMs?: number | null; upMBps?: number | null; downMBps?: number | null;
  rsyncSecs?: number | null; timedOut?: boolean; upMB?: number; limitSecs?: number };
type LinkTest = { t: string; kind: "probe" | "full"; run?: string; routes: Route[] };
type Config = { uploadWarnMBps: number; contendedRssMb: number; trendRuns: number };
type Bench = {
  client: string; clients: string[]; config: Config; runs: Run[]; trend: Trend[];
  expect: { secs: number; n: number; nextBuild: number | null } | null;
  live: { run: string; step: string | null; stepSecs: number; secs: number } | null;
  linkspeed: LinkTest[]; speedtestPending: { at: string; by: string } | null;
};

const fmt = (s: number | null | undefined) => {
  if (s == null || !Number.isFinite(s)) return "—";
  if (s < 10) return `${s.toFixed(1)}s`;
  if (s < 90) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return m < 60 ? `${m}m ${String(r).padStart(2, "0")}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
};
const mb = (b?: number) => (b == null ? "" : b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
const ago = (t?: string | null) => {
  if (!t) return "";
  const s = Math.max(0, Math.round((Date.now() - Date.parse(t)) / 1000));
  return s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)}m ago` : s < 172800 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
};
const label = (c: string) => (c === "_dists" ? "@tgv dists" : c.replace(/\.tinyglobalvillage\.com$/, "").replace(/^tinyglobalvillage\.com$/, "tgv.com"));
/** A timed-out upload still bounds the speed: it moved less than upMB in limitSecs. */
const upText = (r: Route) => (r.upMBps != null ? `${r.upMBps} MB/s` : r.timedOut && r.upMB && r.limitSecs ? `< ${(r.upMB / r.limitSecs).toFixed(2)} MB/s` : "—");
const upValue = (r: Route) => (r.upMBps != null ? r.upMBps : r.timedOut && r.upMB && r.limitSecs ? r.upMB / r.limitSecs : null);
const stepDetail = (s: Step) => [
  fmt(s.secs), s.ok === false ? "failed" : s.secs == null ? "running" : "",
  s.bytes ? mb(s.bytes) : "", s.compile ? `compile ${fmt(s.compile)}` : "", s.code ? `HTTP ${s.code}` : "", s.note ?? "",
].filter(Boolean).join(" · ");

export default function BenchPanel() {
  const [client, setClient] = useState<string | null>(null);
  const [data, setData] = useState<Bench | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string>("");
  const [openCfg, setOpenCfg] = useState(false);
  const [draft, setDraft] = useState<Config | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/deploy/bench${client ? `?client=${encodeURIComponent(client)}` : ""}`, { cache: "no-store" });
      if (r.ok) { const d: Bench = await r.json(); setData(d); if (!client) setClient(d.client); }
    } catch { /* */ }
  }, [client]);
  useEffect(() => { load(); }, [load]);
  const live = !!data?.live || !!data?.speedtestPending;
  useEffect(() => {
    const t = setInterval(load, live ? 3000 : 20000);
    return () => clearInterval(t);
  }, [live, load]);
  useEffect(() => { setSel(null); setHover(""); }, [client]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/deploy/bench", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error || `HTTP ${r.status}`);
      await load();
      return d;
    } finally { setBusy(false); }
  };

  const run = useMemo(() => {
    if (!data) return null;
    return data.runs.find((r) => r.run === sel) ?? data.runs.find((r) => r.steps.some((s) => s.step === "next-build" || s.step === "dists-build")) ?? data.runs[0] ?? null;
  }, [data, sel]);
  const medians = useMemo(() => new Map((data?.trend ?? []).map((t) => [t.step, t.median])), [data]);

  if (!data) return null;
  const cfg = data.config;
  const latest = data.linkspeed[0];
  const warnRoutes = (latest?.routes ?? []).filter((r) => { const v = upValue(r); return v != null && v < cfg.uploadWarnMBps; });

  return (
    <Wrap>
      <Head>
        <Title>Benchmarks</Title>
        <Pills>
          {data.clients.map((c) => (
            <Pill key={c} $on={c === data.client} onClick={() => setClient(c)}>{label(c)}</Pill>
          ))}
        </Pills>
      </Head>

      <Expect>
        {data.expect
          ? <>Expect <b>{fmt(data.expect.secs)}</b> for a full run{data.expect.nextBuild != null && <> · next build {fmt(data.expect.nextBuild)}</>} <Faint>(median of the last {data.expect.n} clean runs)</Faint></>
          : <Faint>No clean runs recorded yet for {label(data.client)}.</Faint>}
      </Expect>

      {data.live && (
        <LiveCard>
          <LiveDot />
          <span>Running <b>{data.live.step ?? "…"}</b> · {fmt(data.live.stepSecs)}
            {data.live.step && medians.has(data.live.step) && <Faint> of ~{fmt(medians.get(data.live.step))}</Faint>}
          </span>
          <Faint style={{ marginLeft: "auto" }}>run total {fmt(data.live.secs)}{data.expect && ` of ~${fmt(data.expect.secs)}`}</Faint>
        </LiveCard>
      )}

      <Cols>
        <Card>
          <CardHead>
            <CardTitle>Waterfall</CardTitle>
            {run && <Faint>{ago(run.at)} · {run.by ?? "manual"}{run.result ? ` · ${run.result}` : run.open ? " · running" : ""}{run.contended ? " · contended" : ""}</Faint>}
          </CardHead>
          {run ? <Waterfall steps={run.steps} total={run.secs} onHover={setHover} /> : <Faint>No runs yet.</Faint>}
          {run?.promotes.map((p) => (
            <div key={p.id}>
              <CardHead><CardTitle as="span">Promote</CardTitle><Faint>{ago(p.at)} · {p.by ?? "?"} · {p.ok === false ? "failed" : p.ok ? "ok" : "running"}</Faint></CardHead>
              <Waterfall steps={p.steps} total={p.secs} onHover={setHover} />
            </div>
          ))}
          <Readout>{hover || "Hover a bar for its numbers"}</Readout>
        </Card>

        <Card>
          <CardHead>
            <CardTitle>Link to RCS</CardTitle>
            {latest && <Faint>{latest.kind} · {ago(latest.t)}</Faint>}
            <Tooltip label={data.speedtestPending ? "Waiting for the Mac" : "Full test between builds"}>
              <Btn $c={rgb.cyan} style={{ marginLeft: "auto" }} disabled={busy || !!data.speedtestPending} onClick={() => post({ action: "speedtest" })}>
                {data.speedtestPending ? "Queued…" : "Run speed test"}
              </Btn>
            </Tooltip>
          </CardHead>
          {warnRoutes.length > 0 && (
            <Warn>⚠ Upload below {cfg.uploadWarnMBps} MB/s on {warnRoutes.map((r) => r.route).join(", ")} — a deploy will ship slowly.</Warn>
          )}
          {latest ? (
            <RouteTable>
              <thead><tr><th>Route</th><th>Up</th><th>Down</th><th>RTT</th><th>200 files</th></tr></thead>
              <tbody>
                {latest.routes.map((r) => (
                  <tr key={r.route}>
                    <td><b>{r.route}</b>{r.host && <Faint> {r.host}</Faint>}</td>
                    {r.sameAs ? <td colSpan={4}><Faint>same connection as {r.sameAs}</Faint></td>
                      : r.error ? <td colSpan={4}><Bad>{r.error}</Bad></td>
                      : <>
                        <td className={upValue(r) != null && upValue(r)! < cfg.uploadWarnMBps ? "bad" : ""}>{upText(r)}</td>
                        <td>{r.downMBps != null ? `${r.downMBps} MB/s` : "—"}</td>
                        <td>{r.rttMs != null ? `${r.rttMs} ms` : "—"}</td>
                        <td>{r.rsyncSecs != null ? fmt(r.rsyncSecs) : "—"}</td>
                      </>}
                  </tr>
                ))}
              </tbody>
            </RouteTable>
          ) : <Faint>No link tests yet — one runs before every build.</Faint>}
          <UpHistory tests={data.linkspeed} warn={cfg.uploadWarnMBps} />
        </Card>
      </Cols>

      <Card>
        <CardHead><CardTitle>Trend</CardTitle><Faint>last {cfg.trendRuns} build runs · median/p90 skip contended runs</Faint></CardHead>
        {data.trend.length ? (
          <TrendTable>
            <thead><tr><th>Step</th><th>Median</th><th>p90</th><th>Last</th><th>Runs</th><th /></tr></thead>
            <tbody>
              {data.trend.map((t) => (
                <tr key={t.step} className={t.step === "total" ? "total" : ""}>
                  <td>{t.step}</td><td>{fmt(t.median)}</td><td>{fmt(t.p90)}</td>
                  <td className={t.last > t.p90 * 1.2 && t.n > 3 ? "slow" : ""}>{fmt(t.last)}</td>
                  <td>{t.n}</td>
                  <td><Spark series={t.series} onHover={setHover} step={t.step} /></td>
                </tr>
              ))}
            </tbody>
          </TrendTable>
        ) : <Faint>No finished build runs yet.</Faint>}
        <Legend><Dot $c={colors.cyan} /> run <Dot $c={colors.gold} /> contended (dev server / Playwright / memory pressure) <Dot $c={colors.red} /> failed</Legend>
      </Card>

      <Card>
        <CardHead><CardTitle>Runs</CardTitle></CardHead>
        <RunList>
          {data.runs.slice(0, 15).map((r) => (
            <RunRow key={r.run} $on={r.run === run?.run} onClick={() => setSel(r.run)}>
              <span>{ago(r.at)}</span>
              <span className="mono">{r.run}</span>
              <span>{r.by ?? "manual"}</span>
              <span className={r.ok === false ? "bad" : ""}>{r.open ? "running" : r.result ?? "—"}</span>
              <span>{r.contended ? "contended" : ""}</span>
              <span className="num">{fmt(r.secs)}</span>
            </RunRow>
          ))}
        </RunList>
      </Card>

      <ADDM label="Thresholds" accent="cyan" contained open={openCfg} onOpenChange={(o: boolean) => { setOpenCfg(o); if (o) setDraft(cfg); }}>
        {draft && (
          <Atoms>
            <Atom>
              <AtomLabel>Upload warn</AtomLabel>
              <Faint>Warn when upload to RCS falls below this.</Faint>
              <NumBox type="number" step="0.1" min="0.05" value={draft.uploadWarnMBps} onChange={(e) => setDraft({ ...draft, uploadWarnMBps: +e.target.value })} />
              <Unit>MB/s</Unit>
            </Atom>
            <Atom>
              <AtomLabel>Contended at</AtomLabel>
              <Faint>Dev servers + Playwright RSS that marks a run contended.</Faint>
              <NumBox type="number" step="64" min="64" value={draft.contendedRssMb} onChange={(e) => setDraft({ ...draft, contendedRssMb: +e.target.value })} />
              <Unit>MB</Unit>
            </Atom>
            <Atom>
              <AtomLabel>Trend window</AtomLabel>
              <Faint>Build runs the trend reads.</Faint>
              <NumBox type="number" step="1" min="3" max="200" value={draft.trendRuns} onChange={(e) => setDraft({ ...draft, trendRuns: +e.target.value })} />
              <Unit>runs</Unit>
            </Atom>
            <Tooltip label="Save thresholds">
              <Btn $c={rgb.cyan} disabled={busy} onClick={() => post({ action: "config", config: draft })}>Save</Btn>
            </Tooltip>
          </Atoms>
        )}
      </ADDM>
      {err && <Bad>{err}</Bad>}
    </Wrap>
  );
}

/** One bar row per step, positioned on the run's own clock; failures in red with a label. */
function Waterfall({ steps, total, onHover }: { steps: Step[]; total: number | null; onHover: (s: string) => void }) {
  const span = Math.max(1, (total ?? 0) * 1000, ...steps.map((s) => s.startMs + (s.secs ?? 0) * 1000));
  return (
    <Fall onMouseLeave={() => onHover("")}>
      {steps.map((s, i) => {
        const left = (Math.max(0, s.startMs) / span) * 100;
        const w = s.secs == null ? 100 - left : Math.max(0.4, ((s.secs * 1000) / span) * 100);
        const color = s.ok === false ? colors.red : s.secs == null ? colors.gold : colors.cyan;
        return (
          <FallRow key={`${s.step}-${i}`} onMouseEnter={() => onHover(`${s.step} · ${stepDetail(s)}`)}>
            <StepName>{s.step}</StepName>
            <Track><Bar style={{ left: `${left}%`, width: `${Math.min(w, 100 - left)}%`, background: color }} $live={s.secs == null} /></Track>
            <StepVal className={s.ok === false ? "bad" : ""}>{s.ok === false ? `failed ${fmt(s.secs)}` : fmt(s.secs)}</StepVal>
          </FallRow>
        );
      })}
    </Fall>
  );
}

function Spark({ series, onHover, step }: { series: Trend["series"]; onHover: (s: string) => void; step: string }) {
  const W = 140, H = 26, P = 3;
  if (!series.length) return null;
  const max = Math.max(...series.map((x) => x.secs), 0.001);
  const x = (i: number) => (series.length === 1 ? W / 2 : P + (i / (series.length - 1)) * (W - 2 * P));
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }} onMouseLeave={() => onHover("")}>
      <polyline points={series.map((p, i) => `${x(i)},${y(p.secs)}`).join(" ")} fill="none" stroke={colors.cyan} strokeWidth={1.5} strokeLinejoin="round" opacity={0.85} />
      {series.map((p, i) => (
        <g key={p.run} onMouseEnter={() => onHover(`${step} · ${p.run} · ${fmt(p.secs)}${p.contended ? " · contended" : ""}${p.ok ? "" : " · failed"}`)}>
          <rect x={x(i) - 5} y={0} width={10} height={H} fill="transparent" />
          {(p.contended || !p.ok) && <circle cx={x(i)} cy={y(p.secs)} r={2.6} fill={p.ok ? colors.gold : colors.red} />}
        </g>
      ))}
    </svg>
  );
}

/** Upload history of the first measured route, oldest → newest, with the warn line. */
function UpHistory({ tests, warn }: { tests: LinkTest[]; warn: number }) {
  const pts = [...tests].reverse().map((t) => {
    const r = t.routes.find((x) => !x.sameAs && !x.error);
    return r ? { t: t.t, route: r.route, v: upValue(r), bound: r.upMBps == null } : null;
  }).filter((p): p is { t: string; route: string; v: number; bound: boolean } => !!p && p.v != null);
  if (pts.length < 2) return null;
  const W = 320, H = 54, P = 4;
  const max = Math.max(warn * 1.5, ...pts.map((p) => p.v));
  const x = (i: number) => P + (i / (pts.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  return (
    <div>
      <Faint>Upload history · {pts[pts.length - 1].route} · dashed = warn line</Faint>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }}>
        <line x1={0} x2={W} y1={y(warn)} y2={y(warn)} stroke={colors.red} strokeOpacity={0.5} strokeDasharray="3 3" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <polyline points={pts.map((p, i) => `${x(i)},${y(p.v)}`).join(" ")} fill="none" stroke={colors.cyan} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

const Wrap = styled.section`margin: 0 0 24px; display: flex; flex-direction: column; gap: 12px;`;
const Head = styled.div`display: flex; align-items: center; gap: 12px; flex-wrap: wrap;`;
const Title = styled.h2`margin: 0; font-size: 15px; font-weight: 700; color: #e8e8ef; letter-spacing: 0.02em;`;
const Pills = styled.div`display: flex; gap: 6px; flex-wrap: wrap;`;
const Pill = styled.button<{ $on: boolean }>`
  font-size: 11.5px; font-weight: 650; padding: 4px 11px; border-radius: 999px; cursor: pointer;
  ${(p) => (p.$on
    ? `background: rgba(${rgb.cyan},0.16); color: ${colors.cyan}; border: 1px solid rgba(${rgb.cyan},0.45);`
    : "background: transparent; color: rgba(232,232,239,0.6); border: 1px solid rgba(232,232,239,0.15);")}
`;
const Expect = styled.div`font-size: 13px; color: rgba(232,232,239,0.85); b { color: #e8e8ef; font-variant-numeric: tabular-nums; }`;
const Faint = styled.span`font-size: 11.5px; color: rgba(232,232,239,0.5);`;
const LiveCard = styled.div`
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 14px; border-radius: 10px; font-size: 12.5px;
  color: #e8e8ef; background: rgba(${rgb.gold},0.08); border: 1px solid rgba(${rgb.gold},0.3); font-variant-numeric: tabular-nums;
`;
const LiveDot = styled.span`
  width: 8px; height: 8px; border-radius: 50%; background: ${colors.gold}; box-shadow: 0 0 8px ${colors.gold};
  animation: benchPulse 1.2s ease-in-out infinite;
  @keyframes benchPulse { 50% { opacity: 0.35; } }
`;
const Cols = styled.div`display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));`;
const Card = styled.div`
  display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 12px; min-width: 0;
  background: rgba(10,12,18,0.85); border: 1px solid rgba(${rgb.cyan},0.18);
`;
const CardHead = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap;`;
const CardTitle = styled.h3`margin: 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(232,232,239,0.8);`;
const Readout = styled.div`font-size: 11.5px; color: rgba(232,232,239,0.7); min-height: 16px; font-variant-numeric: tabular-nums;`;
const Fall = styled.div`display: flex; flex-direction: column; gap: 4px;`;
const FallRow = styled.div`
  display: grid; grid-template-columns: 96px 1fr 76px; gap: 8px; align-items: center; font-size: 11.5px; cursor: default;
  &:hover { background: rgba(232,232,239,0.04); }
`;
const StepName = styled.span`color: rgba(232,232,239,0.75); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Track = styled.div`position: relative; height: 10px; border-radius: 4px; background: rgba(232,232,239,0.04);`;
const Bar = styled.div<{ $live: boolean }>`
  position: absolute; top: 0; bottom: 0; border-radius: 4px; min-width: 3px;
  ${(p) => (p.$live ? "animation: benchPulse 1.2s ease-in-out infinite;" : "")}
`;
const StepVal = styled.span`text-align: right; color: rgba(232,232,239,0.85); font-variant-numeric: tabular-nums; &.bad { color: #ff9a9a; }`;
const Warn = styled.div`
  font-size: 12px; padding: 7px 10px; border-radius: 8px; color: #ffcf8a;
  background: rgba(${rgb.orange},0.1); border: 1px solid rgba(${rgb.orange},0.35);
`;
const Bad = styled.span`font-size: 11.5px; color: #ff9a9a;`;
const table = `
  width: 100%; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums;
  th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; color: rgba(232,232,239,0.5); font-weight: 600; padding: 0 8px 6px 0; }
  td { padding: 4px 8px 4px 0; color: rgba(232,232,239,0.85); border-top: 1px solid rgba(232,232,239,0.06); vertical-align: middle; }
  td.bad, td.slow { color: #ff9a9a; }
`;
const RouteTable = styled.table`${table}`;
const TrendTable = styled.table`${table} tr.total td { font-weight: 700; color: #e8e8ef; }`;
const Legend = styled.div`display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 11px; color: rgba(232,232,239,0.5);`;
const Dot = styled.span<{ $c: string }>`width: 7px; height: 7px; border-radius: 50%; background: ${(p) => p.$c}; margin-left: 6px;`;
const RunList = styled.div`display: flex; flex-direction: column; overflow-x: auto;`;
const RunRow = styled.button<{ $on: boolean }>`
  display: grid; grid-template-columns: 70px minmax(150px, 1fr) 110px 80px 80px 70px; gap: 8px; align-items: center;
  padding: 5px 6px; border: 0; border-top: 1px solid rgba(232,232,239,0.06); text-align: left; cursor: pointer;
  font-size: 12px; color: rgba(232,232,239,0.8); font-variant-numeric: tabular-nums;
  background: ${(p) => (p.$on ? `rgba(${rgb.cyan},0.08)` : "transparent")};
  &:hover { background: rgba(${rgb.cyan},0.05); }
  .mono { font-family: ui-monospace, monospace; font-size: 11px; color: rgba(232,232,239,0.6); }
  .num { text-align: right; }
  .bad { color: #ff9a9a; }
`;
// ADDM atom styling: 19px between clusters, 8px inside one; label 88 | control flex | box 56.
const Atoms = styled.div`display: flex; flex-direction: column; gap: 19px; padding: 4px 0;`;
const Atom = styled.div`
  display: grid; grid-template-columns: 88px 1fr 56px auto; gap: 8px; align-items: center;
`;
const AtomLabel = styled.span`font-size: 11px; font-weight: 650; text-transform: uppercase; letter-spacing: 0.04em; color: rgba(232,232,239,0.75);`;
const NumBox = styled.input`
  width: 56px; padding: 4px 6px; border-radius: 6px; font-size: 12px; font-variant-numeric: tabular-nums;
  background: rgba(232,232,239,0.05); color: #e8e8ef; border: 1px solid rgba(${rgb.cyan},0.3);
`;
const Unit = styled.span`font-size: 11px; color: rgba(232,232,239,0.5);`;
const Btn = styled.button<{ $c: string }>`
  padding: 6px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 650; cursor: pointer; align-self: flex-start;
  background: rgba(${(p) => p.$c},0.14); color: rgb(${(p) => p.$c}); border: 1px solid rgba(${(p) => p.$c},0.4);
  &:disabled { opacity: 0.35; cursor: default; }
`;

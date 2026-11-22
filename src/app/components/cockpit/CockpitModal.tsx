"use client";
// Cockpit — one full-screen modal for everything happening on the box (Gio 2026-11-22: "fold them
// into one Cockpit and make it so that everything is visual and tweakable and a full modal").
//
//   Annunciator strip  warning lights from every surface; click one → the panel that explains it
//   Flight deck        live gauges (CPU, RAM, swap, disk, load), the per-thread CPU strip, temps,
//                      network and disk I/O, a fuel tape per pm2 app, live trend strips
//   Folded panels      Box health & capacity · Dev server pool · Pipeline · Workshop DB · Rollbacks ·
//                      Maintenance — the existing hardening surfaces, rendered embedded (<HCMEmbed>),
//                      so each keeps its own controls, thresholds and audit log.
//
// Tweakable here: refresh rate, trend window, gauge amber/red lines (Box Usage thresholds), which
// instrument groups show, tape sort. Viewer preferences live in localStorage; thresholds are saved.
// Data: GET /api/admin/cockpit/live (src/lib/cockpit/live.ts). Plan: ~/.claude/checklist/rcs2-cockpit.md.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import PillBar from "@tgv/module-component-library/components/ui/PillBar";
import { colors, rgb } from "@/app/theme";
import NeonX from "../NeonX";
import Tooltip from "@/app/components/ui/Tooltip";
import { HCMEmbed } from "../hardening/HardeningControlModal";
import type { CockpitPanel, LiveFrame } from "@/lib/cockpit/live";
import { Annunciator, CoreStrip, Gauge, StripChart, TapeMeter } from "./instruments";

const BoxUsage = dynamic(() => import("../hardening/box-usage/BoxUsageControlModal"), { ssr: false });
const RcsGov = dynamic(() => import("../hardening/rcs-gov/RcsGovControlModal"), { ssr: false });
const Pipeline = dynamic(() => import("../hardening/pipeline/PipelineControlModal"), { ssr: false });
const WorkshopDb = dynamic(() => import("../hardening/workshop-db/WorkshopDbControlModal"), { ssr: false });
const Rollbacks = dynamic(() => import("../hardening/migration-snapshots/MigrationSnapshotsControlModal"), { ssr: false });
const Maintenance = dynamic(() => import("../hardening/rcs-maintenance/RcsMaintenanceControlModal"), { ssr: false });

export const COCKPIT_PANELS: Array<{ key: CockpitPanel; label: string }> = [
  { key: "deck", label: "Flight deck" },
  { key: "box-usage", label: "Capacity & health" },
  { key: "rcs-gov", label: "Dev server pool" },
  { key: "pipeline", label: "Pipeline" },
  { key: "workshop-db", label: "Workshop DB" },
  { key: "migration-snapshots", label: "Rollbacks" },
  { key: "rcs-maintenance", label: "Maintenance" },
];

type Groups = { gauges: boolean; engine: boolean; tapes: boolean; trends: boolean };
type Prefs = { refreshMs: number; trendMin: number; groups: Groups; tapeSort: "memory" | "cpu" | "name" };
const PREFS_KEY = "tgv.cockpit.prefs";
const DEFAULT_PREFS: Prefs = { refreshMs: 2000, trendMin: 5, groups: { gauges: true, engine: true, tapes: true, trends: true }, tapeSort: "memory" };
const REFRESH_OPTS = [1000, 2000, 5000, 10000];
const TREND_OPTS = [1, 5, 15];

function loadPrefs(): Prefs {
  try {
    const j = JSON.parse(window.localStorage.getItem(PREFS_KEY) || "{}") as Partial<Prefs>;
    return { ...DEFAULT_PREFS, ...j, groups: { ...DEFAULT_PREFS.groups, ...(j.groups ?? {}) } };
  } catch {
    return DEFAULT_PREFS;
  }
}

type Hist = { at: number; cpu: number; ram: number; swap: number; rx: number; tx: number; rd: number; wr: number; load: number }[];

const fmtUp = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

export default function CockpitModal({ onClose, initialPanel = "deck" }: { onClose: () => void; initialPanel?: CockpitPanel }) {
  useEscapeToClose({ open: true, onClose });
  const [panel, setPanel] = useState<CockpitPanel>(initialPanel);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [frame, setFrame] = useState<LiveFrame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [showTweaks, setShowTweaks] = useState(false);
  const hist = useRef<Hist>([]);
  const peaks = useRef<Record<string, number>>({});
  const [, tick] = useState(0);

  useEffect(() => { setPrefs(loadPrefs()); }, []);
  const savePrefs = (p: Prefs) => {
    setPrefs(p);
    try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* private mode */ }
  };

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/cockpit/live", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      const f = j as LiveFrame;
      setFrame(f);
      setError(null);
      hist.current.push({
        at: f.at, cpu: f.cpuPct, ram: f.ram.pct, swap: f.swap.pct, rx: f.net.rxMbps, tx: f.net.txMbps,
        rd: f.io.readMBs, wr: f.io.writeMBs, load: f.load[0],
      });
      for (const [k, v] of [["cpu", f.cpuPct], ["ram", f.ram.pct], ["swap", f.swap.pct], ["disk", f.disk.pct], ["load", f.load[0]]] as const) {
        peaks.current[k] = Math.max(peaks.current[k] ?? 0, v);
      }
      tick((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (paused) return;
    void poll();
    const t = setInterval(() => void poll(), prefs.refreshMs);
    return () => clearInterval(t);
  }, [poll, prefs.refreshMs, paused]);

  // Keep only the trend window.
  const window_ = useMemo(() => {
    const cutoff = Date.now() - prefs.trendMin * 60_000;
    hist.current = hist.current.filter((h) => h.at >= cutoff);
    return hist.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, prefs.trendMin]);

  const saveThresholds = async (warnPct: number, criticalPct: number) => {
    try {
      const r = await fetch("/api/admin/host-metrics/config", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ warnPct, criticalPct }) });
      if (!r.ok) throw new Error((await r.json()).error || r.statusText);
      void poll();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const lights = frame?.lights ?? [];
  const worst = lights.some((l) => l.level === "critical") ? "critical" : lights.some((l) => l.level === "warn") ? "warn" : "ok";
  const panelLevel = (p: CockpitPanel) => {
    const ls = lights.filter((l) => l.panel === p);
    return ls.some((l) => l.level === "critical") ? 2 : ls.some((l) => l.level === "warn") ? 1 : 0;
  };
  const t = frame?.thresholds ?? { warnPct: 75, criticalPct: 90 };
  const cores = frame?.cores.length ?? 16;
  const apps = useMemo(() => {
    const a = [...(frame?.apps ?? [])];
    if (prefs.tapeSort === "cpu") a.sort((x, y) => y.cpu - x.cpu);
    else if (prefs.tapeSort === "name") a.sort((x, y) => x.name.localeCompare(y.name));
    return a;
  }, [frame, prefs.tapeSort]);
  const tapeScale = Math.max(512, ...apps.map((a) => a.memMb));

  return (
    <Overlay role="dialog" aria-label="Cockpit" data-tgv-modal="1">
      <Head>
        <TitleBlock>
          <Title>Cockpit</Title>
          <Sub>
            {frame ? `${frame.host} · up ${fmtUp(frame.uptimeSec)} · ${cores} threads · ${(frame.ram.totalMb / 1024).toFixed(0)} GB` : "connecting…"}
            {error ? ` · ${error}` : ""}
          </Sub>
        </TitleBlock>
        <Master $level={worst}>{worst === "ok" ? "ALL SYSTEMS NORMAL" : worst === "warn" ? "CAUTION" : "WARNING"}</Master>
        <Spacer />
        <Tooltip label={paused ? "Resume live" : "Pause live"}>
          <HeadBtn type="button" $on={paused} onClick={() => setPaused((p) => !p)}>{paused ? "▶ Live" : "❚❚ Pause"}</HeadBtn>
        </Tooltip>
        <Tooltip label="Tune the cockpit">
          <HeadBtn type="button" $on={showTweaks} onClick={() => setShowTweaks((s) => !s)}>⚙ Tune</HeadBtn>
        </Tooltip>
        <NeonX accent="cyan" onClick={onClose} />
      </Head>

      {showTweaks && (
        <Tweaks>
          <TweakGroup>
            <TweakLabel>Refresh</TweakLabel>
            {REFRESH_OPTS.map((ms) => (
              <Chip key={ms} type="button" $on={prefs.refreshMs === ms} onClick={() => savePrefs({ ...prefs, refreshMs: ms })}>{ms / 1000}s</Chip>
            ))}
          </TweakGroup>
          <TweakGroup>
            <TweakLabel>Trend window</TweakLabel>
            {TREND_OPTS.map((m) => (
              <Chip key={m} type="button" $on={prefs.trendMin === m} onClick={() => savePrefs({ ...prefs, trendMin: m })}>{m} min</Chip>
            ))}
          </TweakGroup>
          <TweakGroup>
            <TweakLabel>Show</TweakLabel>
            {(Object.keys(prefs.groups) as (keyof Groups)[]).map((g) => (
              <Chip key={g} type="button" $on={prefs.groups[g]} onClick={() => savePrefs({ ...prefs, groups: { ...prefs.groups, [g]: !prefs.groups[g] } })}>{g}</Chip>
            ))}
          </TweakGroup>
          <TweakGroup>
            <TweakLabel>Tapes by</TweakLabel>
            {(["memory", "cpu", "name"] as const).map((s) => (
              <Chip key={s} type="button" $on={prefs.tapeSort === s} onClick={() => savePrefs({ ...prefs, tapeSort: s })}>{s}</Chip>
            ))}
          </TweakGroup>
          <ThresholdTweak warn={t.warnPct} crit={t.criticalPct} onSave={saveThresholds} />
        </Tweaks>
      )}

      <Lights>
        {lights.map((l) => (
          <Annunciator key={l.id} label={l.label} level={l.level} detail={l.detail} onClick={() => setPanel(l.panel)} />
        ))}
        {!frame && !error && <Faint>reading the box…</Faint>}
      </Lights>

      <Tabs>
        <PillBar
          segments={COCKPIT_PANELS.map((p) => ({ key: p.key, label: `${p.label}${panelLevel(p.key) === 2 ? " ●" : panelLevel(p.key) === 1 ? " ○" : ""}` }))}
          active={panel}
          onChange={(k) => setPanel(k as CockpitPanel)}
          ariaLabel="Cockpit panels"
          accent={colors.cyan}
        />
      </Tabs>

      <Body>
        {panel === "deck" && frame && (
          <Deck>
            {prefs.groups.gauges && (
              <Card $wide>
                <CardTitle>Primary gauges</CardTitle>
                <Gauges>
                  <Gauge label="CPU" value={frame.cpuPct} warn={t.warnPct} crit={t.criticalPct} peak={peaks.current.cpu} sub={`load ${frame.load.map((l) => l.toFixed(1)).join(" · ")}`} />
                  <Gauge label="RAM" value={frame.ram.pct} warn={t.warnPct} crit={t.criticalPct} peak={peaks.current.ram} sub={`${(frame.ram.usedMb / 1024).toFixed(1)} / ${(frame.ram.totalMb / 1024).toFixed(0)} GB`} />
                  <Gauge label="Swap" value={frame.swap.pct} warn={t.warnPct} crit={t.criticalPct} peak={peaks.current.swap} sub={`${(frame.swap.usedMb / 1024).toFixed(1)} / ${(frame.swap.totalMb / 1024).toFixed(0)} GB`} />
                  <Gauge label="Disk /" value={frame.disk.pct} warn={t.warnPct} crit={t.criticalPct} peak={peaks.current.disk} sub={`${frame.disk.usedGb.toFixed(0)} / ${frame.disk.totalGb.toFixed(0)} GB`} />
                  <Gauge label="Load" value={frame.load[0]} max={cores * 1.5} unit="" warn={cores * 0.75} crit={cores} peak={peaks.current.load} sub={`per-core ${(frame.load[0] / cores).toFixed(2)}`} />
                  {frame.slice && (
                    <Gauge
                      label="Workshop"
                      value={frame.slice.usedMb / 1024}
                      max={(frame.slice.maxMb ?? 40960) / 1024}
                      unit="G"
                      warn={frame.slice.triggerMb / 1024}
                      crit={(frame.slice.highMb ?? frame.slice.maxMb ?? 40960) / 1024}
                      sub={`pool governor ${frame.slice.enabled ? "on" : "off"}`}
                    />
                  )}
                </Gauges>
              </Card>
            )}
            {prefs.groups.engine && (
              <Card $wide>
                <CardTitle>Engine</CardTitle>
                <EngineRow>
                  <div style={{ flex: "1 1 22rem", minWidth: 0 }}>
                    <CoreStrip cores={frame.cores} warn={t.warnPct} crit={t.criticalPct} />
                  </div>
                  <Readouts>
                    <Readout><RLabel>CPU temp</RLabel><RVal $hot={(frame.temps.cpuC ?? 0) >= 80}>{frame.temps.cpuC ?? "—"} °C</RVal></Readout>
                    {frame.temps.disks.map((d, i) => (
                      <Readout key={d.name}><RLabel>NVMe {i}</RLabel><RVal $hot={d.c >= 70}>{d.c} °C</RVal></Readout>
                    ))}
                    <Readout><RLabel>Net in</RLabel><RVal>{frame.net.rxMbps.toFixed(1)} Mb/s</RVal></Readout>
                    <Readout><RLabel>Net out</RLabel><RVal>{frame.net.txMbps.toFixed(1)} Mb/s</RVal></Readout>
                    <Readout><RLabel>Disk read</RLabel><RVal>{frame.io.readMBs.toFixed(1)} MB/s</RVal></Readout>
                    <Readout><RLabel>Disk write</RLabel><RVal>{frame.io.writeMBs.toFixed(1)} MB/s</RVal></Readout>
                    {frame.psiMemSome !== null && <Readout><RLabel>Mem pressure</RLabel><RVal $hot={frame.psiMemSome >= 5}>{frame.psiMemSome.toFixed(1)}%</RVal></Readout>}
                  </Readouts>
                </EngineRow>
              </Card>
            )}
            {prefs.groups.tapes && (
              <Card $wide>
                <CardTitle>Fuel tapes — pm2 apps ({apps.length}) · scale {(tapeScale / 1024).toFixed(1)} GB</CardTitle>
                <TapesRow>
                  {apps.map((a) => (
                    <TapeMeter key={a.name} name={a.name} valueMb={a.memMb} scaleMb={tapeScale} status={a.status} restarts={a.restarts} cpu={a.cpu} />
                  ))}
                  {apps.length === 0 && <Faint>pm2 not visible from this process.</Faint>}
                </TapesRow>
              </Card>
            )}
            {prefs.groups.trends && (
              <Card $wide>
                <CardTitle>Trends — last {prefs.trendMin} min (long history: Capacity &amp; health → History)</CardTitle>
                <TrendGrid>
                  <StripChart label="CPU" series={[{ name: "cpu", values: window_.map((h) => h.cpu) }]} max={100} unit="%" warn={t.warnPct} />
                  <StripChart label="Memory" series={[{ name: "ram", values: window_.map((h) => h.ram), accent: "violet" }, { name: "swap", values: window_.map((h) => h.swap), accent: "pink" }]} max={100} unit="%" warn={t.warnPct} />
                  <StripChart label="Network" series={[{ name: "in", values: window_.map((h) => h.rx), accent: "green" }, { name: "out", values: window_.map((h) => h.tx), accent: "cyan" }]} unit=" Mb/s" />
                  <StripChart label="Disk I/O" series={[{ name: "read", values: window_.map((h) => h.rd), accent: "gold" }, { name: "write", values: window_.map((h) => h.wr), accent: "pink" }]} unit=" MB/s" />
                </TrendGrid>
              </Card>
            )}
          </Deck>
        )}
        {panel === "deck" && !frame && <Faint>{error ? `Could not read the box: ${error}` : "Reading the box…"}</Faint>}
        <HCMEmbed>
          <PanelPane>
            {panel === "box-usage" && <BoxUsage onClose={() => setPanel("deck")} />}
            {panel === "rcs-gov" && <RcsGov onClose={() => setPanel("deck")} />}
            {panel === "pipeline" && <Pipeline onClose={() => setPanel("deck")} />}
            {panel === "workshop-db" && <WorkshopDb onClose={() => setPanel("deck")} />}
            {panel === "migration-snapshots" && <Rollbacks onClose={() => setPanel("deck")} />}
            {panel === "rcs-maintenance" && <Maintenance onClose={() => setPanel("deck")} />}
          </PanelPane>
        </HCMEmbed>
      </Body>
    </Overlay>
  );
}

/** Amber/red lines for every % gauge — the same thresholds Box Usage alerts on. */
function ThresholdTweak({ warn, crit, onSave }: { warn: number; crit: number; onSave: (w: number, c: number) => void }) {
  const [w, setW] = useState(String(warn));
  const [c, setC] = useState(String(crit));
  const [seen, setSeen] = useState(`${warn}/${crit}`);
  if (seen !== `${warn}/${crit}`) { setSeen(`${warn}/${crit}`); setW(String(warn)); setC(String(crit)); }
  const dirty = w !== String(warn) || c !== String(crit);
  return (
    <TweakGroup>
      <TweakLabel>Gauge lines</TweakLabel>
      <Faint>amber</Faint>
      <Num type="number" min={1} max={99} value={w} onChange={(e) => setW(e.target.value)} aria-label="Amber line %" />
      <Faint>red</Faint>
      <Num type="number" min={1} max={100} value={c} onChange={(e) => setC(e.target.value)} aria-label="Red line %" />
      <Tooltip label="Save gauge lines">
        <Chip type="button" $on={dirty} disabled={!dirty} onClick={() => onSave(Number(w), Number(c))}>Save</Chip>
      </Tooltip>
      <Faint>also Box Usage alert lines</Faint>
    </TweakGroup>
  );
}

const LEVEL_C = { ok: colors.green, warn: colors.gold, critical: colors.red } as const;
const LEVEL_R = { ok: rgb.green, warn: rgb.gold, critical: rgb.red } as const;

const Overlay = styled.div`
  position: fixed; inset: 0; z-index: 70;
  display: flex; flex-direction: column;
  background: var(--t-cardGrad);
  background-color: var(--t-overlay);
  backdrop-filter: blur(8px);
  color: var(--t-text);
`;
const Head = styled.header`
  display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
  padding: 0.75rem 1.25rem; border-bottom: 1px solid rgba(${rgb.cyan}, 0.25);
`;
const TitleBlock = styled.div`display: flex; flex-direction: column;`;
const Title = styled.h2`margin: 0; font-size: 1.25rem; font-weight: 800; letter-spacing: 0.06em; color: ${colors.cyan};`;
const Sub = styled.div`font-size: 0.72rem; color: var(--t-textFaint);`;
const Master = styled.div<{ $level: "ok" | "warn" | "critical" }>`
  font-size: 0.68rem; font-weight: 800; letter-spacing: 0.16em; padding: 0.3rem 0.7rem; border-radius: 0.35rem;
  color: ${(p) => LEVEL_C[p.$level]};
  border: 1px solid rgba(${(p) => LEVEL_R[p.$level]}, 0.6);
  background: rgba(${(p) => LEVEL_R[p.$level]}, 0.1);
  box-shadow: 0 0 14px rgba(${(p) => LEVEL_R[p.$level]}, 0.3);
`;
const Spacer = styled.div`flex: 1;`;
const HeadBtn = styled.button<{ $on: boolean }>`
  font-size: 0.75rem; font-weight: 700; padding: 0.35rem 0.75rem; border-radius: 0.4rem; cursor: pointer;
  color: ${(p) => (p.$on ? colors.cyan : "var(--t-textMuted)")};
  background: ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.12)` : "transparent")};
  border: 1px solid ${(p) => (p.$on ? colors.cyan : "var(--t-border)")};
`;
const Tweaks = styled.div`
  display: flex; flex-wrap: wrap; gap: 0.75rem 1.5rem; padding: 0.6rem 1.25rem;
  border-bottom: 1px solid var(--t-border); background: rgba(${rgb.cyan}, 0.04);
`;
const TweakGroup = styled.div`display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;`;
const TweakLabel = styled.span`font-size: 0.62rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--t-textMuted); margin-right: 0.2rem;`;
const Chip = styled.button<{ $on: boolean }>`
  font-size: 0.7rem; padding: 0.2rem 0.55rem; border-radius: 999px; cursor: pointer; text-transform: capitalize;
  color: ${(p) => (p.$on ? colors.cyan : "var(--t-textFaint)")};
  background: ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.12)` : "transparent")};
  border: 1px solid ${(p) => (p.$on ? colors.cyan : "var(--t-border)")};
  &:disabled { opacity: 0.5; cursor: default; }
`;
const Num = styled.input`
  width: 3.6rem; padding: 0.2rem 0.35rem; border-radius: 0.35rem; font-size: 0.72rem;
  background: var(--t-inputBg, transparent); color: var(--t-text); border: 1px solid var(--t-border); color-scheme: dark;
`;
const Lights = styled.div`display: flex; flex-wrap: wrap; gap: 0.4rem; padding: 0.6rem 1.25rem;`;
const Tabs = styled.div`padding: 0 1.25rem 0.5rem; overflow-x: auto;`;
const Body = styled.div`flex: 1; overflow-y: auto; padding: 0.5rem 1.25rem 2rem;`;
const PanelPane = styled.div`max-width: 64rem; margin: 0 auto;`;
const Deck = styled.div`display: grid; gap: 0.9rem; grid-template-columns: 1fr;`;
const Card = styled.section<{ $wide?: boolean }>`
  padding: 0.75rem 0.9rem; border-radius: 0.75rem;
  border: 1px solid rgba(${rgb.cyan}, 0.2); background: rgba(${rgb.cyan}, 0.03);
`;
const CardTitle = styled.h3`margin: 0 0 0.6rem; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: ${colors.cyan};`;
const Gauges = styled.div`display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem; justify-content: space-around;`;
const EngineRow = styled.div`display: flex; flex-wrap: wrap; gap: 1rem; align-items: stretch;`;
const Readouts = styled.div`display: grid; grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr)); gap: 0.4rem 0.8rem; flex: 1 1 20rem;`;
const Readout = styled.div`display: flex; flex-direction: column; gap: 1px;`;
const RLabel = styled.span`font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--t-textFaint);`;
const RVal = styled.span<{ $hot?: boolean }>`font-size: 0.95rem; font-weight: 700; font-variant-numeric: tabular-nums; color: ${(p) => (p.$hot ? colors.gold : "var(--t-text)")};`;
const TapesRow = styled.div`display: flex; flex-wrap: wrap; gap: 0.6rem 0.3rem;`;
const TrendGrid = styled.div`display: grid; gap: 0.9rem 1.5rem; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));`;
const Faint = styled.span`font-size: 0.72rem; color: var(--t-textFaint);`;

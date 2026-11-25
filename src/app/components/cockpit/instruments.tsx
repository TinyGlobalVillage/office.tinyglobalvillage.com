"use client";
// Cockpit instruments (Gio 2026-11-20: "a live, cockpit-style read-out … like an airliner's
// instruments"). Pure SVG + styled-components, no chart library — same stance as the analytics
// charts. Every colour comes from the theme; amber/red bands come from the viewer's thresholds.
//
//   Gauge       dial with amber/red arcs, a needle, a peak tick, pink cap lines and a share arc
//   CoreStrip   one bar per CPU thread
//   TapeMeter   vertical "fuel" tape (pm2 app memory) with a restart counter
//   StripChart  live trend line over the last N frames
//   Annunciator a warning light; clicking it jumps to the panel that explains it
import styled, { keyframes } from "styled-components";
import { colors, rgb } from "@/app/theme";
import Tooltip from "@/app/components/ui/Tooltip";

export type Level = "ok" | "warn" | "critical" | "off";
const LEVEL_COLOR: Record<Level, string> = { ok: colors.green, warn: colors.gold, critical: colors.red, off: "var(--t-textGhost)" };
const LEVEL_RGB: Record<Level, string> = { ok: rgb.green, warn: rgb.gold, critical: rgb.red, off: rgb.cyan };

export const levelFor = (v: number, warn: number, crit: number): Level => (v >= crit ? "critical" : v >= warn ? "warn" : "ok");

/* ── Gauge ───────────────────────────────────────────────────────── */

const SWEEP = 240; // degrees, from -120 to +120
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const arc = (cx: number, cy: number, r: number, from: number, to: number) => {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
};
const degOf = (v: number, max: number) => -SWEEP / 2 + (Math.max(0, Math.min(max, v)) / max) * SWEEP;

/** A hard limit on the dial (a cgroup cap, the governor trigger, …), drawn as a pink line across the arc. */
export type GaugeMark = { value: number; label: string };

export function Gauge({ label, value, max = 100, unit = "%", warn, crit, peak, sub, size = 150, marks, share }: {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  warn: number;
  crit: number;
  peak?: number | null;
  sub?: string;
  size?: number;
  /** Caps, in the dial's own units. Pink, so the needle can be seen never crossing them. */
  marks?: GaugeMark[];
  /** Part of `value` that belongs to one consumer (the workshop), drawn as an inner cyan arc. Labels go in `sub`. */
  share?: { value: number; label: string } | null;
}) {
  const c = 60, r = 48;
  const level = levelFor(value, warn, crit);
  const needle = degOf(value, max);
  const [nx, ny] = polar(c, c, r - 8, needle);
  return (
    <GaugeBox style={{ width: size }}>
      <svg viewBox="0 0 120 104" width={size} height={size * 0.87} role="img" aria-label={`${label} ${value.toFixed(0)}${unit}`}>
        <path d={arc(c, c, r, -SWEEP / 2, SWEEP / 2)} stroke="var(--t-border)" strokeWidth={7} fill="none" strokeLinecap="round" />
        <path d={arc(c, c, r, degOf(warn, max), degOf(crit, max))} stroke={colors.gold} strokeOpacity={0.55} strokeWidth={7} fill="none" />
        <path d={arc(c, c, r, degOf(crit, max), SWEEP / 2)} stroke={colors.red} strokeOpacity={0.6} strokeWidth={7} fill="none" strokeLinecap="round" />
        <path d={arc(c, c, r, -SWEEP / 2, Math.max(-SWEEP / 2 + 0.5, needle))} stroke={LEVEL_COLOR[level]} strokeWidth={3} fill="none" strokeLinecap="round" />
        {share && share.value > 0 && (
          <path d={arc(c, c, r - 9, -SWEEP / 2, Math.max(-SWEEP / 2 + 0.5, degOf(share.value, max)))} stroke={colors.cyan} strokeOpacity={0.8} strokeWidth={3} fill="none" strokeLinecap="round" />
        )}
        {peak != null && (() => {
          const [px1, py1] = polar(c, c, r - 4, degOf(peak, max));
          const [px2, py2] = polar(c, c, r + 4, degOf(peak, max));
          return <line x1={px1} y1={py1} x2={px2} y2={py2} stroke="var(--t-textMuted)" strokeWidth={1.5} />;
        })()}
        {(marks ?? []).filter((m) => m.value > 0 && m.value <= max).map((m) => {
          const [mx1, my1] = polar(c, c, r - 12, degOf(m.value, max));
          const [mx2, my2] = polar(c, c, r + 8, degOf(m.value, max));
          return (
            <line key={m.label} x1={mx1} y1={my1} x2={mx2} y2={my2} stroke={colors.pink} strokeWidth={2.5} strokeLinecap="round" />
          );
        })}
        <line x1={c} y1={c} x2={nx} y2={ny} stroke={LEVEL_COLOR[level]} strokeWidth={2.5} strokeLinecap="round" style={{ transition: "all 0.6s ease" }} />
        <circle cx={c} cy={c} r={4} fill={LEVEL_COLOR[level]} />
        <text x={c} y={c + 26} textAnchor="middle" fontSize={15} fontWeight={700} fill="var(--t-text)">{value.toFixed(value < 10 && max <= 32 ? 1 : 0)}{unit}</text>
      </svg>
      <GaugeLabel>{label}</GaugeLabel>
      {sub && <GaugeSub>{sub}</GaugeSub>}
    </GaugeBox>
  );
}
const GaugeBox = styled.div`display: flex; flex-direction: column; align-items: center; gap: 0.1rem;`;
const GaugeLabel = styled.div`font-size: 0.65rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--t-textMuted);`;
const GaugeSub = styled.div`font-size: 0.65rem; color: var(--t-textFaint); text-align: center;`;

/* ── CoreStrip ───────────────────────────────────────────────────── */

export function CoreStrip({ cores, warn, crit }: { cores: number[]; warn: number; crit: number }) {
  return (
    <Cores role="img" aria-label={`CPU threads ${cores.map((c) => c.toFixed(0)).join(", ")}%`}>
      {cores.map((v, i) => (
        <Tooltip key={i} label={`Thread ${i}: ${v.toFixed(0)}%`}>
          <CoreCol>
            <CoreBar><CoreFill style={{ height: `${Math.max(2, v)}%`, background: LEVEL_COLOR[levelFor(v, warn, crit)] }} /></CoreBar>
            <CoreNum>{i}</CoreNum>
          </CoreCol>
        </Tooltip>
      ))}
    </Cores>
  );
}
const Cores = styled.div`display: flex; gap: 3px; align-items: flex-end; height: 5.5rem;`;
const CoreCol = styled.div`display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 1 1 0; min-width: 0.6rem; height: 100%;`;
const CoreBar = styled.div`flex: 1; width: 100%; display: flex; align-items: flex-end; border-radius: 3px; background: var(--t-border); overflow: hidden;`;
const CoreFill = styled.div`width: 100%; transition: height 0.5s ease, background 0.5s ease;`;
const CoreNum = styled.div`font-size: 0.55rem; color: var(--t-textGhost); font-variant-numeric: tabular-nums;`;

/* ── TapeMeter ───────────────────────────────────────────────────── */

/** One app's memory on the deck's shared scale (scaleMb — the biggest cap any app carries, in real MB), so tapes
 *  compare honestly. Pink line = pm2's restart cap (the app is recycled past it); faint pink = V8's heap ceiling.
 *  Colour is judged against the app's own cap; an app with no cap only warms past uncappedWarnMb. A scheduled job
 *  that is stopped between runs is "off", not a fault. */
export function TapeMeter({ name, valueMb, scaleMb, status, restarts, cpu, capMb, heapMb, cron, uncappedWarnMb = 2048 }: {
  name: string; valueMb: number; scaleMb: number; status: string; restarts: number; cpu: number;
  capMb?: number | null; heapMb?: number | null; cron?: boolean; uncappedWarnMb?: number;
}) {
  const pos = (mb: number) => (scaleMb > 0 ? Math.min(100, (mb / scaleMb) * 100) : 0);
  const pct = pos(valueMb);
  const ofCap = capMb ? (valueMb / capMb) * 100 : null;
  const resting = status === "stopped" && cron;
  const level: Level = status === "online"
    ? ofCap !== null ? (ofCap >= 90 ? "critical" : ofCap >= 70 ? "warn" : "ok") : valueMb >= uncappedWarnMb ? "warn" : "ok"
    : status === "stopped" ? "off" : "critical";
  const fmt = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)}G` : `${mb}M`);
  const short = name.replace(/\.tinyglobalvillage\.com$/, "").replace(/\.com$/, "");
  return (
    <Tooltip label={(resting ? `${short.slice(0, 18)} cron` : capMb ? `${short.slice(0, 13)} cap ${fmt(capMb)}` : `${short.slice(0, 16)} no cap`).slice(0, 25)}>
      <Tape>
        <TapeVal>{fmt(valueMb)}</TapeVal>
        <TapeTrack>
          <TapeFill style={{ height: `${pct > 0 ? Math.max(2, pct) : 0}%`, background: LEVEL_COLOR[level] }} />
          {heapMb && heapMb !== capMb && <TapeMark $faint style={{ bottom: `${pos(heapMb)}%` }} />}
          {capMb && <TapeMark style={{ bottom: `${pos(capMb)}%` }} />}
        </TapeTrack>
        <TapeName>{short}</TapeName>
        <TapeMeta $hot={restarts > 0 && status !== "online" && !resting}>{resting ? "cron · idle" : `${cpu.toFixed(0)}% · ↻${restarts > 999 ? `${Math.round(restarts / 1000)}k` : restarts}`}</TapeMeta>
      </Tape>
    </Tooltip>
  );
}
const TapeMark = styled.div<{ $faint?: boolean }>`position: absolute; left: -3px; right: -3px; height: 2px; background: ${colors.pink}; opacity: ${(p) => (p.$faint ? 0.45 : 1)}; transform: translateY(1px);`;
const Tape = styled.div`display: flex; flex-direction: column; align-items: center; gap: 3px; width: 4.2rem;`;
const TapeVal = styled.div`font-size: 0.68rem; font-weight: 700; color: var(--t-text); font-variant-numeric: tabular-nums;`;
const TapeTrack = styled.div`position: relative; height: 6.5rem; width: 1.1rem; border-radius: 4px; background: var(--t-border); display: flex; align-items: flex-end;`;
const TapeFill = styled.div`width: 100%; border-radius: 4px; transition: height 0.6s ease;`;
const TapeName = styled.div`font-size: 0.6rem; color: var(--t-textMuted); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center;`;
const TapeMeta = styled.div<{ $hot: boolean }>`font-size: 0.55rem; color: ${(p) => (p.$hot ? colors.red : "var(--t-textGhost)")}; font-variant-numeric: tabular-nums;`;

/* ── StripChart ──────────────────────────────────────────────────── */

export function StripChart({ label, series, max, unit, accent = "cyan", warn, height = 70 }: {
  label: string;
  series: Array<{ name: string; values: number[]; accent?: keyof typeof colors }>;
  max?: number;
  unit: string;
  accent?: keyof typeof colors;
  warn?: number;
  height?: number;
}) {
  const W = 300;
  const all = series.flatMap((s) => s.values);
  const top = max ?? Math.max(1, ...all) * 1.15;
  const pts = (vs: number[]) => {
    const n = Math.max(2, vs.length);
    return vs.map((v, i) => `${(i / (n - 1)) * W},${height - (Math.min(top, v) / top) * (height - 4) - 2}`).join(" ");
  };
  const last = series.map((s) => `${s.name} ${(s.values[s.values.length - 1] ?? 0).toFixed(s.values.some((v) => v < 10) ? 1 : 0)}${unit}`).join(" · ");
  return (
    <Strip>
      <StripHead><span>{label}</span><span>{last}</span></StripHead>
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" width="100%" height={height} role="img" aria-label={`${label}: ${last}`}>
        {warn != null && warn < top && (
          <line x1={0} x2={W} y1={height - (warn / top) * (height - 4) - 2} y2={height - (warn / top) * (height - 4) - 2} stroke={colors.gold} strokeOpacity={0.5} strokeDasharray="4 4" />
        )}
        {series.map((s) => (
          <polyline key={s.name} points={pts(s.values)} fill="none" stroke={colors[s.accent ?? accent]} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    </Strip>
  );
}
const Strip = styled.div`display: flex; flex-direction: column; gap: 0.2rem; min-width: 0;`;
const StripHead = styled.div`display: flex; justify-content: space-between; gap: 0.5rem; font-size: 0.62rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--t-textMuted); span:last-child { text-transform: none; letter-spacing: 0; color: var(--t-textFaint); font-variant-numeric: tabular-nums; }`;

/* ── Annunciator ─────────────────────────────────────────────────── */

const blink = keyframes`50% { opacity: 0.45; }`;
export function Annunciator({ label, level, detail, onClick }: { label: string; level: Level; detail: string; onClick?: () => void }) {
  return (
    <Tooltip label={label}>
      <Light type="button" $level={level} onClick={onClick} aria-label={`${label}: ${detail}`}>
        <span>{label}</span>
        <LightDetail>{detail}</LightDetail>
      </Light>
    </Tooltip>
  );
}
const Light = styled.button<{ $level: Level }>`
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left;
  min-width: 7.5rem; max-width: 14rem; padding: 0.35rem 0.55rem; border-radius: 0.4rem; cursor: pointer;
  font-size: 0.62rem; font-weight: 800; letter-spacing: 0.12em;
  color: ${(p) => LEVEL_COLOR[p.$level]};
  background: rgba(${(p) => LEVEL_RGB[p.$level]}, ${(p) => (p.$level === "ok" ? 0.06 : 0.14)});
  border: 1px solid rgba(${(p) => LEVEL_RGB[p.$level]}, ${(p) => (p.$level === "ok" ? 0.3 : 0.7)});
  box-shadow: ${(p) => (p.$level === "ok" || p.$level === "off" ? "none" : `0 0 12px rgba(${LEVEL_RGB[p.$level]}, 0.35)`)};
  animation: ${(p) => (p.$level === "critical" ? blink : "none")} 1.2s step-end infinite;
`;
const LightDetail = styled.span`
  font-size: 0.6rem; font-weight: 500; letter-spacing: 0; color: var(--t-textFaint);
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
`;

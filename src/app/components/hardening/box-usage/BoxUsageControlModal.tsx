"use client";

// BoxUsageControlModal — the Box Usage Monitor's HCM.
//
// Answers one question the whole way down: HOW FULL IS THE BOX, and which
// resource gets there first? The headline is the worst-of the four resources
// averaged over 24h (see compute.ts for why worst-of and why an average), with
// the live reading and the per-resource breakdown underneath it.
//
// Reads /api/admin/host-metrics; writes tunables through .../config and forces
// a row through .../sample.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";
import DiskBreakdown from "./DiskBreakdown";
import type { Bucket, Resource, ThresholdStatus } from "@/lib/host-metrics/compute";
import type { HostMetricsConfig } from "@/lib/host-metrics/config";

type WindowKey = "24h" | "7d" | "30d";

type Live = {
  cpuPct: number;
  ramPct: number;
  diskPct: number;
  bwPct: number;
  worstPct: number;
  worst: Resource;
};

type Snapshot = {
  ready: boolean;
  reason?: string;
  host: string;
  hosts: string[];
  window: WindowKey;
  live: Live | null;
  latest: { ts: string; worstPct: number; worst: Resource } | null;
  averages: Record<WindowKey, number | null>;
  headlinePct?: number | null;
  status: ThresholdStatus | null;
  series: Bucket[];
  sampleCount?: number;
  sampler: {
    running: boolean;
    lastSkip: string | null;
    lastSampleAt: string | null;
    lastError: string | null;
    lastPruneAt: string | null;
    lastPruneDeleted: number | null;
    lastAlertAt: string | null;
    nextRunAt: string | null;
    host: string;
  };
  alert: {
    level: "ok" | "warn" | "critical";
    streak: number;
    firedLevel: "ok" | "warn" | "critical" | null;
    firedAt: number | null;
  };
  config: HostMetricsConfig;
};

const WINDOW_KEYS: WindowKey[] = ["24h", "7d", "30d"];

const RESOURCE_LABEL: Record<Resource, string> = {
  cpu: "CPU",
  ram: "RAM",
  disk: "Disk",
  bandwidth: "Bandwidth",
};

/** Amber and red come from config, so a retuned box colours by its own bounds. */
function toneFor(pct: number | null, cfg: HostMetricsConfig): "ok" | "warn" | "critical" | "none" {
  if (pct === null) return "none";
  if (pct >= cfg.criticalPct) return "critical";
  if (pct >= cfg.warnPct) return "warn";
  return "ok";
}

const TONE_COLOR = {
  ok: colors.green,
  warn: colors.gold,
  critical: colors.red,
  none: "var(--t-textGhost)",
} as const;

function pct(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : `${n.toFixed(1)}%`;
}

function when(iso: string | null): string {
  if (!iso) return "never";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function BoxUsageControlModal({ onClose }: { onClose: () => void }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [windowKey, setWindowKey] = useState<WindowKey>("24h");
  const [host, setHost] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const q = new URLSearchParams({ window: windowKey });
      if (host) q.set("host", host);
      const res = await fetch(`/api/admin/host-metrics?${q}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      setSnap(data as Snapshot);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [windowKey, host]);

  useEffect(() => {
    load();
  }, [load]);

  // A live gauge that never moves reads as broken. 30s is slow enough that the
  // extra /proc pass is free and fast enough that the number feels current.
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const sampleNow = async () => {
    setBusy(true);
    try {
      await fetch("/api/admin/host-metrics/sample", { method: "POST", credentials: "same-origin" });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const saveConfig = async (patch: Partial<HostMetricsConfig>) => {
    setBusy(true);
    try {
      await fetch("/api/admin/host-metrics/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(patch),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const cfg = snap?.config;
  const headline = snap?.headlinePct ?? snap?.live?.worstPct ?? null;
  const tone = cfg ? toneFor(headline, cfg) : "none";

  const sections: HCMSection[] = [
    {
      id: "capacity",
      title: "Capacity",
      qmbm:
        "The headline is WORST-OF the four resources, not an average of them — a box dies from whichever fills first, and blending would let a 96%-full disk hide behind three idle resources.\n\n" +
        "It reads the 24-hour rolling average, because 'should we upgrade?' is a question about sustained load; a backup job pinning the CPU for ninety seconds is not a reason to buy a box. The live column underneath is the instant reading.",
      body: (
        <Body>
          <Headline>
            <Big style={{ color: TONE_COLOR[tone] }}>{pct(headline)}</Big>
            <HeadlineMeta>
              <Pill $tone={tone}>
                {tone === "none"
                  ? "no data yet"
                  : tone === "critical"
                    ? "CRITICAL"
                    : tone === "warn"
                      ? "WARNING"
                      : "HEALTHY"}
              </Pill>
              <Muted>
                worst-of · 24h average
                {snap?.live ? ` · right now the ceiling is ${RESOURCE_LABEL[snap.live.worst]}` : ""}
              </Muted>
            </HeadlineMeta>
          </Headline>

          <Bars>
            {(["cpu", "ram", "disk", "bandwidth"] as Resource[]).map((r) => {
              const v = snap?.live ? snap.live[`${r === "bandwidth" ? "bw" : r}Pct` as keyof Live] : null;
              const value = typeof v === "number" ? v : null;
              const t = cfg ? toneFor(value, cfg) : "none";
              return (
                <BarRow key={r}>
                  <BarLabel>{RESOURCE_LABEL[r]}</BarLabel>
                  <BarTrack>
                    <BarFill style={{ width: `${value ?? 0}%`, background: TONE_COLOR[t] }} />
                  </BarTrack>
                  <BarValue>{pct(value)}</BarValue>
                </BarRow>
              );
            })}
          </Bars>

          {snap && !snap.live && (
            <Muted>
              No live reading — /proc is unavailable, so this is not a Linux box (the numbers are
              RCS&apos;s, and a Mac reports nothing rather than inventing plausible ones).
            </Muted>
          )}
          {snap?.live && snap.live.cpuPct === 0 && snap.live.bwPct === 0 && (
            <Muted>
              CPU and bandwidth are deltas — they read 0% until two readings exist.
            </Muted>
          )}
        </Body>
      ),
    },
    {
      id: "disk",
      title: "Disk breakdown",
      qmbm:
        "Disk is the resource that actually fills on this box, and 'it's at 93%' is only half an answer — the other half is which directories, and whether any of them are safe to reclaim.\n\n" +
        "Each row is a directory measured with du. The gear opens what it is, what cleaning it up would cost you, and the knobs for how aggressive that cleanup is. Rows without a gear action are measured only: production checkouts, the archive, someone else's home directory.\n\n" +
        "Nothing deletes without a preview. Reclaim stays disabled until Preview has listed exactly what would go, then asks once more. A request never carries a path — it names a target from a hard-coded list, and every candidate is re-checked to be inside that target immediately before it is touched.\n\n" +
        "Scans are cached for 30 minutes and run niced and ioniced to the floor: a monitor that browns out the box it is monitoring has defeated itself.",
      body: <DiskBreakdown />,
    },
    {
      id: "history",
      title: "History",
      qmbm:
        "Each bar is a bucket of samples, showing the bucket's mean with its peak marked above it. A mean alone would smooth a 100% spike into nothing, and the spike is usually the reason you opened this.\n\n" +
        "Empty buckets are drawn as gaps rather than zeros: a box that stopped reporting is not a box reporting 0%.",
      body: (
        <Body>
          <Rowline>
            {WINDOW_KEYS.map((w) => (
              <TBtn key={w} $active={windowKey === w} onClick={() => setWindowKey(w)}>
                {w}
              </TBtn>
            ))}
            <Spacer />
            {WINDOW_KEYS.map((w) => (
              <Stat key={w}>
                <StatLabel>{w} avg</StatLabel>
                <StatValue>{pct(snap?.averages?.[w] ?? null)}</StatValue>
              </Stat>
            ))}
          </Rowline>

          <Chart
            buckets={snap?.series ?? []}
            warnPct={cfg?.warnPct ?? 75}
            criticalPct={cfg?.criticalPct ?? 90}
          />

          <Muted>
            {snap?.ready
              ? `${snap.sampleCount ?? 0} samples stored for ${snap.host} · retention ${cfg?.retentionDays ?? "—"} days`
              : "Collection hasn't started — the host_metric_samples table doesn't exist yet."}
          </Muted>
        </Body>
      ),
    },
    {
      id: "collection",
      title: "Collection",
      qmbm:
        "The sampler runs inside the Office process rather than as a system cron, because CPU and bandwidth only exist as a difference between two readings — a one-shot cron script would start cold every time and report 0% CPU forever.\n\n" +
        "The table is applied by hand with psql (sql/host-metric-samples.sql); Office runs no migrations, and a monitor that silently CREATEs against the shared prod DB is a worse problem than the one it solves.",
      body: (
        <Body>
          <Rowline>
            <Pill $tone={snap?.sampler?.running ? "ok" : "critical"}>
              {snap?.sampler?.running ? "SAMPLER RUNNING" : "SAMPLER STOPPED"}
            </Pill>
            <Pill $tone={snap?.ready ? "ok" : "warn"}>
              {snap?.ready ? "TABLE PRESENT" : "TABLE MISSING"}
            </Pill>
            {cfg && !cfg.samplingEnabled && <Pill $tone="warn">SAMPLING DISABLED</Pill>}
          </Rowline>

          <Grid>
            <Cell>
              <StatLabel>Host</StatLabel>
              <StatValue>{snap?.host ?? "—"}</StatValue>
            </Cell>
            <Cell>
              <StatLabel>Last sample</StatLabel>
              <StatValue>{when(snap?.sampler?.lastSampleAt ?? null)}</StatValue>
            </Cell>
            <Cell>
              <StatLabel>Next tick</StatLabel>
              <StatValue>{when(snap?.sampler?.nextRunAt ?? null)}</StatValue>
            </Cell>
            <Cell>
              <StatLabel>Last prune</StatLabel>
              <StatValue>
                {when(snap?.sampler?.lastPruneAt ?? null)}
                {typeof snap?.sampler?.lastPruneDeleted === "number"
                  ? ` (${snap.sampler.lastPruneDeleted} rows)`
                  : ""}
              </StatValue>
            </Cell>
          </Grid>

          {snap?.sampler?.lastError && <ErrText>last error: {snap.sampler.lastError}</ErrText>}

          <Rowline>
            <TBtn $active={false} disabled={busy} onClick={sampleNow}>
              Sample now
            </TBtn>
            {(snap?.hosts?.length ?? 0) > 1 && (
              <Select value={host ?? snap?.host ?? ""} onChange={(e) => setHost(e.target.value)}>
                {snap?.hosts.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            )}
          </Rowline>
        </Body>
      ),
    },
    {
      id: "tunables",
      title: "Thresholds & retention",
      qmbm:
        "Amber and red default to 75 / 90 but are per-box: a build server that lives at 85% CPU shouldn't be permanently amber.\n\n" +
        "Out-of-range values are pulled to the nearest allowed one rather than rejected, so a slip in a number field can't leave the box unmonitored. Cadence changes apply at the next tick, without a redeploy.\n\n" +
        "Alerts fire on EDGES, not states: crossing up sends one team alert, and nothing more until it either escalates or recovers. A box parked at 92% would otherwise page 288 times a day, and a muted monitor is worse than none.",
      body: cfg ? (
        <Body>
          <Grid>
            <NumField
              label="Warn at (%)"
              value={cfg.warnPct}
              min={1}
              max={99}
              disabled={busy}
              onCommit={(v) => saveConfig({ warnPct: v })}
            />
            <NumField
              label="Critical at (%)"
              value={cfg.criticalPct}
              min={1}
              max={100}
              disabled={busy}
              onCommit={(v) => saveConfig({ criticalPct: v })}
            />
            <NumField
              label="Sample every (min)"
              value={Math.round(cfg.sampleIntervalMs / 60_000)}
              min={1}
              max={60}
              disabled={busy}
              onCommit={(v) => saveConfig({ sampleIntervalMs: v * 60_000 })}
            />
            <NumField
              label="Keep for (days)"
              value={cfg.retentionDays}
              min={1}
              max={365}
              disabled={busy}
              onCommit={(v) => saveConfig({ retentionDays: v })}
            />
            <NumField
              label="NIC cap (Mbps)"
              value={cfg.nicCapMbps}
              min={1}
              max={100_000}
              disabled={busy}
              onCommit={(v) => saveConfig({ nicCapMbps: v })}
            />
          </Grid>

          <Rowline>
            <TBtn
              $active={cfg.samplingEnabled}
              disabled={busy}
              onClick={() => saveConfig({ samplingEnabled: !cfg.samplingEnabled })}
            >
              Sampling {cfg.samplingEnabled ? "on" : "off"}
            </TBtn>
            <TBtn
              $active={cfg.alertsEnabled}
              disabled={busy}
              onClick={() => saveConfig({ alertsEnabled: !cfg.alertsEnabled })}
            >
              Alerts {cfg.alertsEnabled ? "on" : "off"}
            </TBtn>
            <Muted>Last changed {when(cfg.lastUpdated)}</Muted>
          </Rowline>

          <Muted>
            {snap?.alert?.firedLevel
              ? `Currently alerting at ${snap.alert.firedLevel} — the next alert for this box is a further escalation or a recovery, not a repeat. Last sent ${when(snap.sampler?.lastAlertAt ?? null)}.`
              : `Armed. ${snap?.alert?.level ?? "ok"} for ${snap?.alert?.streak ?? 0} consecutive sample${snap?.alert?.streak === 1 ? "" : "s"} — a level must hold for 3 before anything is sent.`}
          </Muted>
        </Body>
      ) : (
        <Muted>Loading…</Muted>
      ),
    },
  ];

  return (
    <HardeningControlModal
      title="Box Usage"
      subtitle="how full is this box, and which resource gets there first"
      qmbm={
        error
          ? `Snapshot failed to load: ${error}`
          : "Capacity telemetry for the box Office runs on: CPU, RAM, disk and bandwidth, sampled on a cadence and kept as history so 'do we need another box' has an answer with a number in it."
      }
      sections={sections}
      auditLogView={<AuditLogTimeline endpoint="/api/admin/host-metrics/audit-log" />}
      onClose={onClose}
    />
  );
}

/**
 * The history chart. Deliberately hand-rolled SVG rather than a charting
 * dependency — it draws bars, two threshold rules and a peak tick, and every
 * library that does that also ships a layout engine we'd never use.
 */
function Chart({
  buckets,
  warnPct,
  criticalPct,
}: {
  buckets: Bucket[];
  warnPct: number;
  criticalPct: number;
}) {
  const H = 120;
  const W = 640;
  if (!buckets.length) return <ChartEmpty>No history yet.</ChartEmpty>;
  const bw = W / buckets.length;
  const y = (v: number) => H - (v / 100) * H;

  return (
    <ChartWrap>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H}>
        <line x1={0} x2={W} y1={y(warnPct)} y2={y(warnPct)} stroke={colors.gold} strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
        <line x1={0} x2={W} y1={y(criticalPct)} y2={y(criticalPct)} stroke={colors.red} strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
        {buckets.map((b, i) => {
          if (b.worstPct === null) return null;
          const color =
            b.worstPct >= criticalPct ? colors.red : b.worstPct >= warnPct ? colors.gold : colors.green;
          return (
            <g key={i}>
              <rect
                x={i * bw}
                y={y(b.worstPct)}
                width={Math.max(1, bw - 1)}
                height={H - y(b.worstPct)}
                fill={color}
                opacity={0.55}
              />
              {b.peakPct !== null && b.peakPct > b.worstPct && (
                <rect x={i * bw} y={y(b.peakPct)} width={Math.max(1, bw - 1)} height={1.5} fill={color} />
              )}
            </g>
          );
        })}
      </svg>
      <ChartAxis>
        <span>0%</span>
        <span>
          amber {warnPct}% · red {criticalPct}%
        </span>
        <span>100%</span>
      </ChartAxis>
    </ChartWrap>
  );
}

/**
 * A number input that only writes on blur/Enter. Saving per keystroke would
 * PATCH (and audit-log) once per digit typed.
 */
function NumField({
  label,
  value,
  min,
  max,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onCommit: (v: number) => void;
}) {
  // Re-sync on a saved change without an effect — React's "adjust state during
  // render" pattern, which is one render instead of two.
  const [draft, setDraft] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(String(value));
  }

  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || n === value) {
      setDraft(String(value));
      return;
    }
    onCommit(n);
  };

  return (
    <Cell>
      <StatLabel>{label}</StatLabel>
      <Input
        type="number"
        min={min}
        max={max}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </Cell>
  );
}

// ── styled ───────────────────────────────────────────────────────────────

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const Rowline = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-wrap: wrap;
`;

const Spacer = styled.div`
  flex: 1 1 auto;
`;

const Headline = styled.div`
  display: flex;
  align-items: baseline;
  gap: 1rem;
  flex-wrap: wrap;
`;

const Big = styled.div`
  font-size: 2.5rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  line-height: 1;
`;

const HeadlineMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const Pill = styled.span<{ $tone: "ok" | "warn" | "critical" | "none" }>`
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  width: fit-content;
  color: ${(p) => TONE_COLOR[p.$tone]};
  border: 1px solid ${(p) => (p.$tone === "none" ? "var(--t-border)" : TONE_COLOR[p.$tone])};
  background: rgba(0, 0, 0, 0.2);
`;

const Muted = styled.div`
  font-size: 0.72rem;
  color: var(--t-textFaint);
`;

const ErrText = styled.div`
  font-size: 0.6875rem;
  color: ${colors.red};
  font-family: var(--font-geist-mono), monospace;
`;

const Bars = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const BarRow = styled.div`
  display: grid;
  grid-template-columns: 5.5rem 1fr 3.5rem;
  align-items: center;
  gap: 0.625rem;
`;

const BarLabel = styled.span`
  font-size: 0.72rem;
  color: var(--t-textMuted);
`;

const BarTrack = styled.div`
  height: 0.5rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
`;

const BarFill = styled.div`
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
`;

const BarValue = styled.span`
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--t-textMuted);
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 0.625rem;
`;

const Cell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`;

const Stat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 4rem;
`;

const StatLabel = styled.span`
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--t-textFaint);
`;

const StatValue = styled.span`
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  color: var(--t-text);
`;

const TBtn = styled.button<{ $active: boolean }>`
  padding: 0.35rem 0.75rem;
  font-size: 0.72rem;
  font-weight: 650;
  border-radius: 0.4rem;
  cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.16)` : "transparent")};
  color: ${(p) => (p.$active ? colors.gold : "var(--t-textMuted)")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.5)` : "var(--t-border)")};
  &:hover:not(:disabled) {
    color: ${colors.gold};
    border-color: rgba(${rgb.gold}, 0.5);
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

const Select = styled.select`
  font-size: 0.72rem;
  padding: 0.3rem 0.5rem;
  border-radius: 0.4rem;
  background: var(--t-inputBg);
  color: var(--t-text);
  border: 1px solid var(--t-border);
`;

const Input = styled.input`
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  padding: 0.3rem 0.5rem;
  border-radius: 0.4rem;
  background: var(--t-inputBg);
  color: var(--t-text);
  border: 1px solid var(--t-border);
  &:focus {
    outline: none;
    border-color: rgba(${rgb.gold}, 0.5);
  }
`;

const ChartWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
`;

const ChartAxis = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.625rem;
  color: var(--t-textFaint);
`;

const ChartEmpty = styled.div`
  font-size: 0.75rem;
  font-style: italic;
  color: var(--t-textFaint);
  text-align: center;
  padding: 1.5rem;
  border: 1px dashed var(--t-border);
  border-radius: 0.5rem;
`;

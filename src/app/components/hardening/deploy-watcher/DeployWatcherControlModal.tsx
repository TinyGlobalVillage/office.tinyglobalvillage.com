"use client";

// DeployWatcherControlModal — System Hardening surface for the deploy watcher
// (deploy-watcher, 2026-10-28). The watcher is a launchd agent on the Mac: when
// main moves for a target it builds on the Mac and STAGES the build on RCS
// (.next.incoming). Nothing goes live until someone presses Deploy on the
// Deploy page (or says "deploy"). This modal pauses it and tunes its timing.
// Reads/writes /api/hardening/deploy-watcher.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";
import ConfirmModal from "../../frontdesk/ConfirmModal";

type Config = {
  enabled: boolean; pollSec: number; debounceSec: number; maxBuildsPerHour: number; smokeTimeoutSec: number;
  targets: string[]; follow: Record<string, string[]>; updatedBy?: string; updatedAt?: string;
};
type Health = { online: boolean; host: string | null; at: string | null; enabled: boolean | null; pollSec: number | null };
type Release = { client: string; follows: string | null; state: string | null; phase: string | null };

const NUMS: Array<{ k: keyof Config; label: string; min: number; max: number; help: string }> = [
  { k: "pollSec", label: "Poll every (s)", min: 10, max: 3600, help: "How often the watcher asks origin/main whether a target moved." },
  { k: "debounceSec", label: "Quiet period (s)", min: 0, max: 3600, help: "main must sit still this long before a build starts — three lanes pushing within a minute become one build." },
  { k: "maxBuildsPerHour", label: "Max builds / hour", min: 1, max: 30, help: "Per target. Past this the target goes 'blocked' until the hour rolls over." },
  { k: "smokeTimeoutSec", label: "Smoke timeout (s)", min: 10, max: 600, help: "After a promote, how long the site has to answer 200 before it is rolled back automatically." },
];

export default function DeployWatcherControlModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });
  const [cfg, setCfg] = useState<Config | null>(null);
  const [draft, setDraft] = useState<Config | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [askPause, setAskPause] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/hardening/deploy-watcher");
      const d = await r.json();
      if (d?.ok) { setCfg(d.config); setDraft(d.config); setHealth(d.health); setReleases(d.releases ?? []); }
    } catch { /* */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (patch: Partial<Config>) => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/hardening/deploy-watcher", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d?.error ?? `HTTP ${r.status}`);
      await load();
    } finally { setBusy(false); }
  };

  const ago = (t?: string | null) => {
    if (!t) return "never";
    const s = Math.max(0, Math.round((Date.now() - Date.parse(t)) / 1000));
    return s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`;
  };
  const enabled = cfg?.enabled ?? true;
  const dirty = !!cfg && !!draft && NUMS.some((n) => cfg[n.k] !== draft[n.k]);

  const sections: HCMSection[] = [
    {
      id: "watcher",
      title: "Watcher",
      qmbm: "A launchd agent on the Mac. When main moves for a target it waits out the quiet period, builds on the Mac and stages the build on RCS. It never promotes — Deploy on the Deploy page (or saying \"deploy\") does. Pausing it stops new builds; anything already staged stays deployable.",
      body: (
        <Body>
          <Rowline>
            <Pill $on={enabled}>{enabled ? "ENABLED — stages builds when main moves" : "PAUSED — no new builds"}</Pill>
            <Pill $on={!!health?.online}>{health?.online ? `Online · ${health.host ?? "mac"}` : "Offline"}</Pill>
            <Muted>Last poll {ago(health?.at)}</Muted>
          </Rowline>
          <Toggle>
            <TBtn $active={enabled} disabled={busy} onClick={() => save({ enabled: true })}>Enabled</TBtn>
            <TBtn $active={!enabled} disabled={busy} onClick={() => setAskPause(true)}>Paused</TBtn>
          </Toggle>
          {!health?.online && (
            <Muted>Offline usually means the Mac is asleep or the agent is not installed (deploy-watch-install.sh). Promote and rollback still work — they run here on RCS.</Muted>
          )}
          <Muted>Last changed by {cfg?.updatedBy ?? "—"}{cfg?.updatedAt ? ` · ${ago(cfg.updatedAt)}` : ""}.</Muted>
        </Body>
      ),
    },
    {
      id: "timing",
      title: "Timing",
      qmbm: "Poll, debounce, the hourly build cap and the post-promote smoke timeout. Picked up by the watcher on its next poll.",
      body: (
        <Body>
          <Grid>
            {NUMS.map((n) => (
              <Field key={n.k}>
                <Label>{n.label}</Label>
                <Num
                  type="number" min={n.min} max={n.max}
                  value={draft ? Number(draft[n.k]) : ""}
                  onChange={(e) => draft && setDraft({ ...draft, [n.k]: Number(e.target.value) })}
                />
                <Muted>{n.help}</Muted>
              </Field>
            ))}
          </Grid>
          <Rowline>
            <Save disabled={!dirty || busy} onClick={() => draft && save(Object.fromEntries(NUMS.map((n) => [n.k, draft[n.k]])))}>Save timing</Save>
            {dirty && <Muted>Unsaved changes</Muted>}
            {err && <ErrText>{err}</ErrText>}
          </Rowline>
        </Body>
      ),
    },
    {
      id: "targets",
      title: "Targets",
      qmbm: "The apps the watcher builds. A follower rebuilds whenever its target does (demo-hq is the same code as tgv.com) and is deployed on its own tile.",
      body: (
        <Body>
          {releases.map((r) => (
            <Rowline key={r.client}>
              <Mono>{r.follows ? "↳ " : ""}{r.client}</Mono>
              {r.follows && <Muted>follows {r.follows}</Muted>}
              <Pill $on={r.state !== "failed" && r.state !== "blocked"}>{r.state ?? "idle"}</Pill>
              {r.phase && <Muted>{r.phase}</Muted>}
            </Rowline>
          ))}
          <Muted>Targets are edited in data/workshop/deploy-watch.json for now.</Muted>
        </Body>
      ),
    },
  ];

  return (
    <>
      <HardeningControlModal
        title="Deploy Watcher"
        subtitle="builds on the Mac when main moves · stages, never promotes"
        sections={sections}
        auditLogView={<AuditLogTimeline endpoint="/api/hardening/deploy-watcher/audit-log" kinds={["config", "promote", "rollback", "rebuild"]} />}
        onClose={onClose}
      />
      <ConfirmModal
        open={askPause}
        title="Pause the deploy watcher?"
        message="No new builds will be staged until you enable it again."
        detail="Anything already staged stays deployable, and rollback keeps working."
        confirmLabel="Pause"
        intent="danger"
        onConfirm={async () => { setAskPause(false); await save({ enabled: false }); }}
        onCancel={() => setAskPause(false)}
      />
    </>
  );
}

const Body = styled.div`display: flex; flex-direction: column; gap: 10px;`;
const Rowline = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap;`;
const Grid = styled.div`display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;`;
const Field = styled.label`display: flex; flex-direction: column; gap: 4px;`;
const Label = styled.span`font-size: 11.5px; font-weight: 650; color: rgba(232,232,239,0.75);`;
const Num = styled.input`
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px;
  color: #e8e8ef; padding: 6px 8px; font-size: 13px; width: 110px; font-variant-numeric: tabular-nums;
`;
const Pill = styled.span<{ $on: boolean }>`
  font-size: 11px; font-weight: 650; padding: 3px 10px; border-radius: 999px;
  ${(p) => (p.$on
    ? "background: rgba(80,220,140,0.14); color: #7ff0b0; border: 1px solid rgba(80,220,140,0.35);"
    : "background: rgba(255,200,80,0.12); color: #ffd587; border: 1px solid rgba(255,200,80,0.3);")}
`;
const Muted = styled.div`font-size: 11.5px; color: rgba(232,232,239,0.5);`;
const Mono = styled.span`font-family: ui-monospace, monospace; font-size: 12px; color: #cfe9ff;`;
const ErrText = styled.span`font-size: 11.5px; color: #ff9a9a;`;
const Toggle = styled.div`display: inline-flex; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; overflow: hidden; width: fit-content;`;
const TBtn = styled.button<{ $active: boolean }>`
  background: ${(p) => (p.$active ? "rgba(120,200,255,0.18)" : "transparent")};
  color: ${(p) => (p.$active ? "#cfe9ff" : "rgba(232,232,239,0.6)")};
  border: none; padding: 8px 16px; font-size: 12.5px; font-weight: 600; cursor: pointer;
  &:disabled { opacity: 0.5; cursor: default; }
`;
const Save = styled.button`
  background: rgba(120,200,255,0.16); color: #cfe9ff; border: 1px solid rgba(120,200,255,0.35);
  border-radius: 8px; padding: 7px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer;
  &:disabled { opacity: 0.4; cursor: default; }
`;

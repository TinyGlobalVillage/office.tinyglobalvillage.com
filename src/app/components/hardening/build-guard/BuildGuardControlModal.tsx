"use client";

// BuildGuardControlModal — System Hardening surface for build concurrency.
// Toggle SERIAL (default, memory-safe: concurrent next build/install blocked by the
// parallel-safety hook) ↔ ALLOW MULTIPLE (concurrent builds permitted; the build-guard-watchdog
// cron auto-reverts to serial if it detects an OOM/crash). Reads/writes /api/hardening/build-guard.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import ConfirmModal from "../../frontdesk/ConfirmModal";

type Mode = "serial" | "multi";
type AuditRow = { ts?: string; event?: string; reason?: string; to?: string; by?: string; sessions?: number };
type Status = {
  mode: Mode;
  autoRevertOnCrash: boolean;
  sessions: number;
  watchdogInstalled: boolean;
  audit: AuditRow[];
};

export default function BuildGuardControlModal({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const r = await fetch("/api/hardening/build-guard"); const d = await r.json(); if (d?.ok) setS(d); } catch { /* */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const [askMulti, setAskMulti] = useState(false);
  const applyMode = async (mode: Mode) => {
    setBusy(true);
    try {
      const r = await fetch("/api/hardening/build-guard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
      if (r.ok) await load();
    } finally { setBusy(false); }
  };
  const setMode = (mode: Mode) => { if (mode === "multi") setAskMulti(true); else applyMode("serial"); };

  const mode = s?.mode ?? "serial";
  const fmt = (t?: string) => (t ? new Date(t).toLocaleString() : "—");

  const sections: HCMSection[] = [
    {
      id: "concurrency",
      title: "Build concurrency",
      qmbm: "Controls whether more than one `next build` / install may run at once across Claude sessions on this box. Serial is the safe default — the parallel-safety hook blocks a second concurrent build. Allow-multiple lifts that, for when you know memory is free.",
      body: (
        <Body>
          <Rowline>
            <Pill $on={mode === "serial"}>{mode === "serial" ? "SERIAL — concurrent builds blocked" : "ALLOW MULTIPLE — concurrent builds permitted"}</Pill>
            <Muted>{s ? `${s.sessions} Claude session${s.sessions === 1 ? "" : "s"} live` : ""}</Muted>
          </Rowline>
          <Toggle>
            <TBtn $active={mode === "serial"} disabled={busy} onClick={() => setMode("serial")}>Serial (safe)</TBtn>
            <TBtn $active={mode === "multi"} disabled={busy} onClick={() => setMode("multi")}>Allow multiple</TBtn>
          </Toggle>
          <Muted>Last changed by {s?.audit?.find((a) => a.event === "mode_change")?.by ?? "—"}.</Muted>
        </Body>
      ),
    },
    {
      id: "watchdog",
      title: "Crash watchdog",
      qmbm: "A cron sentinel that runs every 5 minutes. In allow-multiple mode it watches for an OOM-kill or an errored pm2 app and auto-reverts build mode to serial. In serial mode it is idle.",
      body: (
        <Body>
          <Rowline>
            <Pill $on={s?.watchdogInstalled ?? false}>{s?.watchdogInstalled ? "Cron installed" : "Cron NOT installed"}</Pill>
            <Pill $on={mode === "multi"}>{mode === "multi" ? "Active (policing)" : "Idle (serial)"}</Pill>
            <Pill $on={s?.autoRevertOnCrash ?? true}>{s?.autoRevertOnCrash ? "Auto-revert ON" : "Auto-revert OFF"}</Pill>
          </Rowline>
          <Muted>Signals: kernel OOM-killer (last 6 min) · any pm2 app in “errored”. On a hit → mode flips to serial + logged below.</Muted>
        </Body>
      ),
    },
  ];

  const auditLogView = (
    <AuditWrap>
      <AuditTitle>Activity</AuditTitle>
      {(!s || s.audit.length === 0) && <Muted>No events yet.</Muted>}
      {s?.audit?.map((a, i) => (
        <AuditRowEl key={i}>
          <AEvent $kind={a.event}>{a.event ?? "event"}</AEvent>
          <AText>
            {a.to ? `→ ${a.to}` : ""}{a.reason ? ` · ${a.reason}` : ""}{a.by ? ` · by ${a.by}` : ""}{typeof a.sessions === "number" ? ` · ${a.sessions} sessions` : ""}
          </AText>
          <ATime>{fmt(a.ts)}</ATime>
        </AuditRowEl>
      ))}
    </AuditWrap>
  );

  return (
    <>
      <HardeningControlModal
        title="Build Concurrency"
        subtitle="serial vs. allow-multiple next builds — with an OOM/crash auto-revert watchdog"
        sections={sections}
        auditLogView={auditLogView}
        onClose={onClose}
      />
      <ConfirmModal
        open={askMulti}
        title="Allow multiple concurrent builds?"
        message="This lifts the serial-build guard."
        detail="Two large builds at once can exhaust RAM and OOM-kill a build (which can take an app down). The watchdog will auto-revert to serial if it detects a crash. Proceed only when you're confident about memory."
        confirmLabel="Allow multiple"
        intent="primary"
        onConfirm={async () => { setAskMulti(false); await applyMode("multi"); }}
        onCancel={() => setAskMulti(false)}
      />
    </>
  );
}

const Body = styled.div`display: flex; flex-direction: column; gap: 10px;`;
const Rowline = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap;`;
const Pill = styled.span<{ $on: boolean }>`
  font-size: 11px; font-weight: 650; padding: 3px 10px; border-radius: 999px;
  ${(p) => (p.$on
    ? "background: rgba(80,220,140,0.14); color: #7ff0b0; border: 1px solid rgba(80,220,140,0.35);"
    : "background: rgba(255,200,80,0.12); color: #ffd587; border: 1px solid rgba(255,200,80,0.3);")}
`;
const Muted = styled.div`font-size: 11.5px; color: rgba(232,232,239,0.5);`;
const Toggle = styled.div`display: inline-flex; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; overflow: hidden; width: fit-content;`;
const TBtn = styled.button<{ $active: boolean }>`
  background: ${(p) => (p.$active ? "rgba(120,200,255,0.18)" : "transparent")};
  color: ${(p) => (p.$active ? "#cfe9ff" : "rgba(232,232,239,0.6)")};
  border: none; padding: 8px 16px; font-size: 12.5px; font-weight: 600; cursor: pointer;
  &:disabled { opacity: 0.5; cursor: default; }
`;
const AuditWrap = styled.div`display: flex; flex-direction: column; gap: 4px;`;
const AuditTitle = styled.div`font-size: 12px; font-weight: 650; color: rgba(232,232,239,0.7); margin-bottom: 4px;`;
const AuditRowEl = styled.div`display: flex; align-items: center; gap: 10px; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 11.5px;`;
const AEvent = styled.span<{ $kind?: string }>`
  flex: 0 0 auto; font-weight: 650; text-transform: uppercase; font-size: 10px; letter-spacing: 0.03em;
  color: ${(p) => (p.$kind === "auto_revert_serial" ? "#ff9a9a" : p.$kind === "mode_change" ? "#bfe4ff" : "rgba(232,232,239,0.6)")};
`;
const AText = styled.span`flex: 1 1 auto; color: rgba(232,232,239,0.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const ATime = styled.span`flex: 0 0 auto; color: rgba(232,232,239,0.4); font-variant-numeric: tabular-nums;`;

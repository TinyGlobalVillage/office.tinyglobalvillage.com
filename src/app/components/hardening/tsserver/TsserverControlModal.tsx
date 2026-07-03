"use client";

// TsserverControlModal — System Hardening surface for the VS Code TypeScript server's
// memory cap. An uncapped tsserver grows past 2–3 GB on this monorepo and starves
// production `next build`s (7.8 GB box) — this tile makes the cap visible + tunable and
// lets the operator restart oversized tsservers on demand. Reads/writes /api/hardening/tsserver.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import ConfirmModal from "../../frontdesk/ConfirmModal";

type Proc = { pid: number; rssMb: number; kind: "semantic" | "partial" };
type AuditRow = { ts?: string; event?: string; from?: number | null; to?: number; killed?: number; by?: string };
type Status = {
  capMb: number | null;
  defaultCapMb: number;
  settingsPath: string;
  processes: Proc[];
  totalRssMb: number;
  audit: AuditRow[];
};

export default function TsserverControlModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [capInput, setCapInput] = useState("");
  const [msg, setMsg] = useState("");
  const [askRestart, setAskRestart] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/hardening/tsserver");
      const d = await r.json();
      if (d?.ok) {
        setS(d);
        setCapInput(String(d.capMb ?? d.defaultCapMb));
      }
    } catch { /* offline */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const post = async (body: Record<string, unknown>, okMsg: (d: Record<string, number>) => string) => {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/hardening/tsserver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (r.ok && d?.ok) { setMsg(okMsg(d)); await load(); }
      else setMsg(d?.error ?? "Request failed");
    } finally { setBusy(false); }
  };

  const saveCap = () => {
    const capMb = parseInt(capInput, 10);
    if (!Number.isFinite(capMb)) { setMsg("Enter a number of MB"); return; }
    post({ capMb }, (d) => `Cap saved: ${d.capMb} MB — applies when a TS server next (re)starts.`);
  };

  const effectiveCap = s?.capMb ?? s?.defaultCapMb ?? 3072;
  const oversized = (s?.processes ?? []).filter((p) => p.rssMb > effectiveCap);
  const fmt = (t?: string) => (t ? new Date(t).toLocaleString() : "—");

  const sections: HCMSection[] = [
    {
      id: "cap",
      title: "Memory cap",
      qmbm: "The maximum heap VS Code grants its TypeScript language server (typescript.tsserver.maxTsServerMemory, written to the remote Machine settings). It applies when a TS server starts — use the restart action below to enforce it immediately. Lower = more RAM headroom for builds; higher = snappier IntelliSense on this monorepo.",
      body: (
        <Body>
          <Rowline>
            <Pill $on={s?.capMb != null}>{s?.capMb != null ? `CAPPED — ${s.capMb} MB` : `UNCAPPED — VS Code default ${s?.defaultCapMb ?? 3072} MB`}</Pill>
          </Rowline>
          <Rowline>
            <CapInput
              type="number"
              min={512}
              max={12288}
              step={256}
              value={capInput}
              onChange={(e) => setCapInput(e.target.value)}
              disabled={busy}
            />
            <Muted>MB</Muted>
            <SaveBtn type="button" disabled={busy} onClick={saveCap}>Save cap</SaveBtn>
          </Rowline>
          <Muted>Written to {s?.settingsPath ?? "…"}. 2048 MB is the build-safe setting on this box; 3072 is VS Code&apos;s default.</Muted>
        </Body>
      ),
    },
    {
      id: "live",
      title: "Live TS servers",
      qmbm: "The tsserver processes currently running for connected VS Code windows (semantic = the big one; partial = the lightweight syntax server). Restarting is safe: VS Code respawns them automatically under the current cap — you lose IntelliSense for a few seconds, nothing else.",
      body: (
        <Body>
          <Rowline>
            {(s?.processes ?? []).length === 0 && <Muted>No tsserver running (no VS Code window connected).</Muted>}
            {s?.processes?.map((p) => (
              <Pill key={p.pid} $on={p.rssMb <= effectiveCap}>
                pid {p.pid} · {p.kind} · {p.rssMb} MB
              </Pill>
            ))}
          </Rowline>
          {s && <Muted>Total: {s.totalRssMb} MB{oversized.length ? ` — ${oversized.length} over the ${effectiveCap} MB cap` : ""}</Muted>}
          <Rowline>
            <SaveBtn type="button" disabled={busy || (s?.processes ?? []).length === 0} onClick={() => setAskRestart(true)}>
              Restart TS servers now
            </SaveBtn>
            <SaveBtn type="button" disabled={busy} onClick={load}>Refresh</SaveBtn>
          </Rowline>
          {msg && <Msg onClick={() => setMsg("")}>{msg}</Msg>}
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
            {a.event === "cap_change" ? `${a.from ?? "default"} → ${a.to} MB` : ""}
            {a.event === "restart" ? `killed ${a.killed} process(es)` : ""}
            {a.by ? ` · by ${a.by}` : ""}
          </AText>
          <ATime>{fmt(a.ts)}</ATime>
        </AuditRowEl>
      ))}
    </AuditWrap>
  );

  return (
    <>
      <HardeningControlModal
        title="TS Server Memory"
        subtitle="cap + live footprint of VS Code's TypeScript server — protect build RAM"
        sections={sections}
        auditLogView={auditLogView}
        onClose={onClose}
      />
      <ConfirmModal
        open={askRestart}
        title="Restart TS servers?"
        message={`Kill ${s?.processes.length ?? 0} tsserver process(es) so VS Code respawns them under the ${effectiveCap} MB cap?`}
        detail="Safe: VS Code restarts them automatically. IntelliSense pauses for a few seconds in open editors; no files or builds are affected."
        confirmLabel="Restart"
        intent="primary"
        onConfirm={async () => {
          setAskRestart(false);
          await post({ restart: true }, (d) => `Restarted — ${d.killed} process(es) killed; VS Code respawns them capped.`);
        }}
        onCancel={() => setAskRestart(false)}
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
const Msg = styled.div`font-size: 11.5px; color: #cfe9ff; cursor: pointer;`;
const CapInput = styled.input`
  width: 110px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px; color: #e8e8ef; padding: 7px 10px; font-size: 13px; outline: none;
  font-variant-numeric: tabular-nums;
  &:focus { border-color: rgba(120,200,255,0.5); }
`;
const SaveBtn = styled.button`
  background: rgba(120,200,255,0.12); border: 1px solid rgba(120,200,255,0.3); color: #cfe9ff;
  border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer;
  &:hover:not(:disabled) { background: rgba(120,200,255,0.2); }
  &:disabled { opacity: 0.45; cursor: default; }
`;
const AuditWrap = styled.div`display: flex; flex-direction: column; gap: 4px;`;
const AuditTitle = styled.div`font-size: 12px; font-weight: 650; color: rgba(232,232,239,0.7); margin-bottom: 4px;`;
const AuditRowEl = styled.div`display: flex; align-items: center; gap: 10px; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 11.5px;`;
const AEvent = styled.span<{ $kind?: string }>`
  flex: 0 0 auto; font-weight: 650; text-transform: uppercase; font-size: 10px; letter-spacing: 0.03em;
  color: ${(p) => (p.$kind === "restart" ? "#ffd587" : p.$kind === "cap_change" ? "#bfe4ff" : "rgba(232,232,239,0.6)")};
`;
const AText = styled.span`flex: 1 1 auto; color: rgba(232,232,239,0.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const ATime = styled.span`flex: 0 0 auto; color: rgba(232,232,239,0.4); font-variant-numeric: tabular-nums;`;

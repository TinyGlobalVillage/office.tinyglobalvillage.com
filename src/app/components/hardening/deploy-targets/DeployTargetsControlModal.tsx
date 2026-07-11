"use client";

// DeployTargetsControlModal — System-Hardening surface for the deploy resolver.
// An ordered list of build targets (Mac first; a future dedicated build box slots ABOVE it)
// plus the RCS last-resort toggle. Reads/writes /api/deploy/config. This is the "exit ramp":
// add a target here and deploys move off the Mac with no code change.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";

type Target = { name: string; sshAlias: string; wsRoot?: string; note?: string };
type Config = { targets: Target[]; lastResort: "rcs" | false; reachTimeoutSec?: number };

export default function DeployTargetsControlModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  const [cfg, setCfg] = useState<Config | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/deploy/config");
      const d = await r.json();
      if (d?.ok) setCfg(d.config);
    } catch { /* */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!cfg) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/deploy/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const d = await r.json();
      if (r.ok && d?.ok) { setCfg(d.config); setMsg("Saved ✓"); }
      else setMsg(d?.error || "Save failed");
    } catch { setMsg("Save failed"); }
    finally { setBusy(false); }
  };

  const patch = (i: number, p: Partial<Target>) =>
    setCfg((c) => (c ? { ...c, targets: c.targets.map((t, j) => (j === i ? { ...t, ...p } : t)) } : c));
  const move = (i: number, dir: -1 | 1) =>
    setCfg((c) => {
      if (!c) return c;
      const j = i + dir;
      if (j < 0 || j >= c.targets.length) return c;
      const t = [...c.targets];
      [t[i], t[j]] = [t[j], t[i]];
      return { ...c, targets: t };
    });
  const remove = (i: number) =>
    setCfg((c) => (c ? { ...c, targets: c.targets.filter((_, j) => j !== i) } : c));
  const add = () =>
    setCfg((c) => (c ? { ...c, targets: [...c.targets, { name: "", sshAlias: "", wsRoot: "Documents/REFUSIONBOX/MAC RCS" }] } : c));

  const nTargets = cfg?.targets.length ?? 0;

  const sections: HCMSection[] = [
    {
      id: "targets",
      title: "Build targets (priority order)",
      qmbm:
        "A deploy tries each target top-to-bottom; the first reachable over SSH within the timeout builds it, then ships .next to RCS. EXIT STRATEGY: to move builds off the Mac, add a dedicated build host ABOVE mac — no code change. wsRoot is $HOME-relative.",
      body: (
        <Body>
          {(cfg?.targets ?? []).map((t, i) => (
            <Row key={i}>
              <Ord>{i + 1}</Ord>
              <In placeholder="name" value={t.name} onChange={(e) => patch(i, { name: e.target.value })} style={{ width: "6rem" }} />
              <In placeholder="ssh alias" value={t.sshAlias} onChange={(e) => patch(i, { sshAlias: e.target.value })} style={{ width: "7rem" }} />
              <In placeholder="wsRoot (~-relative)" value={t.wsRoot ?? ""} onChange={(e) => patch(i, { wsRoot: e.target.value })} style={{ flex: 1, minWidth: "8rem" }} />
              <IconBtn title="move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</IconBtn>
              <IconBtn title="move down" disabled={i === nTargets - 1} onClick={() => move(i, 1)}>↓</IconBtn>
              <IconBtn title="remove" onClick={() => remove(i)}>✕</IconBtn>
            </Row>
          ))}
          {nTargets === 0 && <Muted>No build targets — deploys will go straight to the RCS fallback.</Muted>}
          <AddBtn onClick={add}>+ Add target</AddBtn>
        </Body>
      ),
    },
    {
      id: "lastresort",
      title: "RCS last resort",
      qmbm:
        "When NO build target is reachable (e.g. the Mac is off), fall back to building ON RCS? RCS is a 7.8GB shared box — this fallback is guarded (needs memory headroom + no concurrent build) but is genuinely last-resort. OFF = the deploy fails and waits for a build machine instead.",
      body: (
        <Body>
          <Toggle>
            <TBtn $active={cfg?.lastResort === "rcs"} disabled={busy} onClick={() => setCfg((c) => (c ? { ...c, lastResort: "rcs" } : c))}>RCS fallback ON</TBtn>
            <TBtn $active={cfg?.lastResort === false} disabled={busy} onClick={() => setCfg((c) => (c ? { ...c, lastResort: false } : c))}>OFF (fail instead)</TBtn>
          </Toggle>
          <Rowline>
            <Muted>SSH reach timeout</Muted>
            <In type="number" min={2} max={30} value={String(cfg?.reachTimeoutSec ?? 5)} onChange={(e) => setCfg((c) => (c ? { ...c, reachTimeoutSec: Number(e.target.value) } : c))} style={{ width: "4rem" }} />
            <Muted>seconds</Muted>
          </Rowline>
        </Body>
      ),
    },
    {
      id: "apply",
      title: "Apply",
      body: (
        <Body>
          <Rowline>
            <SaveBtn disabled={busy || !cfg} onClick={save}>{busy ? "Saving…" : "Save build targets"}</SaveBtn>
            {msg && <Muted>{msg}</Muted>}
          </Rowline>
        </Body>
      ),
    },
  ];

  return (
    <HardeningControlModal
      title="Build Targets"
      subtitle="where deploys build — Mac first, RCS last resort (your offload exit-ramp)"
      sections={sections}
      onClose={onClose}
    />
  );
}

const Body = styled.div`display: flex; flex-direction: column; gap: 10px;`;
const Row = styled.div`display: flex; align-items: center; gap: 6px; flex-wrap: wrap;`;
const Ord = styled.span`font-size: 11px; font-weight: 700; color: rgba(232,232,239,0.45); width: 1.2rem; text-align: right;`;
const In = styled.input`
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.14); border-radius: 7px;
  color: #e8e8ef; font-size: 12px; padding: 6px 8px; outline: none;
  &:focus { border-color: rgba(120,200,255,0.5); }
`;
const IconBtn = styled.button`
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px;
  color: rgba(232,232,239,0.7); font-size: 12px; width: 26px; height: 28px; cursor: pointer;
  &:disabled { opacity: 0.35; cursor: default; }
`;
const AddBtn = styled.button`
  align-self: flex-start; background: rgba(120,200,255,0.12); border: 1px solid rgba(120,200,255,0.3);
  color: #cfe9ff; border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
`;
const Rowline = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap;`;
const Muted = styled.div`font-size: 11.5px; color: rgba(232,232,239,0.5);`;
const Toggle = styled.div`display: inline-flex; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; overflow: hidden; width: fit-content;`;
const TBtn = styled.button<{ $active: boolean }>`
  background: ${(p) => (p.$active ? "rgba(120,200,255,0.18)" : "transparent")};
  color: ${(p) => (p.$active ? "#cfe9ff" : "rgba(232,232,239,0.6)")};
  border: none; padding: 8px 16px; font-size: 12.5px; font-weight: 600; cursor: pointer;
  &:disabled { opacity: 0.5; cursor: default; }
`;
const SaveBtn = styled.button`
  background: rgba(80,220,140,0.16); border: 1px solid rgba(80,220,140,0.4); color: #7ff0b0;
  border-radius: 8px; padding: 8px 16px; font-size: 12.5px; font-weight: 650; cursor: pointer;
  &:disabled { opacity: 0.5; cursor: default; }
`;

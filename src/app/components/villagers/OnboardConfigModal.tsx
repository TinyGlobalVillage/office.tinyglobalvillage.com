"use client";

// OnboardConfigModal — the Onboard Villager tile's gear config (Gio 2026-07-10).
// First lever: AI Template Designer (BETA), a PLATFORM-WIDE three-state flag —
// Off (curated gallery + migration only, everywhere), Beta (admins preview it
// in the public wizard), On (everyone). Off keeps the template surface to the
// hand-curated gallery only.

import { useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb } from "@/app/theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
} from "@/app/styled";
import NeonX from "../NeonX";

type FlagState = "off" | "admin" | "on";

const STATE_LABELS: Record<FlagState, string> = {
  off: "Off",
  admin: "Beta (admins only)",
  on: "On (everyone)",
};

export default function OnboardConfigModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });
  const [state, setState] = useState<FlagState | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/villagers/onboard-config")
      .then((r) => r.json())
      .then((d) => setState((["off", "admin", "on"].includes(d?.aiTemplateDesigner) ? d.aiTemplateDesigner : "on") as FlagState))
      .catch(() => setErr("Couldn't load the config."));
  }, []);

  const save = async (next: FlagState) => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/villagers/onboard-config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aiTemplateDesigner: next }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) { setErr(d?.error ?? `Save failed (HTTP ${res.status}).`); return; }
      setState(next);
    } catch {
      setErr("Save failed — couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="cyan" $maxWidth="30rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle>Onboard Config</ModalTitle>
              <Sub>Levers for the Onboard Villager flow</Sub>
            </div>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <Stack>
            <Card>
              <CardHead>
                AI Template Designer <BetaPill>BETA</BetaPill>
              </CardHead>
              <Note>
                Platform-wide: gates the free-form AI designer in the public wizard&apos;s
                template step. Off keeps the template surface to the hand-curated gallery
                (plus site migration, which is never gated). Beta shows it to admins only.
              </Note>
              {state === null ? (
                <Note>Loading…</Note>
              ) : (
                <Pills>
                  {(Object.keys(STATE_LABELS) as FlagState[]).map((s) => (
                    <Pill key={s} type="button" $on={state === s} disabled={saving} onClick={() => save(s)}>
                      {STATE_LABELS[s]}
                    </Pill>
                  ))}
                </Pills>
              )}
              {err && <ErrText>{err}</ErrText>}
            </Card>
          </Stack>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}

/* ── styles (Villagers modal idiom) ─────────────────────────────────────── */
const Sub = styled.div`font-size: 0.75rem; color: var(--t-textFaint); letter-spacing: 0.04em; margin-top: 0.125rem;`;
const Stack = styled.div`display: flex; flex-direction: column; gap: 1rem;`;
const Card = styled.div`display: flex; flex-direction: column; gap: 0.55rem; padding: 0.85rem 1rem; border: 1px solid rgba(${rgb.cyan}, 0.18); border-radius: 0.625rem; background: rgba(${rgb.cyan}, 0.04);`;
const CardHead = styled.div`display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 700; color: var(--t-text);`;
const BetaPill = styled.span`font-size: 0.6rem; font-weight: 800; letter-spacing: 0.12em; padding: 0.15rem 0.5rem; border-radius: 999px; border: 1px solid rgba(245,158,11,0.5); background: rgba(245,158,11,0.1); color: #f59e0b;`;
const Note = styled.div`font-size: 0.72rem; line-height: 1.5; color: var(--t-textFaint);`;
const Pills = styled.div`display: flex; gap: 0.4rem; flex-wrap: wrap;`;
const Pill = styled.button<{ $on?: boolean }>`
  padding: 0.3rem 0.75rem; font-size: 0.74rem; font-weight: 600; border-radius: 999px; cursor: pointer;
  background: ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.14)` : "transparent")};
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.6)` : "var(--t-border)")};
  color: ${(p) => (p.$on ? colors.cyan : "var(--t-text)")};
  &:hover:not(:disabled) { border-color: rgba(${rgb.cyan}, 0.45); }
  &:disabled { opacity: 0.6; }
`;
const ErrText = styled.div`font-size: 0.75rem; color: ${colors.pink};`;

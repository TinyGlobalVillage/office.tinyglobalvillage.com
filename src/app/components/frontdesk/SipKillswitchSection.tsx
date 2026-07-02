"use client";

// SipKillswitchSection — admin panic-button for the SIP trunk.
// telephony-security Item 5 (2026-05-02). Renders inside SystemToolsModal,
// which is already admin-gated. Hits POST/GET /api/frontdesk/admin/sip-killswitch.
//
// Engaged state: voice OFFLINE (Sofia profiles stopped, UFW denies SIP
// ports). Restored state: voice ONLINE (profiles up, Telnyx allowlisted).
// `gatewayRegistered` reflects whether the Telnyx trunk currently shows
// REGED — useful as a smoke-test indicator after restore.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import { askConfirm } from "../dialogService";

type State = {
  engaged: boolean | null;
  gatewayRegistered: boolean | null;
  raw: string | null;
  busy: boolean;
  error: string | null;
};

const Wrap = styled.div`
  display: flex; flex-direction: column; gap: 0.5rem;
`;

const Row = styled.div`
  display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
`;

const Pill = styled.span<{ $tone: "danger" | "ok" | "muted" }>`
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.25rem 0.6rem;
  font-size: 0.6875rem; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  border-radius: 999px;
  border: 1px solid ${p =>
    p.$tone === "danger" ? `rgba(${rgb.pink}, 0.55)` :
    p.$tone === "ok"     ? `rgba(${rgb.cyan ?? rgb.gold}, 0.55)` :
                           "var(--t-border)"};
  color: ${p =>
    p.$tone === "danger" ? colors.pink :
    p.$tone === "ok"     ? (colors.cyan ?? colors.gold) :
                           "var(--t-textFaint)"};
  background: ${p =>
    p.$tone === "danger" ? `rgba(${rgb.pink}, 0.08)` :
    p.$tone === "ok"     ? `rgba(${rgb.cyan ?? rgb.gold}, 0.08)` :
                           "transparent"};
`;

const Btn = styled.button<{ $variant: "danger" | "primary" }>`
  padding: 0.5rem 0.875rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.75rem; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: all 0.15s;
  background: ${p => p.$variant === "danger" ? `rgba(${rgb.pink}, 0.12)` : `rgba(${rgb.gold}, 0.12)`};
  color: ${p => p.$variant === "danger" ? colors.pink : colors.gold};
  border: 1px solid ${p => p.$variant === "danger" ? `rgba(${rgb.pink}, 0.5)` : `rgba(${rgb.gold}, 0.5)`};
  &:hover:not(:disabled) {
    background: ${p => p.$variant === "danger" ? `rgba(${rgb.pink}, 0.22)` : `rgba(${rgb.gold}, 0.22)`};
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ErrorText = styled.div`
  font-size: 0.75rem; color: ${colors.pink};
  font-family: var(--font-geist-mono), monospace;
`;

const HelpText = styled.div`
  font-size: 0.6875rem;
  color: var(--t-textFaint);
  line-height: 1.5;
`;

export default function SipKillswitchSection() {
  const [state, setState] = useState<State>({
    engaged: null,
    gatewayRegistered: null,
    raw: null,
    busy: false,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState(s => ({ ...s, busy: true, error: null }));
    try {
      const res = await fetch("/api/frontdesk/admin/sip-killswitch", {
        credentials: "same-origin", cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState(s => ({ ...s, busy: false, error: body.error ?? `HTTP ${res.status}` }));
        return;
      }
      const data = await res.json();
      setState({
        engaged: !!data.engaged,
        gatewayRegistered: !!data.gatewayRegistered,
        raw: data.raw ?? null,
        busy: false,
        error: null,
      });
    } catch (err) {
      setState(s => ({ ...s, busy: false, error: (err as Error).message }));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const act = useCallback(async (action: "engage" | "restore") => {
    const verb = action === "engage" ? "ENGAGE the SIP killswitch (voice goes OFFLINE)" : "RESTORE SIP (voice goes back online)";
    if (!(await askConfirm({
      title: "SIP killswitch",
      message: `${verb}?`,
      detail: "This affects all Front Desk calls.",
      confirmLabel: action === "engage" ? "Engage" : "Restore",
    }))) return;
    setState(s => ({ ...s, busy: true, error: null }));
    try {
      const res = await fetch("/api/frontdesk/admin/sip-killswitch", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState(s => ({ ...s, busy: false, error: body.error ?? `HTTP ${res.status}` }));
        return;
      }
      // Refresh state after a brief settle.
      setTimeout(() => refresh(), 1500);
    } catch (err) {
      setState(s => ({ ...s, busy: false, error: (err as Error).message }));
    }
  }, [refresh]);

  const engaged = state.engaged;
  const reged = state.gatewayRegistered;

  return (
    <Wrap>
      <Row>
        {engaged === null ? <Pill $tone="muted">Loading…</Pill>
          : engaged ? <Pill $tone="danger">SIP Killswitch ENGAGED</Pill>
                    : <Pill $tone="ok">SIP Active</Pill>}
        {reged === null ? null
          : reged ? <Pill $tone="ok">Telnyx REGED</Pill>
                  : <Pill $tone="danger">Telnyx UNREGISTERED</Pill>}
      </Row>
      <Row>
        <Btn
          $variant="danger"
          type="button"
          onClick={() => act("engage")}
          disabled={state.busy || engaged === true}
        >
          🔒 Engage Killswitch
        </Btn>
        <Btn
          $variant="primary"
          type="button"
          onClick={() => act("restore")}
          disabled={state.busy || engaged === false}
        >
          🔓 Restore SIP
        </Btn>
        <Btn
          $variant="primary"
          type="button"
          onClick={refresh}
          disabled={state.busy}
        >
          ↻ Refresh
        </Btn>
      </Row>
      {state.error && <ErrorText>Error: {state.error}</ErrorText>}
      <HelpText>
        Engage = stop both Sofia profiles + UFW deny everything (immediate).
        Restore = re-enable Telnyx allowlist + restart profiles. Use Engage
        if you see a SIP scanner attack in the logs or unexpected billing.
      </HelpText>
    </Wrap>
  );
}

"use client";

// DomainConsoleControlModal — the start of the Phase-6 Domain Console admin
// surface on Office Utils. Today it holds ONE control: the platform-wide
// registrar-environment switch (OpenSRS Horizon test vs Live), the equivalent of
// Stripe's test/live mode. Flipping it writes the runtime config every DC host
// reads, so Refusionist's dashboard (and the TGV wizard, and this Office tile)
// all switch at once. Pricing / transfer monitoring / email config land here later.
//
// Not a "security hardening" (no fail2ban/UFW), so it uses a plain modal rather
// than the HardeningControlModal shell.

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
import { askConfirm } from "../dialogService";

type Env = "horizon" | "live";
type Config = { env: Env; updatedAt?: string; updatedBy?: string };

const Sub = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  letter-spacing: 0.04em;
  margin-top: 0.125rem;
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid rgba(${rgb.gold}, 0.18);
  border-radius: 0.625rem;
  background: rgba(${rgb.gold}, 0.04);
`;

const ModeBadge = styled.div<{ $live: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  align-self: flex-start;
  padding: 0.375rem 0.875rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${(p) => (p.$live ? "#ff8585" : "#6ee7a8")};
  background: ${(p) => (p.$live ? "rgba(240,80,80,0.12)" : "rgba(110,231,168,0.12)")};
  border: 1px solid ${(p) => (p.$live ? "rgba(240,80,80,0.5)" : "rgba(110,231,168,0.45)")};
  &::before {
    content: "";
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: ${(p) => (p.$live ? "#ff8585" : "#6ee7a8")};
    box-shadow: 0 0 8px ${(p) => (p.$live ? "#ff8585" : "#6ee7a8")};
  }
`;

const Btns = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.625rem;
`;

const ModeBtn = styled.button<{ $active: boolean; $danger?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  align-items: flex-start;
  text-align: left;
  padding: 0.75rem 0.875rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s;
  color: var(--t-text);
  font-weight: 700;
  border: 1px solid
    ${(p) =>
      p.$active
        ? p.$danger
          ? "rgba(240,80,80,0.65)"
          : "rgba(110,231,168,0.6)"
        : `rgba(${rgb.gold}, 0.22)`};
  background: ${(p) =>
    p.$active
      ? p.$danger
        ? "rgba(240,80,80,0.14)"
        : "rgba(110,231,168,0.12)"
      : "rgba(0,0,0,0.2)"};
  &:hover:not(:disabled) {
    border-color: ${(p) => (p.$danger ? "rgba(240,80,80,0.7)" : `rgba(${rgb.gold}, 0.5)`)};
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  span {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--t-textFaint);
  }
`;

const Note = styled.p`
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.55;
  color: var(--t-textFaint);
`;

const ErrText = styled.div`
  font-size: 0.75rem;
  color: #ff8585;
`;

const Meta = styled.div`
  font-size: 0.6875rem;
  color: var(--t-textFaint);
`;

export default function DomainConsoleControlModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  const [config, setConfig] = useState<Config | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const r = await fetch("/api/admin/domain-console/registrar-env");
      if (!r.ok) {
        setErr(r.status === 403 ? "Admin only." : "Couldn't load the current mode.");
        return;
      }
      setConfig(await r.json());
    } catch {
      setErr("Couldn't load the current mode.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function setEnv(env: Env) {
    setErr(null);
    if (busy || config?.env === env) return;
    if (
      env === "live" &&
      !(await askConfirm({
        title: "Switch to LIVE registrar?",
        message:
          "Switch the WHOLE Domain Console platform to LIVE?\n\nEvery tenant's register/transfer will hit the real registrar — real domains, real money. Only do this once checkout (Phase 4) is ready.",
        confirmLabel: "Switch to LIVE",
      }))
    ) {
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/domain-console/registrar-env", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ env }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j?.error ?? "Couldn't switch the mode.");
        return;
      }
      setConfig(j);
    } catch {
      setErr("Couldn't switch the mode.");
    } finally {
      setBusy(false);
    }
  }

  const env = config?.env;
  const isLive = env === "live";

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="gold" $maxWidth="40rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle>Domain Console</ModalTitle>
              <Sub>Registrar environment — the platform-wide test / live switch</Sub>
            </div>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <Stack>
            <Card>
              {env ? (
                <ModeBadge $live={isLive}>{isLive ? "Live — real domains" : "Test — Horizon sandbox"}</ModeBadge>
              ) : (
                <Meta>Loading…</Meta>
              )}

              <Note>
                OpenSRS has two environments. <strong>Test (Horizon)</strong> exercises the whole pipeline with a
                sandbox balance — no real money, no real domains. <strong>Live</strong> registers and transfers real
                domains and spends real money. This switch governs <strong>every</strong> tenant&apos;s Domain Console
                at once (TGV is registrar-of-record for all of them).
              </Note>

              <Btns>
                <ModeBtn
                  type="button"
                  $active={env === "horizon"}
                  disabled={busy || !env}
                  onClick={() => setEnv("horizon")}
                >
                  Test (Horizon)
                  <span>Safe to practice — fake money</span>
                </ModeBtn>
                <ModeBtn
                  type="button"
                  $active={env === "live"}
                  $danger
                  disabled={busy || !env}
                  onClick={() => setEnv("live")}
                >
                  Live
                  <span>Real domains &amp; real money</span>
                </ModeBtn>
              </Btns>

              {err && <ErrText>{err}</ErrText>}
              {config?.updatedAt && (
                <Meta>
                  Last changed {new Date(config.updatedAt).toLocaleString()}
                  {config.updatedBy ? ` by ${config.updatedBy}` : ""}. Every change is audit-logged.
                </Meta>
              )}
            </Card>
            <Note style={{ opacity: 0.8 }}>
              Pricing, transfer monitoring, and email config will join this panel in a later phase.
            </Note>
          </Stack>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}

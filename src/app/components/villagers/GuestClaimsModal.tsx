"use client";

// GuestClaimsModal — operator surface for the guest→member claim path (F20).
// Lists guest customers (purchases, no account) and issues the one-time
// emailed claim link; redeeming it mints their Keycloak account + members
// row and attaches purchase history. Issuance is audit-logged.

import { useCallback, useEffect, useState } from "react";
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
import { askPrompt } from "../dialogService";

const Sub = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  letter-spacing: 0.04em;
  margin-top: 0.125rem;
`;

const Stack = styled.div`
  display: flex; flex-direction: column; gap: 0.6rem;
`;

const Row = styled.div`
  display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
  background: rgba(0,0,0,0.18);
`;

const Mono = styled.span`
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.75rem;
  color: var(--t-text);
`;

const Faint = styled.span`
  font-size: 0.7rem;
  color: var(--t-textFaint);
`;

const Pill = styled.span<{ $tone: "ok" | "warn" | "muted" }>`
  display: inline-flex; align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.625rem; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  border: 1px solid ${p =>
    p.$tone === "ok" ? `rgba(${rgb.cyan}, 0.5)` :
    p.$tone === "warn" ? `rgba(${rgb.pink}, 0.5)` : "var(--t-border)"};
  color: ${p =>
    p.$tone === "ok" ? colors.cyan :
    p.$tone === "warn" ? colors.pink : "var(--t-textFaint)"};
`;

const SendBtn = styled.button`
  padding: 0.3rem 0.6rem;
  font-size: 0.6875rem; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  cursor: pointer;
  border-radius: 0.375rem;
  background: rgba(${rgb.gold}, 0.12);
  color: ${colors.gold};
  border: 1px solid rgba(${rgb.gold}, 0.5);
  &:hover:not(:disabled) { background: rgba(${rgb.gold}, 0.22); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Note = styled.div`
  font-size: 0.6875rem;
  color: var(--t-textFaint);
  line-height: 1.55;
`;

const ErrorText = styled.div`
  font-size: 0.6875rem; color: ${colors.pink};
  font-family: var(--font-geist-mono), monospace;
`;

type GuestRow = {
  id: string;
  status: string;
  first_purchase_at: string | null;
  created_at: string;
  seller_domain: string | null;
  last_claim_sent_at: string | null;
  claimed_at: string | null;
};

export default function GuestClaimsModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  const [guests, setGuests] = useState<GuestRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/villagers/guest-claims", {
        credentials: "same-origin", cache: "no-store",
      });
      if (!res.ok) { setError(`Load failed (HTTP ${res.status})`); return; }
      setError(null);
      setGuests(((await res.json()).guests ?? []) as GuestRow[]);
    } catch {
      setError("Load failed (network)");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const issue = useCallback(async (g: GuestRow) => {
    const email = await askPrompt({
      title: "Send claim invite",
      message: `Email address for guest customer ${g.id.slice(0, 8)}… — the one-time claim link goes here (the guest's own inbox).`,
      placeholder: "guest@example.com",
      confirmLabel: "Send link",
    });
    if (!email || !email.trim()) return;
    setBusyId(g.id);
    setError(null);
    try {
      const res = await fetch("/api/villagers/guest-claims", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customerId: g.id, email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
      else load();
    } catch {
      setError("Network error");
    } finally {
      setBusyId(null);
    }
  }, [load]);

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="gold" $maxWidth="48rem" onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle>Guest Claims</ModalTitle>
              <Sub>
                Guests who bought without an account. One click emails a one-time claim
                link — redeeming it creates their passkey login and attaches their history.
              </Sub>
            </div>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <Stack>
            {error && <ErrorText>{error}</ErrorText>}
            {guests === null && !error && <Note>Loading guest customers…</Note>}
            {guests?.length === 0 && <Note>No unclaimed guest customers.</Note>}
            {guests?.map(g => (
              <Row key={g.id}>
                <Mono>{g.id.slice(0, 8)}…</Mono>
                {g.seller_domain && <Faint>{g.seller_domain}</Faint>}
                <Faint>
                  first purchase {g.first_purchase_at ? g.first_purchase_at.slice(0, 10) : "—"}
                </Faint>
                {g.claimed_at ? (
                  <Pill $tone="ok">claim redeemed</Pill>
                ) : g.last_claim_sent_at ? (
                  <Pill $tone="muted">link sent {g.last_claim_sent_at.slice(0, 10)}</Pill>
                ) : (
                  <Pill $tone="warn">unclaimed</Pill>
                )}
                <SendBtn disabled={busyId === g.id} onClick={() => issue(g)}>
                  {busyId === g.id ? "Sending…" : g.last_claim_sent_at ? "Resend link" : "Send claim link"}
                </SendBtn>
              </Row>
            ))}
            <Note>
              Links are single-use and expire in 7 days. The claim page never shows the
              full email; the setup email itself carries the passkey ceremony (48h).
            </Note>
          </Stack>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}

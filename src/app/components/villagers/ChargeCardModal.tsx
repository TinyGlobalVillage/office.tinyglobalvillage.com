"use client";

// ChargeCardModal — operator confirm dialog for an ad-hoc PLATFORM charge of a member's saved card.
// Opens only for a CONSENTED card (the parent disables the button otherwise). Collects the amount +
// an optional description, then POSTs to /api/admin/villagers/charge-card (which proxies to tgv.com's
// platform off-session charge). LIVE money: the charge fires immediately and cannot be undone here.
//
// Idempotent: a single nonce per attempt (regenerated after a decline so the operator can retry).
// In-flight the button is disabled so a double-click can't double-charge. No auto-retry.

import { useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
  CloseBtn,
} from "@/app/styled";

const MAX_AMOUNT_CENTS = 100_000; // $1,000 — mirrors the server ceiling (server is authoritative).

type Card = {
  id: string;
  brand: string | null;
  last4: string | null;
  isDefault: boolean;
  chargeAuthorizedAt: string | null;
};

type Props = {
  memberId: string;
  memberName: string;
  card: Card;
  onClose: () => void;
  onCharged: () => void;
};

function newNonce(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `n-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  }
}

export default function ChargeCardModal({ memberId, memberName, card, onClose, onCharged }: Props) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [nonce, setNonce] = useState(newNonce);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ amountCents: number } | null>(null);

  const cents = (() => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return NaN;
    return Math.round(n * 100);
  })();
  const amountValid = Number.isInteger(cents) && cents > 0 && cents <= MAX_AMOUNT_CENTS;

  const submit = async () => {
    if (!amountValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/villagers/charge-card?env=live", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberId,
          paymentMethodId: card.id,
          amountCents: cents,
          description: description.trim() || undefined,
          nonce,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setDone({ amountCents: cents });
        // Let the operator see the success, then refresh + close.
        setTimeout(() => onCharged(), 1100);
        return;
      }
      // Decline / failure — surface the reason, regenerate the nonce so a retry is a fresh attempt.
      const reason =
        d.message ||
        (d.error === "not_authorized"
          ? "This card is no longer authorized for charges."
          : d.error === "charge_declined"
            ? "The card was declined."
            : d.error || `Charge failed (HTTP ${res.status}).`);
      setError(reason);
      setNonce(newNonce());
      setSubmitting(false);
    } catch {
      setError("Couldn't reach the charge service. Try again.");
      setNonce(newNonce());
      setSubmitting(false);
    }
  };

  const brandLabel = `${card.brand ?? "Card"} ···· ${card.last4 ?? "****"}`;

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer
        $accent="gold"
        $maxWidth="30rem"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="charge-card-title"
      >
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle id="charge-card-title" $color={colors.gold ?? "#ffce6d"}>
              Charge saved card
            </ModalTitle>
          </ModalHeaderLeft>
          <CloseBtn onClick={onClose} aria-label="Close">×</CloseBtn>
        </ModalHeader>
        <ModalBody>
          {done ? (
            <DoneBox>
              Charged ${(done.amountCents / 100).toFixed(2)} to {brandLabel}.
            </DoneBox>
          ) : (
            <>
              <CardLine>
                <strong>{brandLabel}</strong>
                {card.isDefault && <Tag>DEFAULT</Tag>}
                <Tag $ok>AUTHORIZED</Tag>
              </CardLine>
              <Who>
                {memberName} · authorized{" "}
                {card.chargeAuthorizedAt
                  ? new Date(card.chargeAuthorizedAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : ""}
              </Who>

              <Field>
                <Label htmlFor="charge-amount">Amount (USD)</Label>
                <AmountWrap>
                  <Prefix>$</Prefix>
                  <AmountInput
                    id="charge-amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max={(MAX_AMOUNT_CENTS / 100).toString()}
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    autoFocus
                  />
                </AmountWrap>
                <Hint>Max ${(MAX_AMOUNT_CENTS / 100).toFixed(0)} per charge.</Hint>
              </Field>

              <Field>
                <Label htmlFor="charge-desc">Description (optional)</Label>
                <TextInput
                  id="charge-desc"
                  type="text"
                  maxLength={200}
                  placeholder="e.g. Custom work — June"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>

              {error && <ErrBox>{error}</ErrBox>}

              <Warn>
                This charges the member’s card immediately on the platform account, using their stored
                authorization. It cannot be undone here.
              </Warn>

              <Footer>
                <GhostBtn onClick={onClose} disabled={submitting}>
                  Cancel
                </GhostBtn>
                <ChargeBtn onClick={submit} disabled={!amountValid || submitting}>
                  {submitting
                    ? "Charging…"
                    : amountValid
                      ? `Charge $${(cents / 100).toFixed(2)}`
                      : "Charge"}
                </ChargeBtn>
              </Footer>
            </>
          )}
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}

// ── styles ─────────────────────────────────────────────────────────────────────
const CardLine = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  letter-spacing: 0.03em;
  color: var(--t-text);
`;
const Tag = styled.span<{ $ok?: boolean }>`
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: ${(p) => (p.$ok ? "rgba(16,185,129,0.2)" : `rgba(${rgb.gold}, 0.2)`)};
  color: ${(p) => (p.$ok ? "#34d399" : colors.gold ?? "#ffce6d")};
`;
const Who = styled.div`
  margin-top: 0.35rem;
  font-size: 0.72rem;
  color: var(--t-textFaint);
`;
const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 1rem;
`;
const Label = styled.label`
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--t-textFaint);
`;
const AmountWrap = styled.div`
  display: flex;
  align-items: center;
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
  background: var(--t-inputBg);
  overflow: hidden;
`;
const Prefix = styled.span`
  padding: 0 0.6rem;
  font-size: 0.95rem;
  color: var(--t-textFaint);
`;
const AmountInput = styled.input`
  flex: 1;
  appearance: none;
  border: none;
  background: transparent;
  padding: 0.55rem 0.6rem 0.55rem 0;
  font-size: 0.95rem;
  color: var(--t-text);
  &:focus {
    outline: none;
  }
`;
const TextInput = styled.input`
  appearance: none;
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
  background: var(--t-inputBg);
  padding: 0.55rem 0.6rem;
  font-size: 0.88rem;
  color: var(--t-text);
  &:focus {
    outline: none;
    border-color: rgba(${rgb.gold}, 0.5);
  }
`;
const Hint = styled.span`
  font-size: 0.68rem;
  color: var(--t-textFaint);
`;
const ErrBox = styled.div`
  margin-top: 0.85rem;
  padding: 0.55rem 0.7rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(${rgb.pink}, 0.4);
  background: rgba(${rgb.pink}, 0.1);
  font-size: 0.8rem;
  color: ${colors.pink};
`;
const Warn = styled.div`
  margin-top: 0.85rem;
  font-size: 0.72rem;
  line-height: 1.5;
  color: var(--t-textFaint);
`;
const DoneBox = styled.div`
  padding: 0.6rem 0.2rem;
  font-size: 0.92rem;
  color: #34d399;
`;
const Footer = styled.div`
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
  margin-top: 1.25rem;
`;
const GhostBtn = styled.button`
  appearance: none;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.55rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--t-border);
  background: transparent;
  color: var(--t-text);
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;
const ChargeBtn = styled.button`
  appearance: none;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 0.55rem 1.1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(${rgb.gold}, 0.5);
  background: rgba(${rgb.gold}, 0.14);
  color: ${colors.gold ?? "#ffce6d"};
  transition: background 0.15s ease;
  &:hover:not(:disabled) {
    background: rgba(${rgb.gold}, 0.24);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

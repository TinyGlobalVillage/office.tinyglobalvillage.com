"use client";

// WalletControlModal — the operator SAFETY console for member cash-out (withdrawals). Phase 7 of
// the 3-bucket wallet feature; a System-Hardening tile (Utils → Hardening).
//
// Withdrawals are an irreversible money-OUT path, so per CLAUDE.md §"Hardening UTILS Surfaces" the
// operator must always SEE the posture and be able to PAUSE + tune the fraud limits.
//
// TWO-KEY LIVE GATE — withdrawals are LIVE only when BOTH:
//   • the env launch flag WITHDRAWALS_ENABLED (redeploy-bound; NOT editable here), AND
//   • the runtime killswitch config.enabled (editable here — the no-redeploy day-to-day pause).
//
// This modal owns the POSTURE: it drives key #2 + the fraud limits (config writes proxy to tgv.com's
// engine, which normalizes + audits) and renders the wallet activity timeline from the shared
// tgv_db. The live cash-out QUEUE + its transitions (approve/pay/release/fail/cancel) moved to the
// Villagers → Payouts tile (PayoutsModal) — the operations surface — so the queue isn't duplicated
// across two tiles. This console is where you PREPARE and watch; Payouts is where you act.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb } from "@/app/theme";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";

export type WalletControlModalProps = { onClose: () => void };

type Rail = "operator_advance" | "stripe_payout";

type WithdrawalConfig = {
  enabled: boolean;
  rail: Rail;
  maxPerPeriodTokens: number;
  periodDays: number;
  perRequestMaxTokens: number;
  minTokens: number;
  cooldownHours: number;
  holdHours: number;
  offerInstant: boolean;
  instantFeeBps: number;
  requireVerifiedIdentity: boolean;
};

type Gate = { launchEnabled: boolean; killswitchEnabled: boolean; live: boolean };

// numeric fraud-limit fields that share the "0 = unlimited/none" coercion
type NumKey =
  | "maxPerPeriodTokens"
  | "periodDays"
  | "perRequestMaxTokens"
  | "minTokens"
  | "cooldownHours"
  | "holdHours"
  | "instantFeeBps";

const LIMIT_KEYS: (keyof WithdrawalConfig)[] = [
  "rail",
  "maxPerPeriodTokens",
  "periodDays",
  "perRequestMaxTokens",
  "minTokens",
  "cooldownHours",
  "holdHours",
  "offerInstant",
  "instantFeeBps",
  "requireVerifiedIdentity",
];

export default function WalletControlModal({ onClose }: WalletControlModalProps) {
  useEscapeToClose({ open: true, onClose });

  const [config, setConfig] = useState<WithdrawalConfig | null>(null);
  const [form, setForm] = useState<WithdrawalConfig | null>(null);
  const [gate, setGate] = useState<Gate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Per-path feedback so a killswitch save can't show a "saved"/error banner on the limits form.
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [gateErr, setGateErr] = useState<string | null>(null);
  const [limitsErr, setLimitsErr] = useState<string | null>(null);
  const [limitsSavedTick, setLimitsSavedTick] = useState(0);

  const loadConfig = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch("/api/admin/wallet/config", { cache: "no-store", signal });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? "config_load_failed");
    setConfig(d.config);
    setForm(d.config);
    setGate(d.gate);
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      await loadConfig(signal);
      setLoadErr(null);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return; // modal closed mid-load — ignore
      setLoadErr("Couldn't load the withdrawal config from tgv.com.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [loadConfig]);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const save = useCallback(async (patch: Partial<WithdrawalConfig>): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/wallet/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "save_failed");
      setConfig(d.config);
      setForm(d.config);
      setGate(d.gate);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  // Killswitch saves immediately — an operator pausing cash-out can't wait for a form submit.
  // Its own gateErr keeps a failure under the killswitch, not the limits form.
  const toggleKillswitch = async (v: boolean) => {
    setGateErr(null);
    const ok = await save({ enabled: v });
    if (!ok) setGateErr("Couldn't save — the change did NOT take effect.");
  };

  const saveLimits = async () => {
    if (!form) return;
    setLimitsErr(null);
    const ok = await save({
      rail: form.rail,
      maxPerPeriodTokens: form.maxPerPeriodTokens,
      periodDays: form.periodDays,
      perRequestMaxTokens: form.perRequestMaxTokens,
      minTokens: form.minTokens,
      cooldownHours: form.cooldownHours,
      holdHours: form.holdHours,
      offerInstant: form.offerInstant,
      instantFeeBps: form.instantFeeBps,
      requireVerifiedIdentity: form.requireVerifiedIdentity,
    });
    if (ok) setLimitsSavedTick((t) => t + 1);
    else setLimitsErr("Couldn't save — the change did NOT take effect.");
  };

  const setNum = (k: NumKey) => (e: { target: { value: string } }) =>
    setForm((f) => (f ? { ...f, [k]: Math.max(0, Math.floor(Number(e.target.value) || 0)) } : f));

  const limitsDirty =
    !!config && !!form && LIMIT_KEYS.some((k) => config[k] !== form[k]);

  const stripeRail = form?.rail === "stripe_payout";

  /* ── sections ─────────────────────────────────────────────────────────── */
  const sections: HCMSection[] = [];

  // 1) Live gate + killswitch — the headline control.
  sections.push({
    id: "gate",
    title: "Live Gate & Killswitch",
    qmbm:
      "Member cash-out is an irreversible money-OUT path, so it sits behind TWO independent keys " +
      "— it is LIVE only when BOTH are on:\n\n" +
      "• LAUNCH FLAG (env WITHDRAWALS_ENABLED) — the deploy-bound master switch. It stays OFF " +
      "until identity (KYC) + clawback ship. It is NOT editable here (it needs a redeploy on " +
      "purpose, so a launch can't happen by a single click).\n\n" +
      "• KILLSWITCH (config.enabled) — the runtime, no-redeploy pause you control here. Flip it " +
      "off any time to instantly stop new cash-outs during a fraud event.\n\n" +
      "While the launch flag is OFF, turning the killswitch on does nothing on its own — both " +
      "keys are required.",
    body: (
      <PanelBody>
        {gate && (
          <GateBanner>
            <LivePill $live={gate.live}>
              {gate.live ? "WITHDRAWALS LIVE" : "WITHDRAWALS OFF"}
            </LivePill>
            <KeyChips>
              <KeyChip $on={gate.launchEnabled} title="env WITHDRAWALS_ENABLED — redeploy-bound, not editable here">
                Launch flag: {gate.launchEnabled ? "ON" : "OFF"} <Lock>· redeploy-bound</Lock>
              </KeyChip>
              <KeyChip $on={gate.killswitchEnabled} title="config.enabled — runtime killswitch, editable below">
                Killswitch: {gate.killswitchEnabled ? "ON" : "OFF"}
              </KeyChip>
            </KeyChips>
          </GateBanner>
        )}
        <FieldRow>
          <FieldMain>
            <FieldLabel>Operator killswitch</FieldLabel>
            <FieldHelp>
              Runtime pause for cash-out — no redeploy. Off = new withdrawals are refused immediately.
              {gate && !gate.launchEnabled && " (Launch flag is off, so withdrawals stay off regardless.)"}
            </FieldHelp>
          </FieldMain>
          <GoldSwitch
            on={!!form?.enabled}
            disabled={saving || loading || !form}
            onChange={toggleKillswitch}
          />
        </FieldRow>
        {(gateErr || loadErr) && <ErrLine>{gateErr ?? loadErr}</ErrLine>}
      </PanelBody>
    ),
  });

  // 2) Fraud limits — batched editor.
  sections.push({
    id: "limits",
    title: "Fraud Limits & Payout Rail",
    qmbm:
      "Blast-radius levers for cash-out. They are live regardless of the killswitch, so you can " +
      "pre-set safe limits BEFORE launch. 0 means unlimited / none for the cap and ceiling " +
      "fields. 1 token = $0.25.\n\n" +
      "The payout RAIL is the executor seam: 'operator_advance' = an operator pays out manually " +
      "and records an external reference; 'stripe_payout' is the automated platform-balance " +
      "payout engine — a STUB until payments-platform Phase 3, so the instant-payout fields stay " +
      "inert until it lands.\n\n" +
      "The fraud-review HOLD is enforced on the Payouts queue: a request can't be marked paid " +
      "until this many hours after it was requested (an operator can override per-request with " +
      "'Release now' for a trusted member, which is audited as an early release).",
    body: form ? (
      <PanelBody>
        <FieldRow>
          <FieldMain>
            <FieldLabel>Payout rail</FieldLabel>
            <FieldHelp>How a paid withdrawal is executed. stripe_payout is not built yet (throws on use).</FieldHelp>
          </FieldMain>
          <Select
            value={form.rail}
            onChange={(e) => setForm((f) => (f ? { ...f, rail: e.target.value as Rail } : f))}
          >
            <option value="operator_advance">operator_advance (manual)</option>
            <option value="stripe_payout">stripe_payout (stub — not built)</option>
          </Select>
        </FieldRow>

        <NumField
          label="Per-period cap (tokens)"
          help="Max total tokens withdrawn across the rolling window below. 0 = unlimited."
          value={form.maxPerPeriodTokens}
          onChange={setNum("maxPerPeriodTokens")}
        />
        <NumField
          label="Period window (days)"
          help="The rolling window the per-period cap is measured over. Minimum 1 day."
          value={form.periodDays}
          onChange={setNum("periodDays")}
        />
        <NumField
          label="Per-request ceiling (tokens)"
          help="Largest single withdrawal allowed. 0 = unlimited."
          value={form.perRequestMaxTokens}
          onChange={setNum("perRequestMaxTokens")}
        />
        <NumField
          label="Minimum per withdrawal (tokens)"
          help="Floor per withdrawal. 0 = no minimum (intrinsic floor is 1 token = $0.25)."
          value={form.minTokens}
          onChange={setNum("minTokens")}
        />
        <NumField
          label="Cooldown between requests (hours)"
          help="Throttle between a member's successive requests. 0 = none."
          value={form.cooldownHours}
          onChange={setNum("cooldownHours")}
        />
        <NumField
          label="Fraud-review hold (hours)"
          help="Window after a request before it can be marked paid (override per-request via Payouts → Release now). 0 = none."
          value={form.holdHours}
          onChange={setNum("holdHours")}
        />

        <FieldRow>
          <FieldMain>
            <FieldLabel>Require verified identity (KYC)</FieldLabel>
            <FieldHelp>
              Refuse withdrawals from unverified identities. Keep ON until identity verification ships
              (the check is a stub that returns false, so this currently blocks all withdrawals).
            </FieldHelp>
          </FieldMain>
          <GoldSwitch
            on={form.requireVerifiedIdentity}
            disabled={saving}
            onChange={(v) => setForm((f) => (f ? { ...f, requireVerifiedIdentity: v } : f))}
          />
        </FieldRow>

        <FieldRow $muted={!stripeRail}>
          <FieldMain>
            <FieldLabel>Offer instant payout</FieldLabel>
            <FieldHelp>
              Expose the instant-payout tier (a Stripe instant-payout fee path). Inert until the
              stripe_payout rail is built.
            </FieldHelp>
          </FieldMain>
          <GoldSwitch
            on={form.offerInstant}
            disabled={saving}
            onChange={(v) => setForm((f) => (f ? { ...f, offerInstant: v } : f))}
          />
        </FieldRow>
        <NumField
          muted={!stripeRail}
          label="Instant payout fee (basis points)"
          help="e.g. 150 = 1.5%. Clamped to 0–10000. Inert until the stripe_payout rail."
          value={form.instantFeeBps}
          onChange={setNum("instantFeeBps")}
        />

        <SaveRow>
          <SaveBtn type="button" onClick={saveLimits} disabled={saving || !limitsDirty}>
            {saving ? "Saving…" : limitsDirty ? "Save limits" : "Saved"}
          </SaveBtn>
          {limitsDirty && (
            <ResetBtn type="button" onClick={() => setForm(config)} disabled={saving}>
              Discard
            </ResetBtn>
          )}
          {limitsSavedTick > 0 && !limitsDirty && !saving && <Dim>✓ applied — no redeploy needed</Dim>}
          {limitsErr && <ErrLine>{limitsErr}</ErrLine>}
        </SaveRow>
      </PanelBody>
    ) : (
      <Dim>Loading…</Dim>
    ),
  });

  return (
    <HardeningControlModal
      title="Wallet Cash-Out"
      subtitle="Cash-out safety posture — killswitch, fraud limits, and audit. The live queue lives in Villagers → Payouts."
      qmbm={
        "What is this?\n\n" +
        "The operator SAFETY console for member cash-out (turning wallet tokens into real money out). " +
        "Withdrawals are irreversible money-out, so they sit behind a two-key gate (a deploy-bound " +
        "launch flag + a runtime killswitch) and a set of fraud limits you tune here.\n\n" +
        "Right now your job is to PREPARE: pre-set the limits and confirm the killswitch posture " +
        "before launch. Cash-out stays OFF until identity verification and clawback land — do not " +
        "expect the launch flag to be on yet.\n\n" +
        "Working the actual payout queue (approve / pay / release / cancel) happens on the " +
        "Villagers → Payouts tile; this console owns the posture + the activity timeline."
      }
      onClose={onClose}
      sections={sections}
      auditLogView={
        <AuditLogTimeline
          endpoint="/api/admin/wallet/audit-feed"
          kinds={[
            "wallet.withdrawal_config_update",
            "wallet.withdrawal_approve",
            "wallet.withdrawal_paid",
            "wallet.withdrawal_released",
            "wallet.withdrawal_failed",
            "wallet.withdrawal_cancel",
          ]}
        />
      }
    />
  );
}

/* ── small field render helper (local to this modal — not a shared component) ─ */
function NumField({
  label,
  help,
  value,
  onChange,
  muted,
}: {
  label: string;
  help: string;
  value: number;
  onChange: (e: { target: { value: string } }) => void;
  muted?: boolean;
}) {
  return (
    <FieldRow $muted={muted}>
      <FieldMain>
        <FieldLabel>{label}</FieldLabel>
        <FieldHelp>{help}</FieldHelp>
      </FieldMain>
      <NumInput type="number" min={0} value={value} onChange={onChange} />
    </FieldRow>
  );
}

/* ── Lightswitch toggle (mirror Invitations GoldSwitch) ───────────────────── */
function GoldSwitch({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <LSTrack
      type="button"
      $on={on}
      disabled={disabled}
      aria-pressed={on}
      title={on ? "On — click to turn off" : "Off — click to turn on"}
      onClick={() => onChange(!on)}
    >
      <LSKnob $on={on} />
    </LSTrack>
  );
}

/* ── styles (mirror InvitationsControlModal) ──────────────────────────────── */

const PanelBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  font-size: 0.8rem;
  color: var(--t-text);
`;

const GateBanner = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid rgba(${rgb.gold}, 0.2);
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.25);
`;

const LivePill = styled.span<{ $live: boolean }>`
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  color: ${(p) => (p.$live ? "#4ade80" : colors.pink)};
  border: 1px solid ${(p) => (p.$live ? "#4ade80" : colors.pink)};
  background: ${(p) => (p.$live ? "#4ade8019" : `rgba(${rgb.pink}, 0.1)`)};
`;

const KeyChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`;

const KeyChip = styled.span<{ $on: boolean }>`
  font-size: 0.68rem;
  padding: 0.2rem 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.5)` : "var(--t-border)")};
  color: ${(p) => (p.$on ? colors.cyan : "var(--t-textFaint)")};
  background: ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.08)` : "transparent")};
`;

const Lock = styled.span`
  color: var(--t-textFaint);
  font-size: 0.62rem;
`;

const FieldRow = styled.div<{ $muted?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid rgba(${rgb.gold}, 0.08);
  opacity: ${(p) => (p.$muted ? 0.5 : 1)};
`;

const FieldMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
`;

const FieldLabel = styled.span`
  font-size: 0.78rem;
  color: var(--t-text);
  font-weight: 600;
`;

const FieldHelp = styled.span`
  font-size: 0.68rem;
  color: var(--t-textFaint);
  line-height: 1.35;
`;

const NumInput = styled.input`
  flex: 0 0 7rem;
  width: 7rem;
  text-align: right;
  padding: 0.4rem 0.55rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--t-border);
  border-radius: 0.375rem;
  color: var(--t-text);
  font-size: 0.78rem;
  &:focus {
    outline: none;
    border-color: rgba(${rgb.cyan}, 0.6);
  }
`;

const Select = styled.select`
  flex: 0 0 14rem;
  padding: 0.4rem 0.55rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--t-border);
  border-radius: 0.375rem;
  color: var(--t-text);
  font-size: 0.78rem;
  &:focus {
    outline: none;
    border-color: rgba(${rgb.cyan}, 0.6);
  }
`;

const SaveRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding-top: 0.4rem;
`;

const SaveBtn = styled.button`
  background: rgba(${rgb.cyan}, 0.14);
  border: 1px solid rgba(${rgb.cyan}, 0.55);
  color: ${colors.cyan};
  padding: 0.45rem 0.95rem;
  border-radius: 0.4rem;
  font-size: 0.8rem;
  cursor: pointer;
  &:hover:not(:disabled) {
    background: rgba(${rgb.cyan}, 0.24);
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const ResetBtn = styled.button`
  background: transparent;
  border: 1px solid var(--t-border);
  color: var(--t-textFaint);
  padding: 0.45rem 0.75rem;
  border-radius: 0.4rem;
  font-size: 0.78rem;
  cursor: pointer;
  &:hover:not(:disabled) {
    border-color: ${colors.pink};
    color: ${colors.pink};
  }
`;

const ErrLine = styled.div`
  font-size: 0.75rem;
  color: ${colors.pink};
`;

const Dim = styled.span`
  color: var(--t-textFaint);
`;

const LSTrack = styled.button<{ $on: boolean }>`
  position: relative;
  flex: 0 0 auto;
  width: 38px;
  height: 20px;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.7)` : "var(--t-border)")};
  background: ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.25)` : "rgba(0,0,0,0.4)")};
  cursor: pointer;
  padding: 0;
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const LSKnob = styled.span<{ $on: boolean }>`
  position: absolute;
  top: 1px;
  left: ${(p) => (p.$on ? "19px" : "1px")};
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: ${(p) => (p.$on ? colors.cyan : "var(--t-textFaint)")};
  transition: left 0.15s;
`;

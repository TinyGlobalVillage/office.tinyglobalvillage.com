"use client";

// Telephony-specific panels for the Telephony hardening modal.
//
// Each panel is small + focused; together with the shared Fail2banGlobalView
// + UfwGlobalView + AuditLogTimeline they form the complete Telephony
// hardening surface. Future hardening modals will follow the same shape:
// a few hardening-specific panels here + the shared global views.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import SipKillswitchSection from "@/app/components/frontdesk/SipKillswitchSection";

// ── Shared styled bits ────────────────────────────────────────────────────

const Row = styled.div`
  display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
`;

const StatusPill = styled.span<{ $tone: "ok" | "warn" | "muted" }>`
  display: inline-flex; align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 1px solid ${p =>
    p.$tone === "ok" ? `rgba(${rgb.cyan}, 0.5)` :
    p.$tone === "warn" ? `rgba(${rgb.pink}, 0.5)` :
    "var(--t-border)"};
  color: ${p =>
    p.$tone === "ok" ? colors.cyan :
    p.$tone === "warn" ? colors.pink :
    "var(--t-textFaint)"};
  background: ${p =>
    p.$tone === "ok" ? `rgba(${rgb.cyan}, 0.08)` :
    p.$tone === "warn" ? `rgba(${rgb.pink}, 0.08)` :
    "transparent"};
`;

const Label = styled.span`
  font-size: 0.75rem;
  color: var(--t-textFaint);
`;

const NumberInput = styled.input`
  width: 7rem;
  padding: 0.3rem 0.5rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.75rem;
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--t-border);
  border-radius: 0.375rem;
  color: var(--t-text);
  &:focus { outline: none; border-color: rgba(${rgb.gold}, 0.5); }
`;

const SaveBtn = styled.button`
  padding: 0.3rem 0.6rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
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

// ── Telephony status (status snapshot panel) ──────────────────────────────

type TelephonyStatus = {
  dialplanAuthGate: boolean;
  consentIvrWavExists: boolean;
  gpgKeyringExists: boolean;
  telnyxBillingConfigured: boolean;
  gatewayRegistered: boolean;
  gatewayContact: string | null;
  attackWatchState: { lastAlertedAt: string | null } | null;
  config: {
    ringingRateLimitMs: number;
    attackWatchThreshold: number;
    attackWatchCooldownMs: number;
  };
};

export function ProtectionStackPanel({ status }: { status: TelephonyStatus | null }) {
  if (!status) return <Note>Loading status…</Note>;
  return (
    <Row>
      <StatusPill $tone={status.gatewayRegistered ? "ok" : "warn"}>
        Telnyx {status.gatewayRegistered ? "REGED" : "DEREG"}
      </StatusPill>
      <StatusPill $tone={status.dialplanAuthGate ? "ok" : "warn"}>
        Auth gate {status.dialplanAuthGate ? "live" : "off"}
      </StatusPill>
      <StatusPill $tone={status.consentIvrWavExists ? "ok" : "warn"}>
        Consent IVR {status.consentIvrWavExists ? "wav present" : "MISSING"}
      </StatusPill>
      <StatusPill $tone={status.gpgKeyringExists ? "ok" : "warn"}>
        Recording {status.gpgKeyringExists ? "GPG key present" : "encryption KEY MISSING"}
      </StatusPill>
      <StatusPill $tone={status.telnyxBillingConfigured ? "ok" : "muted"}>
        Telnyx pubkey {status.telnyxBillingConfigured ? "configured" : "missing"}
      </StatusPill>
    </Row>
  );
}

// ── Killswitch panel ──────────────────────────────────────────────────────

export function KillswitchPanel() {
  // Reuses the existing SipKillswitchSection component; identical UX to
  // System Tools modal so the operator sees the same controls everywhere.
  return <SipKillswitchSection />;
}

// ── Dialplan auth gate (read-only) ────────────────────────────────────────

export function DialplanGatePanel({ status }: { status: TelephonyStatus | null }) {
  return (
    <div>
      <Row>
        <StatusPill $tone={status?.dialplanAuthGate ? "ok" : "warn"}>
          {status?.dialplanAuthGate ? "Active on user 1001" : "Not configured"}
        </StatusPill>
      </Row>
      <Note style={{ marginTop: "0.4rem" }}>
        Read-only by design. <code>sip_authorized=true</code> lives in
        <code> telephony/users/1001.xml</code>. Toggling it via UI would be
        a one-edit way to lose the toll-fraud gate; edits go through
        version-controlled XML + <code>render-config.sh</code>.
      </Note>
    </div>
  );
}

// ── Ringing rate-limit (editable) ─────────────────────────────────────────

export function RingingRateLimitPanel({
  status, onSave,
}: {
  status: TelephonyStatus | null;
  onSave: () => void;
}) {
  const [val, setVal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (status) setVal(status.config.ringingRateLimitMs);
  }, [status]);

  const save = useCallback(async () => {
    if (val === null) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/frontdesk/admin/telephony/config", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ringingRateLimitMs: val }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setErr(b.error ?? `HTTP ${res.status}`);
        return;
      }
      onSave();
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }, [val, onSave]);

  return (
    <div>
      <Row>
        <Label>Window:</Label>
        <NumberInput
          type="number" min={1000} max={300000} step={1000}
          value={val ?? ""}
          onChange={e => setVal(Number(e.target.value))}
          disabled={busy}
        />
        <Label>ms (1000–300000)</Label>
        <SaveBtn type="button" onClick={save} disabled={busy || val === null}>Save</SaveBtn>
      </Row>
      {err && <ErrorText>{err}</ErrorText>}
      <Note style={{ marginTop: "0.4rem" }}>
        How long a "ringing" inbound CDR record blocks duplicates from the
        same origin. Defends against SIP-flood spawning thousands of zombie
        records. <strong>Default 30 000 ms</strong>; lower if legitimate
        repeat calls from the same caller need to be distinguishable, higher
        if you see repeat-zombie symptoms.
      </Note>
    </div>
  );
}

// ── SIP Attack Watch tunable (editable) ───────────────────────────────────

export function AttackWatchPanel({
  status, onSave,
}: {
  status: TelephonyStatus | null;
  onSave: () => void;
}) {
  const [threshold, setThreshold] = useState<number | null>(null);
  const [cooldown, setCooldown] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (status) {
      setThreshold(status.config.attackWatchThreshold);
      setCooldown(status.config.attackWatchCooldownMs);
    }
  }, [status]);

  const save = useCallback(async () => {
    if (threshold === null || cooldown === null) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/frontdesk/admin/telephony/config", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attackWatchThreshold: threshold,
          attackWatchCooldownMs: cooldown,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setErr(b.error ?? `HTTP ${res.status}`);
        return;
      }
      onSave();
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }, [threshold, cooldown, onSave]);

  return (
    <div>
      <Row>
        <Label>Threshold:</Label>
        <NumberInput
          type="number" min={1} max={10000}
          value={threshold ?? ""}
          onChange={e => setThreshold(Number(e.target.value))}
          disabled={busy}
        />
        <Label>INVITEs per 5min</Label>
      </Row>
      <Row style={{ marginTop: "0.4rem" }}>
        <Label>Cooldown:</Label>
        <NumberInput
          type="number" min={60000} max={86400000} step={60000}
          value={cooldown ?? ""}
          onChange={e => setCooldown(Number(e.target.value))}
          disabled={busy}
        />
        <Label>ms (1min–24h)</Label>
        <SaveBtn type="button" onClick={save} disabled={busy}>Save</SaveBtn>
      </Row>
      {status?.attackWatchState?.lastAlertedAt && (
        <Note style={{ marginTop: "0.4rem" }}>
          Last alert fired: {new Date(status.attackWatchState.lastAlertedAt).toLocaleString()}
        </Note>
      )}
      {err && <ErrorText>{err}</ErrorText>}
      <Note style={{ marginTop: "0.4rem" }}>
        The <code>sip-attack-watch</code> cron tails the FreeSWITCH log every
        5 min. When non-Telnyx INVITEs in that window exceed the threshold,
        it broadcasts a Front Desk announcement. Cooldown prevents spam
        during a sustained attack — one alert per cooldown window.
      </Note>
    </div>
  );
}

// ── Telnyx alerts panel (read-only status + portal pointer) ───────────────

export function TelnyxAlertsPanel({ status }: { status: TelephonyStatus | null }) {
  return (
    <div>
      <Row>
        <StatusPill $tone={status?.telnyxBillingConfigured ? "ok" : "muted"}>
          Webhook public key {status?.telnyxBillingConfigured ? "configured" : "missing"}
        </StatusPill>
      </Row>
      <Note style={{ marginTop: "0.4rem", lineHeight: 1.6 }}>
        Telnyx security alerts are EMAIL-ONLY (Telnyx limitation —
        <code> Suspicious Outbound Voice Traffic</code>,{" "}
        <code>Low Available Credit</code>,{" "}
        <code>Auto-Recharge Failure</code>, etc. don&apos;t support webhook).
        Configure in Telnyx Mission Control →{" "}
        <strong>Account → Advanced Features → Notifications</strong>:
        <ol style={{ margin: "0.4rem 0 0 1.25rem", padding: 0 }}>
          <li>Email Channel → <code>gio@tinyglobalvillage.com</code></li>
          <li>Profile <code>TGV ops — security email</code> → contains the email channel</li>
          <li>Settings → 8 events: Suspicious Outbound Voice Traffic, Low Available Credit, Auto-Recharge Failure, Account Disabled Due to Insufficient Balance, Send Short Duration Calls Surcharge Notification, Send Abandoned Calls Surcharge Notification, AIT Traffic Activity, Payment Success and Failure</li>
        </ol>
        The webhook channel + endpoint at{" "}
        <code>/api/frontdesk/admin/telnyx-billing-alert</code> stays available
        for operational events (Number Order, Port In/Out, etc.) when those
        get added later.
      </Note>
    </div>
  );
}

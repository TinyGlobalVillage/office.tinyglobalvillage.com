"use client";

// TelephonyControlModal — the Telephony hardening surface, composed from
// the HardeningControlModal shell + shared global views (fail2ban, ufw,
// audit log) + telephony-specific panels.
//
// Pattern: this is the canonical example of the "Hardening UTILS Surfaces"
// rule (~/.claude/CLAUDE.md). Future hardenings (postgres, ssh, nginx, …)
// follow the same shape: import HardeningControlModal + the _shared/
// global views, define their own panels, register on Utils.

import { useCallback, useEffect, useState } from "react";
import HardeningControlModal, {
  type HCMSection,
} from "../HardeningControlModal";
import Fail2banGlobalView from "../_shared/Fail2banGlobalView";
import UfwGlobalView from "../_shared/UfwGlobalView";
import AuditLogTimeline from "../_shared/AuditLogTimeline";
import {
  ProtectionStackPanel,
  KillswitchPanel,
  DialplanGatePanel,
  RingingRateLimitPanel,
  AttackWatchPanel,
  TelnyxAlertsPanel,
} from "./TelephonyPanels";

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

const TELEPHONY_JAIL = "freeswitch-toll-fraud";

function isTelephonyUfwRule(rule: { to: string; comment: string | null; from: string }): boolean {
  // Highlight rules that touch SIP ports or Telnyx ranges.
  if (/^5060/.test(rule.to) || /^5080/.test(rule.to)) return true;
  if (/192\.76\.120\./.test(rule.from)) return true;
  if (rule.comment && /SIP|Telnyx|KILLSWITCH/i.test(rule.comment)) return true;
  return false;
}

export type TelephonyControlModalProps = {
  onClose: () => void;
};

export default function TelephonyControlModal({ onClose }: TelephonyControlModalProps) {
  const [status, setStatus] = useState<TelephonyStatus | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/frontdesk/admin/telephony/status", {
        credentials: "same-origin", cache: "no-store",
      });
      if (!res.ok) return;
      setStatus(await res.json());
    } catch { /* swallow — modal renders with prior or null status */ }
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const sections: HCMSection[] = [
    {
      id: "stack",
      title: "Protection Stack",
      qmbm:
        "Seven defense layers, ordered from network → application:\n" +
        "1. UFW firewall — only Telnyx SBC range can reach 5080/udp; 5060 loopback-only.\n" +
        "2. fail2ban-toll-fraud jail — auto-bans non-Telnyx senders after 3 hits / 10min.\n" +
        "3. Dialplan auth gate — outbound-telnyx requires sip_authorized=true (set only on registered users).\n" +
        "4. Dialplan destination regex — frontdesk-inbound only matches our two real DIDs.\n" +
        "5. Ringing rate-limit — max 1 ringing CDR per origin per 30s (defends against SIP-flood UI cascade).\n" +
        "6. sip-attack-watch cron — every 5min, broadcasts Front Desk announcement on attack-rate spike.\n" +
        "7. Telnyx-side billing alerts — email-only events (Suspicious Outbound Voice Traffic, Low Available Credit, etc.) configured in Telnyx Mission Control. Last-resort safety net even if every layer above fails.\n\n" +
        "Each layer is independent — defense in depth means any single failure is caught by the next.",
      body: <ProtectionStackPanel status={status} />,
    },
    {
      id: "killswitch",
      title: "SIP Trunk Killswitch",
      qmbm:
        "Emergency lockdown for the SIP trunk. Engage = stop both Sofia profiles + UFW deny everything (immediate). Restore = re-enable Telnyx allowlist + restart profiles. " +
        "Use Engage if you spot a SIP scanner attack in the logs or unexpected billing. Every action is recorded in the Activity Timeline at the top.",
      body: <KillswitchPanel />,
    },
    {
      id: "auth-gate",
      title: "Dialplan Auth Gate",
      qmbm:
        "Channel variable sip_authorized=true is set on each authenticated SIP user (currently only ext 1001 in users/1001.xml). The outbound-telnyx and local-ext extensions in context.xml refuse to bridge unless this var is true. " +
        "Spoofed inbound trunk traffic never sets the var, so even if a destination regex regression let an attacker through, the dialplan still wouldn't bridge. " +
        "Read-only by design — toggling this from a UI would be a one-edit way to lose the gate; the source of truth is the version-controlled XML.",
      body: <DialplanGatePanel status={status} />,
    },
    {
      id: "ringing-rate-limit",
      title: "Ringing Rate-Limit",
      qmbm:
        "When a SIP-flood attack creates many INVITEs from the same origin, each one would (without this guard) create a fresh \"ringing\" CDR row, and the IncomingCallOverlay would loop the popup every 2.5s indefinitely (this exact symptom took the dashboard down on 2026-05-02). " +
        "The rate-limit returns the existing record instead of creating a duplicate when an inbound call from the same fromE164 already has a ringing record younger than the configured window. " +
        "Tuning: lower if legitimate fast-repeat callers exist; higher if you ever see zombie symptoms come back.",
      body: <RingingRateLimitPanel status={status} onSave={refreshStatus} />,
    },
    {
      id: "attack-watch",
      title: "SIP Attack Watch",
      qmbm:
        "PM2 cron job (every 5 min) tails the FreeSWITCH log, counts inbound SIP recv from non-Telnyx IPs, and writes each one to the toll-fraud audit log. When the count in the 5-min window exceeds the threshold, it broadcasts a Front Desk announcement (visible to all users). " +
        "Cooldown stops the same attack from broadcasting repeatedly — one announcement per cooldown window during a sustained attack. " +
        "Defaults: threshold 30, cooldown 1h.",
      body: <AttackWatchPanel status={status} onSave={refreshStatus} />,
    },
    {
      id: "telnyx",
      title: "Telnyx-side Billing Alerts",
      qmbm:
        "Telnyx exposes 28 notification event types. The 16 security/billing ones (Suspicious Outbound Voice Traffic, Low Available Credit, Auto-Recharge Failure, etc.) are EMAIL-ONLY — Telnyx does not expose webhooks for these. " +
        "Configure in Telnyx Mission Control → Account → Advanced Features → Notifications: create an email Channel, a Profile containing it, and one Setting per event. " +
        "The webhook endpoint at /api/frontdesk/admin/telnyx-billing-alert stays available for the 11 operational events (Number Order Notifications, Port In/Out, SIM Card Status Change) that DO support webhooks.",
      body: <TelnyxAlertsPanel status={status} />,
    },
  ];

  return (
    <HardeningControlModal
      title="Telephony Hardening"
      subtitle="SIP trunk, FreeSWITCH dialplan, fail2ban, UFW, Telnyx alerts — all controls in one place."
      onClose={onClose}
      sections={sections}
      auditLogView={
        <AuditLogTimeline
          endpoint="/api/frontdesk/admin/telephony/audit-log"
          kinds={["toll-fraud", "killswitch"]}
        />
      }
      globalSystemViews={
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <div style={{
              fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", marginBottom: "0.4rem",
              color: "var(--t-textFaint)",
            }}>
              fail2ban — RCS-wide
            </div>
            <Fail2banGlobalView highlightJail={TELEPHONY_JAIL} />
          </div>
          <div>
            <div style={{
              fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", marginBottom: "0.4rem",
              color: "var(--t-textFaint)",
            }}>
              UFW — RCS-wide (rules touching SIP ports / Telnyx range are highlighted)
            </div>
            <UfwGlobalView highlightFn={isTelephonyUfwRule} />
          </div>
        </div>
      }
    />
  );
}

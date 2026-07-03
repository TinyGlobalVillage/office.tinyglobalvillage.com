"use client";

// FirewallControlModal — the DEDICATED home for the RCS-wide network defenses:
// UFW (host firewall) + fail2ban (intrusion prevention).
//
// History: these two views used to be force-rendered at the bottom of EVERY hardening modal
// (the old "globalSystemViews always on" doctrine). As of 2026-06-14 (Gio) they live ONLY here —
// on every other modal they were noise unrelated to that surface. This is "the one they were
// designed for." See ~/.claude/CLAUDE.md §"Hardening UTILS Surfaces".
//
// Both child views (Fail2banGlobalView, UfwGlobalView) are self-contained — they fetch
// /api/admin/system/{fail2ban,ufw}, render the whole-box posture, and carry their own
// ban/unban + rule-delete controls. There is no separate audit-feed endpoint for firewall
// events, so this modal passes no auditLogView; the live ban list IS the activity record.

import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import Fail2banGlobalView from "../_shared/Fail2banGlobalView";
import UfwGlobalView from "../_shared/UfwGlobalView";

export type FirewallControlModalProps = { onClose: () => void };

export default function FirewallControlModal({ onClose }: FirewallControlModalProps) {
  useEscapeToClose({ open: true, onClose });

  const sections: HCMSection[] = [
    {
      id: "ufw",
      title: "UFW — Host Firewall",
      qmbm:
        "UFW is the server's host firewall — the allow/deny rules that decide which ports accept " +
        "traffic. The FULL rule set is shown (not just one app's) so you can spot an unexpectedly-" +
        "open port or a forgotten allow-rule across the whole box. Deleting a rule is irreversible " +
        "— confirm only if you understand what it does.",
      body: <UfwGlobalView />,
    },
    {
      id: "fail2ban",
      title: "fail2ban — Intrusion Prevention",
      qmbm:
        "fail2ban watches log files for repeated abuse (SSH brute-force, SIP/toll-fraud probes, …) " +
        "and auto-bans the offending IPs at the firewall. Each card is a jail (a log + filter + ban " +
        "policy); it shows who's currently banned and lets you manually ban an IP or lift a ban. " +
        "RCS-wide — every jail on the box.",
      body: <Fail2banGlobalView />,
    },
  ];

  return (
    <HardeningControlModal
      title="Firewall & Intrusion"
      subtitle="RCS-wide host firewall (UFW) + intrusion prevention (fail2ban) — the whole box."
      qmbm={
        "What is this?\n\n" +
        "The control surface for the server's two always-on network defenses: UFW (the host " +
        "firewall) and fail2ban (intrusion prevention that auto-bans abusive IPs).\n\n" +
        "These are RCS-WIDE — they protect every app on the box, not one tenant — so they live " +
        "here, on their own tile, rather than being bolted onto every other hardening modal. " +
        "Use this to audit the firewall posture, ban/unban an IP, or remove a stale UFW rule."
      }
      onClose={onClose}
      sections={sections}
    />
  );
}

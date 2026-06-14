"use client";

// MemberAuthControlModal — the Member Auth hardening surface.
//
// Pattern: ~/.claude/CLAUDE.md §"Hardening UTILS Surfaces". Lighter than the
// telephony / tenant-apps modals because the primary day-to-day operator
// surface lives on a dedicated page (/dashboard/member-users) — per-user row
// actions don't belong inside a system-level modal. This modal exists to
// (a) satisfy the HCM convention so member-auth hardenings are discoverable
// from the System Hardening group like every other defensive mechanism,
// (b) host the audit-log timeline for member_2fa_reset events, and
// (c) provide a clearly-labeled jump-off to the per-user management page.
//
// Phase 5 of tgv-member-auth-magic-link.md.

import { useRouter } from "next/navigation";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";

export type MemberAuthControlModalProps = {
  onClose: () => void;
};

const ManageBtn = styled.button`
  align-self: flex-start;
  background: rgba(${rgb.pink}, 0.12);
  border: 1px solid rgba(${rgb.pink}, 0.55);
  color: ${colors.pink};
  padding: 0.5rem 0.95rem;
  border-radius: 0.4rem;
  font-size: 0.85rem;
  cursor: pointer;
  &:hover { background: rgba(${rgb.pink}, 0.22); }
`;

const PanelBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  font-size: 0.8rem;
  color: var(--t-text);
  line-height: 1.5;
`;

export default function MemberAuthControlModal({ onClose }: MemberAuthControlModalProps) {
  const router = useRouter();

  const sections: HCMSection[] = [
    {
      id: "member-users",
      title: "Member Users",
      qmbm:
        "TGV.com members log in passwordlessly with magic-link + TOTP 2FA. " +
        "When a member loses their authenticator AND has burned through all " +
        "10 recovery codes, an Office admin can hard-reset them from here. " +
        "Reset clears TOTP secret, recovery codes, all registered passkeys, " +
        "and all active sessions in one transaction — the user is forced " +
        "back through /setup-2fa on next magic-link login.\n\n" +
        "Per-user actions live on the dedicated management page so search, " +
        "filtering, and confirmation flows aren't crammed into a modal.",
      body: (
        <PanelBody>
          <div>
            Open the full member-users list to inspect 2FA enrollment status,
            passkey counts, and active sessions per account. Each row has a
            Reset 2FA action gated behind a typed-confirmation modal.
          </div>
          <ManageBtn
            type="button"
            onClick={() => {
              onClose();
              router.push("/dashboard/member-users");
            }}
          >
            Manage member users →
          </ManageBtn>
        </PanelBody>
      ),
    },
  ];

  return (
    <HardeningControlModal
      title="Member Auth"
      subtitle="Magic-link + TOTP + passkeys for TGV.com members — admin-mediated 2FA recovery + audit trail."
      qmbm={
        "What is this?\n\n" +
        "TGV.com members (humans who sign up for a subscription) authenticate " +
        "with a magic-link first factor + TOTP second factor. Passkeys are " +
        "supported as an upgrade path. This is distinct from Office staff " +
        "auth (file-store NextAuth) — Office is for TGV LLC employees only.\n\n" +
        "The hardening installed here is the admin-mediated recovery flow: " +
        "when a member loses access (no authenticator, no recovery codes, " +
        "no passkeys), an Office admin can reset their 2FA state. The reset " +
        "is destructive (forces re-enrollment) and audit-logged so we have a " +
        "reconstructable trail of who reset whom and when.\n\n" +
        "Day-to-day operator actions live on /dashboard/member-users. This " +
        "modal exists for discoverability + timeline + RCS-wide posture."
      }
      onClose={onClose}
      sections={sections}
      auditLogView={<AuditLogTimeline endpoint="/api/admin/member-users/audit-feed" />}
    />
  );
}

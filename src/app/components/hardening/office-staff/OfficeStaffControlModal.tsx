"use client";

// OfficeStaffControlModal — the Office Staff Auth hardening surface.
//
// Pattern: ~/.claude/CLAUDE.md §"Hardening UTILS Surfaces". Mirrors the
// MemberAuthControlModal HCM, but where member-auth covers TGV.com members in
// Postgres, THIS covers Office STAFF (TGV LLC employees) stored in the flat
// file data/users.json.
//
// What it does:
//   - Lists every staff account with passkey / TOTP / recovery-code counts.
//   - Lets an admin hard-reset a staff member's auth state (passkeys +
//     recovery codes + TOTP) AFTER verifying identity by typing the member's
//     email. The reset forces re-enrollment and is audit-logged.
//   - Always renders the RCS-wide fail2ban + UFW posture views + the shared
//     auth audit-log timeline at the top, per the HCM convention.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb } from "@/app/theme";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";

export type OfficeStaffControlModalProps = {
  onClose: () => void;
};

type StaffRow = {
  username: string;
  displayName: string;
  email: string;
  passkeyCount: number;
  totpEnabled: boolean;
  recoveryCount: number;
};

/* ── styled primitives (pink/cyan rgba borders, consistent w/ surrounding HCMs) ── */

const PanelBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  font-size: 0.8rem;
  color: var(--t-text);
  line-height: 1.5;
`;

const Notice = styled.div<{ $tone: "ok" | "err" }>`
  font-size: 0.7rem;
  font-family: var(--font-geist-mono), monospace;
  padding: 0.35rem 0.55rem;
  border-radius: 0.4rem;
  background: ${p => (p.$tone === "ok" ? `rgba(${rgb.cyan}, 0.08)` : `rgba(${rgb.pink}, 0.08)`)};
  border: 1px solid ${p => (p.$tone === "ok" ? `rgba(${rgb.cyan}, 0.4)` : `rgba(${rgb.pink}, 0.45)`)};
  color: ${p => (p.$tone === "ok" ? colors.cyan : colors.pink)};
`;

const StaffList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const StaffCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.6rem 0.7rem;
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(${rgb.cyan}, 0.2);
`;

const StaffTopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
`;

const StaffIdent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
`;

const StaffName = styled.div`
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--t-text);
`;

const StaffEmail = styled.div`
  font-size: 0.68rem;
  font-family: var(--font-geist-mono), monospace;
  color: var(--t-textFaint);
  word-break: break-all;
`;

const Counts = styled.div`
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
`;

const CountPill = styled.span<{ $tone: "on" | "off" }>`
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: ${p => (p.$tone === "on" ? `rgba(${rgb.cyan}, 0.12)` : "rgba(0,0,0,0.25)")};
  border: 1px solid ${p => (p.$tone === "on" ? `rgba(${rgb.cyan}, 0.4)` : "var(--t-border)")};
  color: ${p => (p.$tone === "on" ? colors.cyan : "var(--t-textFaint)")};
`;

const ResetBtn = styled.button`
  align-self: flex-start;
  flex-shrink: 0;
  background: rgba(${rgb.pink}, 0.12);
  border: 1px solid rgba(${rgb.pink}, 0.55);
  color: ${colors.pink};
  padding: 0.35rem 0.7rem;
  border-radius: 0.4rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  &:hover { background: rgba(${rgb.pink}, 0.22); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const ConfirmBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.55rem 0.6rem;
  border-radius: 0.45rem;
  background: rgba(${rgb.pink}, 0.06);
  border: 1px solid rgba(${rgb.pink}, 0.35);
`;

const ConfirmLabel = styled.label`
  font-size: 0.68rem;
  color: ${colors.pink};
  line-height: 1.4;
`;

const ConfirmInput = styled.input`
  width: 100%;
  border-radius: 0.4rem;
  padding: 0.4rem 0.55rem;
  font-size: 0.72rem;
  font-family: var(--font-geist-mono), monospace;
  outline: none;
  background: rgba(${rgb.pink}, 0.08);
  border: 1px solid rgba(${rgb.pink}, 0.3);
  color: var(--t-text);
  &::placeholder { color: var(--t-textGhost); }
`;

const ConfirmBtnRow = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const CancelBtn = styled.button`
  background: transparent;
  border: 1px solid var(--t-borderStrong);
  color: var(--t-textMuted);
  padding: 0.35rem 0.7rem;
  border-radius: 0.4rem;
  font-size: 0.7rem;
  cursor: pointer;
  &:hover { color: var(--t-text); }
`;

const DoResetBtn = styled.button`
  background: linear-gradient(to right, ${colors.pink}, #cc0066);
  border: none;
  color: #fff;
  padding: 0.35rem 0.7rem;
  border-radius: 0.4rem;
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const Empty = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  font-style: italic;
  padding: 0.5rem 0;
`;

/* ── staff section body ── */

function StaffSectionBody() {
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/office-staff/list", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? `HTTP ${res.status}`);
        setStaff([]);
        return;
      }
      const data = await res.json();
      setStaff(data.staff ?? []);
    } catch (err) {
      setError((err as Error).message);
      setStaff([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openConfirm = (username: string) => {
    setConfirmFor(username);
    setConfirmEmail("");
    setError(null);
    setFlash(null);
  };

  const cancelConfirm = () => {
    setConfirmFor(null);
    setConfirmEmail("");
  };

  const doReset = async (row: StaffRow) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/office-staff/${encodeURIComponent(row.username)}/reset-passkey`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmEmail }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error === "confirm_email_mismatch"
            ? "Email did not match — reset aborted."
            : (data.error ?? `HTTP ${res.status}`),
        );
        return;
      }
      setFlash(
        `Reset ${row.displayName} — cleared ${data.passkeysCleared ?? 0} passkey(s), recovery codes, and TOTP. They must re-enroll on next login.`,
      );
      cancelConfirm();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelBody>
      {flash && <Notice $tone="ok">{flash}</Notice>}
      {error && <Notice $tone="err">{error}</Notice>}

      {staff === null && <Empty>Loading staff…</Empty>}
      {staff && staff.length === 0 && <Empty>No staff accounts found.</Empty>}

      {staff && staff.length > 0 && (
        <StaffList>
          {staff.map(row => {
            const isConfirming = confirmFor === row.username;
            const emailMatches =
              confirmEmail.trim().toLowerCase() === row.email.trim().toLowerCase();
            return (
              <StaffCard key={row.username}>
                <StaffTopRow>
                  <StaffIdent>
                    <StaffName>{row.displayName}</StaffName>
                    <StaffEmail>{row.email}</StaffEmail>
                  </StaffIdent>
                  {!isConfirming && (
                    <ResetBtn type="button" onClick={() => openConfirm(row.username)} disabled={busy}>
                      Reset
                    </ResetBtn>
                  )}
                </StaffTopRow>

                <Counts>
                  <CountPill $tone={row.passkeyCount > 0 ? "on" : "off"}>
                    {row.passkeyCount} passkey{row.passkeyCount === 1 ? "" : "s"}
                  </CountPill>
                  <CountPill $tone={row.totpEnabled ? "on" : "off"}>
                    TOTP {row.totpEnabled ? "on" : "off"}
                  </CountPill>
                  <CountPill $tone={row.recoveryCount > 0 ? "on" : "off"}>
                    {row.recoveryCount} recovery code{row.recoveryCount === 1 ? "" : "s"}
                  </CountPill>
                </Counts>

                {isConfirming && (
                  <ConfirmBox>
                    <ConfirmLabel>
                      Destructive: clears all passkeys, recovery codes, and TOTP for{" "}
                      <strong>{row.displayName}</strong>. Type their email to confirm:
                    </ConfirmLabel>
                    <ConfirmInput
                      type="text"
                      value={confirmEmail}
                      onChange={e => setConfirmEmail(e.target.value)}
                      placeholder={row.email}
                      autoFocus
                    />
                    <ConfirmBtnRow>
                      <CancelBtn type="button" onClick={cancelConfirm} disabled={busy}>
                        Cancel
                      </CancelBtn>
                      <DoResetBtn
                        type="button"
                        onClick={() => doReset(row)}
                        disabled={busy || !emailMatches}
                      >
                        {busy ? "Resetting…" : "⚠ Reset auth"}
                      </DoResetBtn>
                    </ConfirmBtnRow>
                  </ConfirmBox>
                )}
              </StaffCard>
            );
          })}
        </StaffList>
      )}
    </PanelBody>
  );
}

export default function OfficeStaffControlModal({ onClose }: OfficeStaffControlModalProps) {
  useEscapeToClose({ open: true, onClose });

  const sections: HCMSection[] = [
    {
      id: "staff-passkeys",
      title: "Office Staff",
      qmbm:
        "Office STAFF (TGV LLC employees) authenticate against the flat-file " +
        "store data/users.json — distinct from TGV.com members (Postgres). " +
        "A passkey (WebAuthn) is the standing factor; recovery codes are the " +
        "break-glass fallback, and TOTP is supported as a second factor.\n\n" +
        "When a staff member loses their passkey AND has burned through their " +
        "recovery codes, an admin can hard-reset them here. The reset is " +
        "identity-verified (the admin must type the staff member's email), " +
        "destructive (clears all passkeys + recovery codes + TOTP secret, " +
        "forcing re-enrollment on next login), and audit-logged — every reset " +
        "records who reset whom and how many passkeys were cleared.",
      body: <StaffSectionBody />,
    },
  ];

  return (
    <HardeningControlModal
      title="Office Staff Auth"
      subtitle="Passkeys + identity-verified reset for TGV LLC staff (file-store accounts)"
      qmbm={
        "What is this?\n\n" +
        "Office staff (TGV LLC employees) sign in with passkeys backed by the " +
        "flat-file store data/users.json. This is the sibling of the Member " +
        "Auth hardening — Member Auth covers TGV.com members in Postgres; this " +
        "covers internal staff accounts.\n\n" +
        "The hardening surfaced here is admin-mediated recovery: when a staff " +
        "member is locked out (no passkey, no recovery codes), an admin can " +
        "reset their auth state after verifying identity by typing the " +
        "member's email. The reset is destructive (forces re-enrollment) and " +
        "audit-logged so we have a reconstructable trail of who reset whom."
      }
      onClose={onClose}
      sections={sections}
      auditLogView={<AuditLogTimeline endpoint="/api/admin/office-staff/audit-feed" />}
    />
  );
}

"use client";

// InvitationsControlModal — the Invitations hardening surface (Gio 2026-06-12).
//
// Invite-gated onboarding is an API-spend killswitch: nobody reaches the
// credit-spending wizard without redeeming an emailed, single-use, email-bound
// invite code. This modal is the operator console — mint codes, watch who
// redeemed them, revoke, resend, and edit — over the shared invite_codes /
// invite_redemptions tables (tgv_db). Follows the HCM convention
// (~/.claude/CLAUDE.md §"Hardening UTILS Surfaces").

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb } from "@/app/theme";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";

export type InvitationsControlModalProps = { onClose: () => void };

type CodeRow = {
  id: string;
  code: string;
  email: string | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  active: boolean;
  note: string | null;
  created_at: string;
  redeemed_count: number;
  latest_redeemer: string | null;
  latest_redeemed_at: string | null;
};

type Status = "active" | "redeemed" | "expired" | "revoked";

function statusOf(c: CodeRow): Status {
  if (!c.active) return "revoked";
  if (c.expires_at && new Date(c.expires_at).getTime() <= Date.now()) return "expired";
  if (c.max_uses != null && c.redeemed_count >= c.max_uses) return "redeemed";
  return "active";
}
const STATUS_COLOR: Record<Status, string> = {
  active: colors.cyan,
  redeemed: colors.gold,
  expired: "#e0a23a",
  revoked: colors.pink,
};
function modeOf(c: CodeRow): string {
  if (c.max_uses == null) return "reusable";
  if (c.max_uses === 1) return "single-use";
  return `${c.max_uses}× uses`;
}

export default function InvitationsControlModal({ onClose }: InvitationsControlModalProps) {
  useEscapeToClose({ open: true, onClose });

  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [base, setBase] = useState("https://tinyglobalvillage.com");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // New-invite form
  const [email, setEmail] = useState("");
  const [reusable, setReusable] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [minting, setMinting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/invitations");
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "load_failed");
      setCodes(Array.isArray(d.codes) ? d.codes : []);
      if (d.base) setBase(d.base);
      setErr(null);
    } catch {
      setErr("Couldn't load invite codes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const linkFor = (code: string) => `${base}/claim?invite=${encodeURIComponent(code)}`;

  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(code));
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
    } catch {
      /* clipboard blocked — operator can select the code manually */
    }
  };

  const mint = async () => {
    if (minting) return;
    setMinting(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim() || undefined,
          maxUses: reusable ? null : 1,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          note: note.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "mint_failed");
      setEmail("");
      setExpiresAt("");
      setNote("");
      setReusable(false);
      await load();
    } catch (e) {
      setErr(e instanceof Error && e.message === "invalid_email" ? "That email isn't valid." : "Couldn't create the invite.");
    } finally {
      setMinting(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    try {
      await fetch("/api/admin/invitations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const resend = async (id: string) => {
    setBusyId(id);
    try {
      await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "resend", id }),
      });
    } finally {
      setBusyId(null);
    }
  };

  const sections: HCMSection[] = [
    {
      id: "invite-codes",
      title: "Invite Codes",
      qmbm:
        "Onboarding is invite-only to cap API spend: a person can't create an " +
        "account or reach the AI wizard without redeeming a valid, single-use, " +
        "email-bound invite code emailed to them. They set up a passkey from the " +
        "invite link, which creates the account and unlocks the wizard.\n\n" +
        "`admin` is the one reusable, generic code (temporary — remove once real " +
        "invites flow). Revoking a code blocks future redemptions; it doesn't " +
        "evict anyone who already redeemed.",
      body: (
        <PanelBody>
          {/* New invite */}
          <FormRow>
            <Input
              type="email"
              placeholder="email (optional — blank = generic code)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="datetime-local"
              title="Expiry (optional)"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <Input
              type="text"
              placeholder="note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <ReuseToggle title="Reusable code (no single-use limit)">
              <input
                type="checkbox"
                checked={reusable}
                onChange={(e) => setReusable(e.target.checked)}
              />
              reusable
            </ReuseToggle>
            <MintBtn type="button" onClick={mint} disabled={minting}>
              {minting ? "Creating…" : "+ New invite"}
            </MintBtn>
          </FormRow>
          {err && <ErrLine>{err}</ErrLine>}

          {loading ? (
            <Dim>Loading…</Dim>
          ) : codes.length === 0 ? (
            <Dim>No invite codes yet.</Dim>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Mode</th>
                    <th>Uses</th>
                    <th>Redeemed by</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => {
                    const status = statusOf(c);
                    return (
                      <tr key={c.id}>
                        <td>
                          <Mono>{c.code}</Mono>
                        </td>
                        <td>{c.email ?? <Dim>— generic —</Dim>}</td>
                        <td>
                          <Pill $color={STATUS_COLOR[status]}>{status}</Pill>
                        </td>
                        <td>{modeOf(c)}</td>
                        <td>
                          {c.used_count}
                          {c.max_uses != null ? ` / ${c.max_uses}` : " / ∞"}
                        </td>
                        <td>
                          {c.latest_redeemer ? (
                            <>
                              {c.latest_redeemer}
                              {c.redeemed_count > 1 ? ` +${c.redeemed_count - 1}` : ""}
                            </>
                          ) : (
                            <Dim>—</Dim>
                          )}
                        </td>
                        <td>
                          <Dim>{new Date(c.created_at).toLocaleDateString()}</Dim>
                        </td>
                        <td>
                          <Actions>
                            <ActBtn type="button" onClick={() => copyLink(c.code)}>
                              {copied === c.code ? "✓ copied" : "copy link"}
                            </ActBtn>
                            {c.email && (
                              <ActBtn
                                type="button"
                                disabled={busyId === c.id}
                                onClick={() => resend(c.id)}
                              >
                                resend
                              </ActBtn>
                            )}
                            <GoldSwitch
                              on={c.active}
                              disabled={busyId === c.id}
                              onChange={(v) => patch(c.id, { active: v })}
                            />
                          </Actions>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </PanelBody>
      ),
    },
  ];

  return (
    <HardeningControlModal
      title="Invitations"
      subtitle="Invite-only onboarding — mint, track, and revoke the codes that gate the AI wizard."
      qmbm={
        "What is this?\n\n" +
        "Invite-gated onboarding is a hard cap on Anthropic API spend: the " +
        "wizard's AI design + migration routes only run for humans who redeemed " +
        "a valid invite. Codes are single-use and email-bound by default; the " +
        "recipient sets up a passkey from the emailed link, which creates the " +
        "account and unlocks the wizard.\n\n" +
        "Mint codes here (blank email = a generic, reusable-if-you-set-it code). " +
        "Revoke to block future redemptions. The `admin` seed is a temporary " +
        "reusable code for the team."
      }
      onClose={onClose}
      sections={sections}
      auditLogView={<AuditLogTimeline endpoint="/api/admin/invitations/audit-feed" />}
    />
  );
}

/* ── Lightswitch toggle (mirror members page GoldSwitch) ───────────────── */
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
      title={on ? "Active — click to revoke" : "Revoked — click to reactivate"}
      onClick={() => onChange(!on)}
    >
      <LSKnob $on={on} />
    </LSTrack>
  );
}

/* ── styles ─────────────────────────────────────────────────────────────── */

const PanelBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  font-size: 0.8rem;
  color: var(--t-text);
`;

const FormRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
`;

const Input = styled.input`
  flex: 1 1 9rem;
  min-width: 7rem;
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

const ReuseToggle = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: var(--t-textFaint);
  white-space: nowrap;
`;

const MintBtn = styled.button`
  background: rgba(${rgb.cyan}, 0.14);
  border: 1px solid rgba(${rgb.cyan}, 0.55);
  color: ${colors.cyan};
  padding: 0.45rem 0.85rem;
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

const ErrLine = styled.div`
  font-size: 0.75rem;
  color: ${colors.pink};
`;

const Dim = styled.span`
  color: var(--t-textFaint);
`;

const TableWrap = styled.div`
  max-height: 18rem;
  overflow: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
  th,
  td {
    padding: 0.45rem 0.55rem;
    text-align: left;
    border-bottom: 1px solid rgba(${rgb.gold}, 0.1);
    white-space: nowrap;
  }
  th {
    color: ${colors.gold};
    font-weight: 600;
    position: sticky;
    top: 0;
    background: #14110a;
  }
  tr:hover td {
    background: rgba(${rgb.gold}, 0.04);
  }
`;

const Mono = styled.span`
  font-family: var(--font-geist-mono), monospace;
  color: ${colors.cyan};
`;

const Pill = styled.span<{ $color: string }>`
  display: inline-block;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.68rem;
  border: 1px solid ${(p) => p.$color};
  color: ${(p) => p.$color};
  background: ${(p) => p.$color}1a;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const ActBtn = styled.button`
  background: transparent;
  border: 1px solid var(--t-border);
  color: var(--t-text);
  padding: 0.25rem 0.5rem;
  border-radius: 0.35rem;
  font-size: 0.7rem;
  cursor: pointer;
  &:hover:not(:disabled) {
    border-color: rgba(${rgb.cyan}, 0.55);
    color: ${colors.cyan};
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;


const LSTrack = styled.button<{ $on: boolean }>`
  position: relative;
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

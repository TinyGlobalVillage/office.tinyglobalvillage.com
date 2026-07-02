"use client";

// /dashboard/member-users — admin surface for the members table (humans
// who hold TGV.com member accounts, distinct from `members` which is the
// tenant-deployment table). Phase 5 of tgv-member-auth-magic-link.md.
//
// Primary action today: Reset 2FA per row (clears TOTP + recovery codes +
// passkeys + sessions in one transaction, audit-logged). Routed to from the
// MemberAuthControlModal tile under System Hardening on /dashboard/utils.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import TopNav from "@/app/components/TopNav";

type MemberRow = {
  id: string;
  email: string;
  name: string | null;
  totpEnrolledAt: string | null;
  recoveryCodesRemaining: number;
  lastLoginAt: string | null;
  createdAt: string;
  passkeyCount: number;
  sessionCount: number;
  lastResetAt: string | null;
};

const Main = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 7rem 1rem 8rem;
  max-width: 80rem;
  margin: 0 auto;
  width: 100%;
  gap: 1.25rem;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
`;

const Title = styled.h1`
  font-size: 2rem;
  color: ${colors.pink};
  text-shadow: 0 0 12px rgba(${rgb.pink}, 0.55);
  margin: 0;
`;

const Sub = styled.p`
  color: rgba(${rgb.pink}, 0.65);
  font-size: 0.9rem;
  margin: 0;
`;

const BackLink = styled(Link)`
  color: rgba(${rgb.cyan}, 0.85);
  text-decoration: none;
  font-size: 0.85rem;
  &:hover { color: ${colors.cyan}; }
`;

const TableWrap = styled.div`
  overflow-x: auto;
  border: 1px solid rgba(${rgb.pink}, 0.2);
  border-radius: 0.6rem;
  background: rgba(0, 0, 0, 0.35);
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  th, td {
    padding: 0.65rem 0.85rem;
    text-align: left;
    border-bottom: 1px solid rgba(${rgb.pink}, 0.1);
    white-space: nowrap;
  }
  th {
    color: ${colors.gold};
    font-weight: 500;
    background: rgba(${rgb.pink}, 0.05);
    position: sticky;
    top: 0;
  }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(${rgb.pink}, 0.04); }
`;

const Pill = styled.span<{ $color: string }>`
  display: inline-block;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  border: 1px solid ${(p) => p.$color};
  color: ${(p) => p.$color};
  background: ${(p) => p.$color}1a;
`;

const ResetBtn = styled.button`
  background: rgba(${rgb.red}, 0.12);
  border: 1px solid rgba(${rgb.red}, 0.5);
  color: ${colors.red};
  padding: 0.3rem 0.7rem;
  border-radius: 0.35rem;
  font-size: 0.78rem;
  cursor: pointer;
  &:hover { background: rgba(${rgb.red}, 0.2); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Empty = styled.div`
  padding: 3rem 1rem;
  text-align: center;
  color: rgba(${rgb.pink}, 0.55);
  font-size: 0.9rem;
`;

const ErrorBox = styled.div`
  padding: 1rem;
  border: 1px solid ${colors.red};
  border-radius: 0.4rem;
  color: ${colors.red};
  background: rgba(255, 0, 0, 0.06);
`;

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
`;

const ModalCard = styled.div`
  background: linear-gradient(180deg, rgba(20,15,35,0.98), rgba(8,6,16,0.98));
  border: 1px solid rgba(${rgb.red}, 0.45);
  border-radius: 0.7rem;
  padding: 1.5rem;
  max-width: 32rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 1.15rem;
  color: ${colors.red};
`;

const ModalBody = styled.div`
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.875rem;
  line-height: 1.45;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Input = styled.input`
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #ededed;
  padding: 0.5rem 0.65rem;
  border-radius: 0.35rem;
  font-size: 0.85rem;
  font-family: var(--font-geist-mono), monospace;
  &:focus { outline: none; border-color: rgba(${rgb.red}, 0.55); }
`;

const ModalRow = styled.div`
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
`;

const CancelBtn = styled.button`
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.78);
  padding: 0.45rem 0.85rem;
  border-radius: 0.35rem;
  cursor: pointer;
  font-size: 0.8rem;
`;

const ConfirmBtn = styled.button`
  background: rgba(${rgb.red}, 0.2);
  border: 1px solid ${colors.red};
  color: ${colors.red};
  padding: 0.45rem 0.85rem;
  border-radius: 0.35rem;
  cursor: pointer;
  font-size: 0.8rem;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function MemberUsersPage() {
  const [rows, setRows] = useState<MemberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<MemberRow | null>(null);
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetch("/api/admin/member-users", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!j.ok) { setError(j.error ?? "fetch failed"); return; }
        setRows(j.members);
      })
      .catch((e: Error) => setError(e.message ?? "network error"));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openConfirm = (row: MemberRow) => {
    setTyped("");
    setConfirmTarget(row);
  };

  const closeConfirm = () => {
    if (submitting) return;
    setConfirmTarget(null);
    setTyped("");
  };

  const performReset = async () => {
    if (!confirmTarget) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/admin/members/${confirmTarget.id}/reset-2fa`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmEmail: typed }),
      });
      const j = await r.json();
      if (!j.ok) {
        setError(j.error ?? `Reset failed (HTTP ${r.status})`);
      } else {
        load();
      }
    } catch (e) {
      setError((e as Error).message ?? "network error");
    } finally {
      setSubmitting(false);
      setConfirmTarget(null);
      setTyped("");
    }
  };

  const typedMatches =
    confirmTarget !== null &&
    typed.trim().toLowerCase() === confirmTarget.email.toLowerCase();

  return (
    <>
      <TopNav />
      <Main>
        <HeaderRow>
          <div>
            <Title>Member Users</Title>
            <Sub>
              Humans with TGV.com member accounts — magic-link + 2FA.
              Distinct from <Link href="/dashboard/members" style={{ color: colors.cyan }}>
                Members
              </Link>{" "}
              (tenants).
            </Sub>
          </div>
          <BackLink href="/dashboard/utils">← Utils</BackLink>
        </HeaderRow>

        {error && <ErrorBox>Error: {error}</ErrorBox>}

        {rows === null && !error && <Empty>Loading…</Empty>}

        {rows && rows.length === 0 && (
          <Empty>No member users yet. New signups appear here after their first magic-link request.</Empty>
        )}

        {rows && rows.length > 0 && (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>2FA</th>
                  <th>Recovery codes</th>
                  <th>Passkeys</th>
                  <th>Sessions</th>
                  <th>Last login</th>
                  <th>Last reset</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const enrolled = u.totpEnrolledAt !== null;
                  const canReset = enrolled || u.passkeyCount > 0 || u.sessionCount > 0 || u.recoveryCodesRemaining > 0;
                  return (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{u.name ?? "—"}</td>
                      <td>
                        <Pill $color={enrolled ? colors.green : colors.gold}>
                          {enrolled ? "enrolled" : "pending"}
                        </Pill>
                      </td>
                      <td>{u.recoveryCodesRemaining}/10</td>
                      <td>{u.passkeyCount}</td>
                      <td>{u.sessionCount}</td>
                      <td>{fmtDate(u.lastLoginAt)}</td>
                      <td>{fmtDate(u.lastResetAt)}</td>
                      <td>
                        <ResetBtn
                          onClick={() => openConfirm(u)}
                          disabled={!canReset}
                          title={canReset ? "Reset 2FA + clear passkeys + kill sessions" : "Nothing to reset"}
                        >
                          Reset 2FA
                        </ResetBtn>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Main>

      {confirmTarget && (
        <ModalBackdrop onClick={closeConfirm}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalTitle>Reset 2FA for {confirmTarget.email}?</ModalTitle>
            <ModalBody>
              <div>This will clear, in one transaction:</div>
              <ul style={{ margin: "0.1rem 0 0.2rem 1.1rem", padding: 0 }}>
                <li>TOTP secret + enrollment timestamp</li>
                <li>All recovery codes ({confirmTarget.recoveryCodesRemaining} remaining)</li>
                <li>All passkeys ({confirmTarget.passkeyCount})</li>
                <li>All active sessions ({confirmTarget.sessionCount})</li>
              </ul>
              <div>
                The user will be forced back through <code>/setup-2fa</code> on next
                magic-link login. This action is audit-logged and cannot be undone.
              </div>
              <div style={{ marginTop: "0.4rem" }}>
                Type the user&apos;s email to confirm:
              </div>
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={confirmTarget.email}
                autoFocus
                disabled={submitting}
              />
            </ModalBody>
            <ModalRow>
              <CancelBtn onClick={closeConfirm} disabled={submitting}>Cancel</CancelBtn>
              <ConfirmBtn onClick={performReset} disabled={!typedMatches || submitting}>
                {submitting ? "Resetting…" : "Reset 2FA"}
              </ConfirmBtn>
            </ModalRow>
          </ModalCard>
        </ModalBackdrop>
      )}
    </>
  );
}

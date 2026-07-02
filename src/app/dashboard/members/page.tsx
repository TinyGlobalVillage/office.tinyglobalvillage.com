"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import TopNav from "@/app/components/TopNav";
import { VERTICALS, TIERS, type VerticalId, type TierId } from "@tgv/module-registry";

type MemberRow = {
  id: string;
  clientName: string;
  domain: string;
  subdomain: string | null;
  vertical: string;
  tier: string;
  modules: string[];
  storageGb: number;
  customFlag: boolean;
  stripeMode: string;
  connectedAccountId: number | null;
  deployStatus: string;
  repoUrl: string | null;
  pm2Name: string | null;
  deployedAt: string | null;
  createdAt: string;
};

const STATUS_COLOR: Record<string, string> = {
  pending: colors.gold,
  deploying: "#00bfff",
  live: "#00dc64",
  failed: colors.red,
};

// ── Yellow Pages — Founding members ─────────────────────────────────────
// Backed by /api/admin/members/founding (union of founding rows + known
// tenant Sites + platform members). Toggle flips billing on the member's
// existing listings token↔founding server-side.

type FoundingRow = {
  site_id: string;
  label: string;
  source: "founding" | "site" | "tenant";
  active: boolean;
  revoked_at: string | null;
};

const SOURCE_COLOR: Record<FoundingRow["source"], string> = {
  founding: colors.gold,
  site: colors.cyan,
  tenant: colors.pink,
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

const NewLink = styled(Link)`
  background: rgba(${rgb.pink}, 0.12);
  border: 1px solid rgba(${rgb.pink}, 0.5);
  color: ${colors.pink};
  padding: 0.5rem 0.9rem;
  border-radius: 0.4rem;
  text-decoration: none;
  font-size: 0.9rem;
  &:hover {
    background: rgba(${rgb.pink}, 0.2);
  }
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

const SectionTitle = styled.h2`
  font-size: 1.35rem;
  color: ${colors.gold};
  text-shadow: 0 0 10px rgba(${rgb.gold}, 0.45);
  margin: 1.5rem 0 0;
`;

const MonoId = styled.code`
  font-family: var(--font-geist-mono, ui-monospace, monospace);
  font-size: 0.7rem;
  color: rgba(${rgb.pink}, 0.45);
`;

/* Founding toggle — Lightswitch (mirrors the utils/page.tsx + BackupsControlModal pattern) */
const LSTrack = styled.button<{ $on: boolean }>`
  appearance: none; border: none; cursor: pointer; position: relative;
  width: 44px; height: 24px; border-radius: 12px; flex-shrink: 0;
  transition: all 0.25s ease;
  background: ${(p) => p.$on
    ? `linear-gradient(90deg, ${colors.gold}55, ${colors.gold}22)`
    : "rgba(120,120,120,0.2)"};
  box-shadow: ${(p) => p.$on
    ? `inset 0 0 6px ${colors.gold}33, 0 0 8px ${colors.gold}22`
    : "inset 0 1px 3px rgba(0,0,0,0.2)"};
  &:focus { outline: none; box-shadow: 0 0 0 2px ${colors.gold}44; }
  &:disabled { opacity: 0.5; cursor: wait; }
`;
const LSKnob = styled.div<{ $on: boolean }>`
  position: absolute; top: 2px; left: ${(p) => (p.$on ? "22px" : "2px")};
  width: 20px; height: 20px; border-radius: 50%;
  transition: all 0.25s ease;
  background: ${(p) => p.$on
    ? `radial-gradient(circle at 40% 35%, ${colors.gold}ee, ${colors.gold}, ${colors.gold}88)`
    : "radial-gradient(circle at 40% 35%, #888, #555)"};
  box-shadow: ${(p) => p.$on
    ? `0 0 8px ${colors.gold}80, 0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)`
    : "0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)"};
`;
function GoldSwitch({ on, onChange, disabled }: { on: boolean; onChange: (n: boolean) => void; disabled?: boolean }) {
  return (
    <LSTrack $on={on} type="button" onClick={() => !disabled && onChange(!on)} disabled={disabled}>
      <LSKnob $on={on} />
    </LSTrack>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function verticalName(id: string) {
  return VERTICALS[id as VerticalId]?.name ?? id;
}

function tierName(id: string) {
  return TIERS[id as TierId]?.name ?? id;
}

export default function MembersPage() {
  const [rows, setRows] = useState<MemberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Yellow Pages founding-members section state
  const [ypRows, setYpRows] = useState<FoundingRow[] | null>(null);
  const [ypError, setYpError] = useState<string | null>(null);
  const [ypBusy, setYpBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/members")
      .then(async (r) => {
        const j = await r.json();
        if (!active) return;
        if (!j.ok) {
          setError(j.error ?? "fetch failed");
          return;
        }
        setRows(j.members);
      })
      .catch((e) => active && setError(e.message ?? "network error"));
    return () => {
      active = false;
    };
  }, []);

  const loadFounding = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/members/founding");
      const j = await r.json();
      if (!j.ok) {
        setYpError(j.error ?? "fetch failed");
        return;
      }
      setYpRows(j.rows);
    } catch (e) {
      setYpError(e instanceof Error ? e.message : "network error");
    }
  }, []);

  useEffect(() => {
    void loadFounding();
  }, [loadFounding]);

  async function toggleFounding(row: FoundingRow) {
    const next = !row.active;
    setYpBusy(row.site_id);
    setYpError(null);
    // Optimistic flip; authoritative state comes back via refetch.
    setYpRows(
      (prev) =>
        prev?.map((r) =>
          r.site_id === row.site_id ? { ...r, active: next } : r,
        ) ?? prev,
    );
    try {
      const r = await fetch("/api/admin/members/founding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: row.site_id, on: next, label: row.label }),
      });
      const j = await r.json();
      if (!j.ok) {
        throw new Error(
          j.reason === "not_founding"
            ? "Member is not currently a founding member"
            : (j.error ?? "toggle failed"),
        );
      }
      await loadFounding();
    } catch (e) {
      // Revert the optimistic flip.
      setYpRows(
        (prev) =>
          prev?.map((r) =>
            r.site_id === row.site_id ? { ...r, active: row.active } : r,
          ) ?? prev,
      );
      setYpError(e instanceof Error ? e.message : "toggle failed");
    } finally {
      setYpBusy(null);
    }
  }

  return (
    <>
      <TopNav />
      <Main>
        <HeaderRow>
          <div>
            <Title>Members</Title>
            <Sub>TGV platform tenants — every deployed client site.</Sub>
          </div>
          <NewLink href="/dashboard/new-client">+ New client</NewLink>
        </HeaderRow>

        {error && <ErrorBox>Error loading members: {error}</ErrorBox>}

        {rows === null && !error && <Empty>Loading…</Empty>}

        {rows && rows.length === 0 && (
          <Empty>
            No members yet. Submit the <Link href="/dashboard/new-client">new-client wizard</Link> to create one.
          </Empty>
        )}

        {rows && rows.length > 0 && (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Domain</th>
                  <th>Vertical</th>
                  <th>Tier</th>
                  <th>Modules</th>
                  <th>Storage</th>
                  <th>Stripe</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.clientName}
                      {m.customFlag && (
                        <>
                          {" "}
                          <Pill $color={colors.gold}>custom</Pill>
                        </>
                      )}
                    </td>
                    <td>
                      {m.domain}
                      {m.subdomain && (
                        <span style={{ opacity: 0.6 }}> · {m.subdomain}</span>
                      )}
                    </td>
                    <td>{verticalName(m.vertical)}</td>
                    <td>{tierName(m.tier)}</td>
                    <td>{m.modules.length === 0 ? "—" : m.modules.join(", ")}</td>
                    <td>{m.storageGb} GB</td>
                    <td>
                      <Pill $color={m.stripeMode === "standalone" ? colors.gold : colors.pink}>
                        {m.stripeMode}
                      </Pill>
                    </td>
                    <td>
                      <Pill $color={STATUS_COLOR[m.deployStatus] ?? colors.pink}>
                        {m.deployStatus}
                      </Pill>
                    </td>
                    <td>{fmtDate(m.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}

        {/* ── Yellow Pages — Founding members ───────────────────────── */}
        <div>
          <SectionTitle>Yellow Pages — Founding members</SectionTitle>
          <Sub>Founding members get unlimited free Yellow Pages listings.</Sub>
        </div>

        {ypError && <ErrorBox>Yellow Pages founding members: {ypError}</ErrorBox>}

        {ypRows === null && !ypError && <Empty>Loading…</Empty>}

        {ypRows && ypRows.length === 0 && (
          <Empty>No members known to Yellow Pages yet.</Empty>
        )}

        {ypRows && ypRows.length > 0 && (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Source</th>
                  <th>Member ID</th>
                  <th>Founding</th>
                </tr>
              </thead>
              <tbody>
                {ypRows.map((r) => (
                  <tr key={r.site_id}>
                    <td>{r.label}</td>
                    <td>
                      <Pill $color={SOURCE_COLOR[r.source]}>{r.source}</Pill>
                    </td>
                    <td>
                      <MonoId>{r.site_id}</MonoId>
                    </td>
                    <td>
                      <GoldSwitch
                        on={r.active}
                        disabled={ypBusy === r.site_id}
                        onChange={() => void toggleFounding(r)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Main>
    </>
  );
}

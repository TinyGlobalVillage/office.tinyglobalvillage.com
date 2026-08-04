"use client";

// ProfileEnginesModal — who gets a bespoke Profile tab (plan 31/32).
//
// The two profile engines (Cosmic Profile, Starseed) stopped being one app's
// private code when they became @tgv packages, so "which member sees one" had to
// stop being answered by which app they logged into. This is where an operator
// answers it: pick the engine, find the person, tick the box.
//
// THE SITE IS NOT PICKABLE. Each engine belongs to the site(s) the catalog names
// (in code, in @tgv/module-dashboard/profile-engines/catalog), and the API
// derives it — so there is no control here that could hand Resonant Weaver's
// engine to a Refusionist member. Ticking is the UNLOCK half of the gate; being
// a member of the site at all is the other half, and that one isn't ours to set.
//
// Sibling of DashboardConfigModal (the global feature killswitch): that board is
// per-FEATURE for everyone, this one is per-MEMBER for one feature. Both audit.

import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb } from "@/app/theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
} from "@/app/styled";
import NeonX from "../NeonX";

type EngineDef = { key: string; label: string; blurb: string; site: string | null };
type MemberRow = {
  memberId: string;
  name: string | null;
  email: string;
  username: string | null;
  enabled: boolean;
  grantedBy: string | null;
  grantedAt: string | null;
};

const PAGE_SIZES = [5, 10, 25, 50];

export default function ProfileEnginesModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  const [engines, setEngines] = useState<EngineDef[]>([]);
  const [engine, setEngine] = useState<string>("");
  const [site, setSite] = useState<string | null>(null);
  const [rows, setRows] = useState<MemberRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (engine) qs.set("engine", engine);
      if (search.trim()) qs.set("search", search.trim());
      const r = await fetch(`/api/admin/profile-engines?${qs}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.ok === false) {
        setError(d.error ?? `HTTP ${r.status}`);
        return;
      }
      setEngines(Array.isArray(d.engines) ? d.engines : []);
      if (!engine && d.engine) setEngine(d.engine);
      setSite(d.site ?? null);
      setRows(Array.isArray(d.rows) ? d.rows : []);
      setTotal(Number(d.total) || 0);
    } catch {
      setError("Couldn't reach the server.");
    }
  }, [engine, page, pageSize, search]);

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const activeEngine = useMemo(() => engines.find((e) => e.key === engine), [engines, engine]);

  const toggle = async (row: MemberRow) => {
    setBusyId(row.memberId);
    const next = !row.enabled;
    const prev = rows;
    setRows((rs) => rs?.map((r) => (r.memberId === row.memberId ? { ...r, enabled: next } : r)) ?? rs);
    try {
      const r = await fetch("/api/admin/profile-engines", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: row.memberId, engine, enabled: next }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.ok === false) {
        setRows(prev ?? null);
        setError(d.error ?? `Set failed (HTTP ${r.status}).`);
      } else {
        setError(null);
        await load();
      }
    } catch {
      setRows(prev ?? null);
      setError("Set failed — couldn't reach the server.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="cyan" $maxWidth="46rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle>Profile Engines</ModalTitle>
              <Sub>Who gets a bespoke Profile tab — per member, per engine</Sub>
            </div>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <Seg>
            {engines.map((e) => (
              <SegBtn
                key={e.key}
                type="button"
                $active={e.key === engine}
                $color={e.key === engine ? colors.cyan : colors.gold}
                onClick={() => {
                  setEngine(e.key);
                  setPage(1);
                }}
              >
                {e.label}
              </SegBtn>
            ))}
          </Seg>

          {activeEngine && (
            <Legend>
              <LegendItem>{activeEngine.blurb}</LegendItem>
              <LegendItem>
                Belongs to <strong>{activeEngine.site ?? "no site"}</strong> — only its members can
                be ticked, and that list is code, not a setting.
              </LegendItem>
            </Legend>
          )}

          <SearchRow>
            <SearchInput
              value={search}
              placeholder="Search members by name, email or handle…"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </SearchRow>

          {error && <ErrText>{error}</ErrText>}

          {!rows ? (
            <Dim>Loading…</Dim>
          ) : rows.length === 0 ? (
            <Dim>No members match.</Dim>
          ) : (
            <List>
              {rows.map((r) => (
                <Row key={r.memberId} $on={r.enabled}>
                  <RowLeft>
                    <FName>{r.name ?? r.username ?? r.email}</FName>
                    <FMeta>
                      {r.email}
                      {r.enabled && r.grantedBy ? ` · granted by ${r.grantedBy}` : ""}
                    </FMeta>
                  </RowLeft>
                  <Check
                    type="button"
                    role="switch"
                    aria-checked={r.enabled}
                    aria-label={`${r.enabled ? "Revoke" : "Grant"} ${activeEngine?.label ?? engine} for ${r.email}`}
                    $on={r.enabled}
                    disabled={busyId === r.memberId}
                    onClick={() => void toggle(r)}
                  >
                    {r.enabled ? "✓" : ""}
                  </Check>
                </Row>
              ))}
            </List>
          )}

          <TpgRow>
            <TpgInfo>
              Page {page} of {pages} · {total} result{total === 1 ? "" : "s"}
            </TpgInfo>
            <TpgControls>
              <TpgSelect
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </TpgSelect>
              <TpgBtn type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                ‹
              </TpgBtn>
              <TpgBtn
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
              >
                ›
              </TpgBtn>
            </TpgControls>
          </TpgRow>

          <Note>
            Ticking a member unlocks the engine on their dashboard for that site; unticking keeps
            the row and records the withdrawal. Every change is audited. For Refusionist this also
            sets the site&apos;s own <code>cosmic_profile_enabled</code> flag, which is what the
            live app still reads — until its tables move to the shared schema.
          </Note>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}

/* ── styles ─────────────────────────────────────────────────────────────── */
const Sub = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  letter-spacing: 0.04em;
  margin-top: 0.125rem;
`;
const Legend = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.7rem 0.85rem;
  margin: 0.75rem 0 1rem;
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
`;
const LegendItem = styled.div`
  font-size: 0.74rem;
  color: var(--t-textFaint);
  strong {
    color: var(--t-text);
  }
`;
const SearchRow = styled.div`
  display: flex;
  margin-bottom: 0.6rem;
`;
const SearchInput = styled.input`
  flex: 1 1 auto;
  padding: 0.45rem 0.7rem;
  font-size: 0.8rem;
  color: var(--t-text);
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
  &:focus {
    outline: none;
    border-color: ${colors.cyan};
  }
`;
const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;
const Row = styled.div<{ $on: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid rgba(${(p) => (p.$on ? rgb.cyan : rgb.gold)}, 0.16);
  border-radius: 0.5rem;
  background: rgba(${(p) => (p.$on ? rgb.cyan : rgb.gold)}, 0.04);
`;
const RowLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
`;
const FName = styled.div`
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--t-text);
`;
const FMeta = styled.div`
  font-size: 0.68rem;
  color: var(--t-textFaint);
  font-family: var(--font-geist-mono), monospace;
`;
const Seg = styled.div`
  display: flex;
  gap: 0.25rem;
  flex: 0 0 auto;
`;
const SegBtn = styled.button<{ $active: boolean; $color: string }>`
  padding: 0.25rem 0.7rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: 999px;
  cursor: pointer;
  background: ${(p) => (p.$active ? p.$color : "transparent")};
  color: ${(p) => (p.$active ? "#0a0a0a" : "var(--t-textFaint)")};
  border: 1px solid ${(p) => (p.$active ? p.$color : "var(--t-border)")};
  transition: all 0.12s;
  &:hover:not(:disabled) {
    border-color: ${(p) => p.$color};
  }
`;
const Check = styled.button<{ $on: boolean }>`
  width: 1.5rem;
  height: 1.5rem;
  flex: 0 0 auto;
  border-radius: 0.35rem;
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1;
  color: #0a0a0a;
  background: ${(p) => (p.$on ? colors.cyan : "transparent")};
  border: 1px solid ${(p) => (p.$on ? colors.cyan : "var(--t-border)")};
  transition: all 0.12s;
  &:hover:not(:disabled) {
    border-color: ${colors.cyan};
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
const TpgRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.75rem;
`;
const TpgInfo = styled.div`
  font-size: 0.72rem;
  color: var(--t-textFaint);
`;
const TpgControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;
const TpgSelect = styled.select`
  padding: 0.25rem 0.5rem;
  font-size: 0.72rem;
  color: var(--t-text);
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
`;
const TpgBtn = styled.button`
  padding: 0.25rem 0.65rem;
  font-size: 0.85rem;
  border-radius: 0.5rem;
  cursor: pointer;
  color: var(--t-text);
  background: transparent;
  border: 1px solid var(--t-border);
  &:hover:not(:disabled) {
    border-color: ${colors.cyan};
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;
const Dim = styled.div`
  color: var(--t-textFaint);
  font-size: 0.78rem;
`;
const Note = styled.div`
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--t-textFaint);
  margin-top: 1rem;
  code {
    font-family: var(--font-geist-mono), monospace;
    font-size: 0.68rem;
  }
`;
const ErrText = styled.div`
  font-size: 0.75rem;
  color: ${colors.pink};
  margin-bottom: 0.6rem;
`;

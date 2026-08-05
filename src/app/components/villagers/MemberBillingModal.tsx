"use client";

// MemberBillingModal — Office → Villagers → Billing. Every invoice TGV has issued to one villager,
// what's still outstanding, and what their wallet could cover it with.
//
// The list itself is @tgv/module-component-library's BillingPanel — the SAME component the villager
// sees in their own Wallet → Billing. That's the point: when an operator and a member are on the
// phone about an invoice, they should be looking at one rendering of one answer, not at two
// surfaces built a month apart that round differently.
//
// READ ONLY, structurally. The panel takes `readOnly`, the Office proxy has no pay endpoint to
// call, and tgv.com's pay route accepts no internal-secret caller. Settling an invoice spends the
// villager's tokens; that's theirs to do.
//
// Opens two ways: as its own tile (search for the villager first), or pre-scoped from the member
// lookup's Billing card, which already knows who it's about.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import BillingPanel from "@tgv/module-component-library/components/billing/BillingPanel";
import { rgb } from "@/app/theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
} from "@/app/styled";
import NeonX from "../NeonX";

type Member = { id: string; email: string; name: string | null; role: string | null };

const labelOf = (m: Member) => m.name?.trim() || m.email;

export default function MemberBillingModal({
  member: fixed = null,
  onClose,
}: {
  /** Pre-scoped from the member lookup. Omit → the modal searches first. */
  member?: Member | null;
  onClose: () => void;
}) {
  useEscapeToClose({ open: true, onClose });

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Member | null>(fixed);

  // Debounced member search (same contract as MemberWalletModal).
  useEffect(() => {
    if (fixed) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/villagers/members?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        const d = (await res.json().catch(() => ({}))) as { members?: Member[] };
        setResults(Array.isArray(d.members) ? d.members : []);
      } catch {
        /* aborted or offline — leave the last results up rather than blanking the list */
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query, fixed]);

  const pick = useCallback((m: Member) => {
    setSelected(m);
    setResults([]);
    setQuery("");
  }, []);

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle>Billing{selected ? ` — ${labelOf(selected)}` : ""}</ModalTitle>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          {!fixed && (
            <Search>
              <SearchInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a villager by name or email…"
                aria-label="Search villagers"
              />
              {searching && <Hint>Searching…</Hint>}
              {results.length > 0 && (
                <Results>
                  {results.map((m) => (
                    <Result key={m.id} type="button" onClick={() => pick(m)}>
                      <strong>{labelOf(m)}</strong>
                      <span>{m.email}</span>
                    </Result>
                  ))}
                </Results>
              )}
            </Search>
          )}

          {selected ? (
            <>
              <Who>
                <strong>{labelOf(selected)}</strong>
                <span>{selected.email}</span>
                {!fixed && (
                  <Change type="button" onClick={() => setSelected(null)}>
                    Change
                  </Change>
                )}
              </Who>
              <BillingPanel
                apiBase="/api/admin/villagers/member-invoices"
                memberId={selected.id}
                readOnly
                bare
              />
              <Hint>
                Read-only. Settling an invoice spends the villager&apos;s own tokens, so it happens
                from their wallet, not from here.
              </Hint>
            </>
          ) : (
            <Hint>Search for a villager to see everything TGV has billed them.</Hint>
          )}
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}

const Search = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
`;
const SearchInput = styled.input`
  width: 100%;
  padding: 9px 12px;
  border-radius: 9px;
  font-size: 13px;
  color: #fff;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(${rgb.gold}, 0.35);
  &:focus {
    outline: none;
    border-color: rgba(${rgb.gold}, 0.7);
  }
`;
const Results = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 9px;
  padding: 4px;
`;
const Result = styled.button`
  display: flex;
  flex-direction: column;
  gap: 1px;
  text-align: left;
  padding: 7px 9px;
  border: none;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.82);
  strong {
    font-size: 13px;
    color: #fff;
  }
  span {
    font-size: 11.5px;
    color: rgba(255, 255, 255, 0.45);
  }
  &:hover {
    background: rgba(${rgb.gold}, 0.14);
  }
`;
const Who = styled.div`
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.55);
  strong {
    font-size: 14px;
    color: #fff;
  }
`;
const Change = styled.button`
  font-size: 11px;
  font-weight: 700;
  padding: 4px 9px;
  border-radius: 7px;
  cursor: pointer;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: transparent;
`;
const Hint = styled.div`
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.45);
  margin-top: 10px;
`;

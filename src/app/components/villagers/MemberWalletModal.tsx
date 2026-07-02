"use client";

// MemberWalletModal — first tile of the VILLAGERS operator surface. An operator searches a TGV
// member (villager), sees their 3-bucket token wallet (Cash / Available / Retainer, live + test),
// and RELEASES retainer tokens → Available or Cash on the member's behalf (the admin "gear").
//
// The move runs tgv.com's audited, advisory-locked, balance-conserving relocate engine via the
// internal-secret proxy (/api/admin/villagers/retainer-relocate); reads come straight from tgv_db
// (/members, /member-wallet). Operator-only — requireAdmin guards every route.
//
// Plain modal shell (like Domain Console), not the HardeningControlModal — this isn't a security
// surface. "Configure on behalf of the TGV tenant" = exactly this.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
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

type Member = { id: string; email: string; name: string | null; role: string | null };
type Buckets = { cash: number; available: number; retainer: number };
type Balances = { live: Buckets; test: Buckets };
type Lane = "live" | "test";
type Target = "available" | "cash";

const usd = (tokens: number) => `$${(tokens * 0.25).toFixed(2)}`; // 1 token = $0.25

export default function MemberWalletModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [lane, setLane] = useState<Lane>("live");
  const [amountStr, setAmountStr] = useState("");
  const [target, setTarget] = useState<Target>("available");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Debounced member search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/villagers/members?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok) setResults(Array.isArray(d.members) ? d.members : []);
      } catch {
        /* aborted / network — ignore */
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  const loadBalances = useCallback(async (memberId: string) => {
    setBalances(null);
    const res = await fetch(`/api/admin/villagers/member-wallet?memberId=${memberId}`, { cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) setBalances(d.balances as Balances);
  }, []);

  const selectMember = (m: Member) => {
    setSelected(m);
    setResults([]);
    setQuery("");
    setMsg(null);
    setAmountStr("");
    void loadBalances(m.id);
  };

  const retainer = balances ? balances[lane].retainer : 0;
  const amount = Math.max(0, Math.floor(Number(amountStr) || 0));
  const overBalance = amount > retainer;
  const canMove = !!selected && !!balances && amount > 0 && !overBalance && !busy;

  const doRelocate = async () => {
    if (!selected || !canMove) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/villagers/retainer-relocate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberId: selected.id,
          amountTokens: amount,
          target,
          env: lane,
          moveId: crypto.randomUUID(),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d?.ok === false) {
        setMsg({ kind: "err", text: d?.error ? `Move failed: ${d.error}` : `Move failed (HTTP ${res.status}).` });
      } else {
        setMsg({ kind: "ok", text: `Moved ${amount} tok (${usd(amount)}) Retainer → ${target} on ${lane}.` });
        setAmountStr("");
        await loadBalances(selected.id);
      }
    } catch {
      setMsg({ kind: "err", text: "Move failed — couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="gold" $maxWidth="44rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle>Member Wallet</ModalTitle>
              <Sub>Search a villager · view their token buckets · release retainer on their behalf</Sub>
            </div>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <Stack>
            <div>
              <Label>Find a villager</Label>
              <SearchInput
                placeholder="Search by email or name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              {searching && <Dim>Searching…</Dim>}
              {results.length > 0 && (
                <Results>
                  {results.map((m) => (
                    <ResultRow key={m.id} type="button" onClick={() => selectMember(m)}>
                      <strong>{m.email}</strong>
                      <Dim>{m.name ?? "—"}{m.role ? ` · ${m.role}` : ""}</Dim>
                    </ResultRow>
                  ))}
                </Results>
              )}
            </div>

            {selected && (
              <Card>
                <MemberHead>
                  <div>
                    <strong>{selected.email}</strong> <Dim>{selected.name ?? ""}</Dim>
                  </div>
                  <Mono>{selected.id.slice(0, 8)}</Mono>
                </MemberHead>

                {!balances ? (
                  <Dim>Loading balances…</Dim>
                ) : (
                  <>
                    <LaneTabs>
                      {(["live", "test"] as Lane[]).map((l) => (
                        <LaneTab key={l} type="button" $active={lane === l} onClick={() => setLane(l)}>
                          {l}
                        </LaneTab>
                      ))}
                    </LaneTabs>
                    <BucketsRow>
                      <Bucket>
                        <BLabel>Cash</BLabel>
                        <BVal>{balances[lane].cash} <Dim>({usd(balances[lane].cash)})</Dim></BVal>
                      </Bucket>
                      <Bucket>
                        <BLabel>Available</BLabel>
                        <BVal>{balances[lane].available} <Dim>({usd(balances[lane].available)})</Dim></BVal>
                      </Bucket>
                      <Bucket $accent>
                        <BLabel>Retainer</BLabel>
                        <BVal>{balances[lane].retainer} <Dim>({usd(balances[lane].retainer)})</Dim></BVal>
                      </Bucket>
                    </BucketsRow>

                    <Note>
                      Release retainer (custom-work-only) into a spendable / withdrawable bucket on the
                      member&apos;s behalf. This is an audited token MOVE — it conserves their total balance.
                    </Note>
                    <MoveRow>
                      <NumInput
                        type="number"
                        min={0}
                        max={retainer}
                        placeholder="tokens"
                        value={amountStr}
                        onChange={(e) => setAmountStr(e.target.value)}
                        disabled={busy || retainer === 0}
                      />
                      <Arrow>→</Arrow>
                      <Select value={target} onChange={(e) => setTarget(e.target.value as Target)} disabled={busy}>
                        <option value="available">Available</option>
                        <option value="cash">Cash</option>
                      </Select>
                      <MoveBtn type="button" disabled={!canMove} onClick={doRelocate}>
                        {busy ? "Moving…" : "Move"}
                      </MoveBtn>
                    </MoveRow>
                    {amountStr && overBalance && (
                      <ErrText>Amount exceeds the {lane} retainer balance ({retainer} tok).</ErrText>
                    )}
                    {msg && (msg.kind === "ok" ? <OkText>{msg.text}</OkText> : <ErrText>{msg.text}</ErrText>)}
                  </>
                )}
              </Card>
            )}

            <Note style={{ opacity: 0.75 }}>
              More villager controls (payouts, entitlements, profile) will join this surface as Villagers grows.
            </Note>
          </Stack>
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
const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;
const Label = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${colors.gold};
  margin-bottom: 0.35rem;
`;
const SearchInput = styled.input`
  width: 100%;
  padding: 0.5rem 0.65rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--t-border);
  border-radius: 0.45rem;
  color: var(--t-text);
  font-size: 0.85rem;
  &:focus { outline: none; border-color: rgba(${rgb.cyan}, 0.6); }
`;
const Results = styled.div`
  margin-top: 0.4rem;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--t-border);
  border-radius: 0.45rem;
  overflow: hidden;
  max-height: 14rem;
  overflow-y: auto;
`;
const ResultRow = styled.button`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  text-align: left;
  padding: 0.5rem 0.65rem;
  background: transparent;
  border: 0;
  border-bottom: 1px solid rgba(${rgb.gold}, 0.08);
  cursor: pointer;
  color: var(--t-text);
  font-size: 0.8rem;
  &:hover { background: rgba(${rgb.cyan}, 0.08); }
  &:last-child { border-bottom: 0; }
`;
const Dim = styled.span`
  color: var(--t-textFaint);
  font-size: 0.72rem;
`;
const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(${rgb.gold}, 0.18);
  border-radius: 0.625rem;
  background: rgba(${rgb.gold}, 0.04);
`;
const MemberHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.85rem;
`;
const Mono = styled.span`
  font-family: var(--font-geist-mono), monospace;
  color: ${colors.cyan};
  font-size: 0.72rem;
`;
const LaneTabs = styled.div`
  display: flex;
  gap: 0.3rem;
`;
const LaneTab = styled.button<{ $active: boolean }>`
  padding: 0.2rem 0.7rem;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: 999px;
  cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.cyan}, 0.15)` : "transparent")};
  color: ${(p) => (p.$active ? colors.cyan : "var(--t-textFaint)")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.cyan}, 0.55)` : "var(--t-border)")};
`;
const BucketsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
`;
const Bucket = styled.div<{ $accent?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.55rem 0.65rem;
  border-radius: 0.45rem;
  border: 1px solid ${(p) => (p.$accent ? "rgba(245, 158, 11, 0.5)" : "var(--t-border)")};
  background: ${(p) => (p.$accent ? "rgba(245, 158, 11, 0.08)" : "rgba(0,0,0,0.2)")};
`;
const BLabel = styled.div`
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--t-textFaint);
`;
const BVal = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--t-text);
`;
const Note = styled.div`
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--t-textFaint);
`;
const MoveRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;
const Arrow = styled.span`
  color: var(--t-textFaint);
`;
const NumInput = styled.input`
  flex: 0 0 8rem;
  width: 8rem;
  text-align: right;
  padding: 0.4rem 0.55rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--t-border);
  border-radius: 0.375rem;
  color: var(--t-text);
  font-size: 0.8rem;
  &:focus { outline: none; border-color: rgba(${rgb.cyan}, 0.6); }
  &:disabled { opacity: 0.5; }
`;
const Select = styled.select`
  padding: 0.4rem 0.55rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--t-border);
  border-radius: 0.375rem;
  color: var(--t-text);
  font-size: 0.8rem;
  &:focus { outline: none; border-color: rgba(${rgb.cyan}, 0.6); }
`;
const MoveBtn = styled.button`
  padding: 0.45rem 1rem;
  font-size: 0.8rem;
  border-radius: 0.4rem;
  cursor: pointer;
  background: rgba(${rgb.cyan}, 0.14);
  border: 1px solid rgba(${rgb.cyan}, 0.55);
  color: ${colors.cyan};
  &:hover:not(:disabled) { background: rgba(${rgb.cyan}, 0.24); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;
const ErrText = styled.div`
  font-size: 0.75rem;
  color: ${colors.pink};
`;
const OkText = styled.div`
  font-size: 0.75rem;
  color: #4ade80;
`;

"use client";

// MoneyStoresModal — the operator console for a villager site's per-site "Money & Stores" config
// (Villagers → Money & Stores tile). Money & Stores moved OFF the villager dashboard to TGV Office
// (2026-07-07): an operator picks a site, then sets its two independent owner-config axes —
//   • WALLET  — pooled (one wallet shared across the owner's sites, the default) vs a separate pool.
//   • STRIPE  — the site's own managed account vs sharing another of the owner's sites' Stripe account.
//
// Office holds no money state: every read/write proxies to tgv.com's /api/platform/site-money via the
// internal-secret seam (money-proxy.ts). tgv.com resolves the site's OWNER and re-validates ownership.
// Operator-only (requireAdmin on the route; the whole Villagers surface is admin-gated).

import { useCallback, useEffect, useState } from "react";
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

type Tenant = {
  id: string;
  client_name: string;
  domain: string;
  env: string;
  connected_account_id: number | null;
};
type MoneyConfig = { walletGroupId: string | null; stripeAccountRef: string | null };
type ShareSite = { siteId: string; name: string; connectedAccountId: string };
type Msg = { kind: "ok" | "err"; text: string } | null;

export default function MoneyStoresModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  const [query, setQuery] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searching, setSearching] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  const [config, setConfig] = useState<MoneyConfig | null>(null);
  const [shareSites, setShareSites] = useState<ShareSite[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  // Debounced tenant/site search (mirrors ManagedOnboardingModal).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setTenants([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/villagers/tenants?q=${encodeURIComponent(q)}`, { cache: "no-store", signal: ctrl.signal });
        const d = await res.json().catch(() => ({}));
        if (res.ok) setTenants(Array.isArray(d.tenants) ? d.tenants : []);
      } catch {
        /* aborted */
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const loadConfig = useCallback(async (siteId: string) => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/villagers/site-money?siteId=${encodeURIComponent(siteId)}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setConfig(d.config as MoneyConfig);
        setShareSites(Array.isArray(d.shareSites) ? d.shareSites : []);
      } else {
        setConfig(null);
        setMsg({ kind: "err", text: d?.error ? `Load: ${d.error}` : `Load failed (HTTP ${res.status}).` });
      }
    } catch {
      setMsg({ kind: "err", text: "Couldn't reach the server." });
    } finally {
      setLoading(false);
    }
  }, []);

  const selectTenant = (t: Tenant) => {
    setTenant(t);
    setTenants([]);
    setQuery("");
    setConfig(null);
    setShareSites([]);
    void loadConfig(t.id);
  };

  const save = useCallback(
    async (patch: Record<string, unknown>, okText: string) => {
      if (!tenant) return;
      setBusy(true);
      setMsg(null);
      try {
        const res = await fetch("/api/admin/villagers/site-money", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ siteId: tenant.id, ...patch }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.ok) {
          setMsg({ kind: "err", text: d?.error ? `Save: ${d.error}` : `Save failed (HTTP ${res.status}).` });
          return;
        }
        setConfig(d.config as MoneyConfig);
        setMsg({ kind: "ok", text: okText });
      } catch {
        setMsg({ kind: "err", text: "Save failed — couldn't reach the server." });
      } finally {
        setBusy(false);
      }
    },
    [tenant],
  );

  const pooled = config ? config.walletGroupId === null : true;
  const ownAccount = config ? config.stripeAccountRef === null : true;

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="green" $maxWidth="44rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle>Money &amp; Stores</ModalTitle>
              <Sub>Per-site wallet &amp; Stripe config — pick a villager site, then set its two axes.</Sub>
            </div>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <Stack>
            {/* Site search */}
            <div>
              <Label>Find a villager site</Label>
              <SearchInput
                placeholder="Search by client name or domain…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              {searching && <Dim>Searching…</Dim>}
              {tenants.length > 0 && (
                <Results>
                  {tenants.map((t) => (
                    <ResultRow key={t.id} type="button" onClick={() => selectTenant(t)}>
                      <strong>{t.client_name}</strong>
                      <Dim>
                        {t.domain} · {t.env}
                        {t.connected_account_id ? " · linked" : ""}
                      </Dim>
                    </ResultRow>
                  ))}
                </Results>
              )}
            </div>

            {tenant && (
              <Card>
                <Head>
                  <div>
                    <strong>{tenant.client_name}</strong> <Dim>{tenant.domain}</Dim>
                  </div>
                  <Mono>{tenant.id.slice(0, 8)}</Mono>
                </Head>

                {loading ? (
                  <Dim>Loading config…</Dim>
                ) : config ? (
                  <>
                    {/* WALLET axis */}
                    <Axis>
                      <AxisTitle>Wallet</AxisTitle>
                      <AxisHint>
                        Pooled shares one wallet across all of this owner&apos;s sites (default). Separate keeps this
                        site&apos;s takings in their own pool.
                      </AxisHint>
                      <Options>
                        <OptBtn type="button" $on={pooled} disabled={busy} onClick={() => save({ axis: "wallet", pooled: true }, "Wallet set to pooled.")}>
                          Pooled (shared)
                        </OptBtn>
                        <OptBtn type="button" $on={!pooled} disabled={busy} onClick={() => save({ axis: "wallet", pooled: false }, "Wallet set to a separate pool.")}>
                          Separate wallet
                        </OptBtn>
                      </Options>
                    </Axis>

                    {/* STRIPE axis */}
                    <Axis>
                      <AxisTitle>Stripe account</AxisTitle>
                      <AxisHint>
                        Use this site&apos;s own managed account, or share another of the owner&apos;s sites&apos; Stripe
                        account (charges settle into that account).
                      </AxisHint>
                      <Options>
                        <OptBtn type="button" $on={ownAccount} disabled={busy} onClick={() => save({ axis: "stripe", shareFromMemberId: null }, "Using this site's own managed account.")}>
                          Own account
                        </OptBtn>
                        {shareSites.map((s) => (
                          <OptBtn
                            key={s.siteId}
                            type="button"
                            $on={false}
                            disabled={busy}
                            onClick={() => save({ axis: "stripe", shareFromMemberId: s.siteId }, `Sharing ${s.name}'s Stripe account.`)}
                          >
                            Share: {s.name}
                          </OptBtn>
                        ))}
                      </Options>
                      {!ownAccount && <Mono>current: {config.stripeAccountRef}</Mono>}
                      {ownAccount && shareSites.length === 0 && (
                        <Dim>No other owned sites with a managed account to share from.</Dim>
                      )}
                    </Axis>
                  </>
                ) : (
                  <Dim>No config available for this site.</Dim>
                )}

                {msg && (msg.kind === "ok" ? <OkText>{msg.text}</OkText> : <ErrText>{msg.text}</ErrText>)}
              </Card>
            )}

            <Note>
              Money &amp; Stores lives on TGV Office now (not the villager dashboard). tgv.com is the authority:
              it resolves the site&apos;s owner and re-validates ownership before any wallet/Stripe change. Pooling
              never crosses owners.
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
  gap: 0.85rem;
`;
const Label = styled.div`
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--t-textFaint);
  margin-bottom: 0.3rem;
`;
const SearchInput = styled.input`
  width: 100%;
  padding: 0.5rem 0.65rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--t-border);
  border-radius: 0.45rem;
  color: var(--t-text);
  font-size: 0.85rem;
  &:focus {
    outline: none;
    border-color: rgba(${rgb.green}, 0.6);
  }
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
  gap: 0.15rem;
  align-items: flex-start;
  text-align: left;
  padding: 0.5rem 0.65rem;
  background: rgba(0, 0, 0, 0.2);
  border: none;
  border-bottom: 1px solid var(--t-border);
  cursor: pointer;
  color: var(--t-text);
  font-size: 0.82rem;
  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: rgba(${rgb.green}, 0.1);
  }
`;
const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(${rgb.green}, 0.18);
  border-radius: 0.625rem;
  background: rgba(${rgb.green}, 0.04);
`;
const Head = styled.div`
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
  word-break: break-all;
`;
const Axis = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--t-border);
`;
const AxisTitle = styled.div`
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--t-text);
`;
const AxisHint = styled.div`
  font-size: 0.72rem;
  line-height: 1.4;
  color: var(--t-textFaint);
`;
const Options = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.15rem;
`;
const OptBtn = styled.button<{ $on: boolean }>`
  padding: 0.4rem 0.85rem;
  font-size: 0.78rem;
  border-radius: 0.4rem;
  cursor: pointer;
  color: ${(p) => (p.$on ? colors.green : "var(--t-text)")};
  background: ${(p) => (p.$on ? `rgba(${rgb.green}, 0.16)` : "rgba(0,0,0,0.25)")};
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.green}, 0.6)` : "var(--t-border)")};
  &:hover:not(:disabled) {
    border-color: rgba(${rgb.green}, 0.5);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
const Note = styled.div`
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--t-textFaint);
`;
const Dim = styled.span`
  color: var(--t-textFaint);
  font-size: 0.72rem;
`;
const ErrText = styled.div`
  font-size: 0.75rem;
  color: ${colors.pink};
`;
const OkText = styled.div`
  font-size: 0.75rem;
  color: ${colors.green};
`;

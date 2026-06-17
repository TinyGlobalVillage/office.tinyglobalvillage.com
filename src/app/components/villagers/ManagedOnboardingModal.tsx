"use client";

// ManagedOnboardingModal — the operator "Admin Wizard" for TGV-managed Stripe onboarding.
//
// An operator sets up a managed connected account ON BEHALF OF a tenant (a members row), watches the
// embedded Stripe onboarding, and — once the account is `ready` (charges_enabled) — proves the rail
// with a test charge. The setup auto-populates the tenant's own dashboard (members.connected_account_id).
//
// PREVIEW TOGGLE (the reusable "Admin Wizard" convention): flip Preview ON to run the WHOLE pipeline
// in Stripe TEST mode with auto-filled fixtures — create → embedded onboarding → ready → test charge —
// so we can see the end-to-end flow for any pathway without touching live money. Preview is the
// default (safe); flip it OFF to provision for real.
//
// Office holds no Stripe keys: every action proxies to tgv.com via the internal-secret seam, which
// enforces the HARD RULE (no charge until charges_enabled). Operator-only (requireAdmin on each route).

import { useCallback, useEffect, useRef, useState } from "react";
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
import EmbeddedManagedOnboarding from "./EmbeddedManagedOnboarding";

type Tenant = {
  id: string;
  client_name: string;
  domain: string;
  env: "live" | "test";
  stripe_mode: string;
  connected_account_id: number | null;
  contact_email: string | null;
};

type Account = {
  stripeAccountId: string;
  env: "live" | "test";
  onboardingState: "none" | "onboarding" | "ready";
  chargesEnabled: boolean;
  merchantReady: boolean;
  displayName: string | null;
  onboardingCompletedAt: string | null;
} | null;

type Env = "live" | "test";

const PREVIEW_FIXTURES = {
  displayName: "TGV Preview Merchant",
  contactEmail: "preview+managed@tgv.test",
  country: "US",
};

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function ManagedOnboardingModal({ onClose }: { onClose: () => void }) {
  // Preview ON (env=test) is the safe default — provisioning live requires flipping it off.
  const [preview, setPreview] = useState(true);
  const env: Env = preview ? "test" : "live";

  const [query, setQuery] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searching, setSearching] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  const [account, setAccount] = useState<Account>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [country, setCountry] = useState("US");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Test-charge proof inputs.
  const [chgAmount, setChgAmount] = useState("12.34");
  const [chgFee, setChgFee] = useState("2.00");
  const [charging, setCharging] = useState(false);

  // Hosted-onboarding fallback (Stripe's own full-page flow, no iframe/overlay).
  const [hosting, setHosting] = useState(false);

  // Debounced tenant search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setTenants([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/villagers/tenants?q=${encodeURIComponent(q)}`, { cache: "no-store", signal: ctrl.signal });
        const d = await res.json().catch(() => ({}));
        if (res.ok) setTenants(Array.isArray(d.tenants) ? d.tenants : []);
      } catch { /* aborted */ } finally { setSearching(false); }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  const loadStatus = useCallback(async (memberId: string, e: Env) => {
    setLoadingStatus(true);
    try {
      const res = await fetch(`/api/admin/villagers/managed-status?memberId=${memberId}&env=${e}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setAccount(d.account ?? null);
        setPublishableKey(d.publishableKey ?? null);
      } else {
        setMsg({ kind: "err", text: d?.error ? `Status: ${d.error}` : `Status failed (HTTP ${res.status}).` });
      }
    } finally { setLoadingStatus(false); }
  }, []);

  const selectTenant = (t: Tenant) => {
    setTenant(t);
    setTenants([]);
    setQuery("");
    setMsg(null);
    setDisplayName(preview ? PREVIEW_FIXTURES.displayName : t.client_name);
    setContactEmail(preview ? PREVIEW_FIXTURES.contactEmail : (t.contact_email ?? ""));
    setCountry("US");
    void loadStatus(t.id, env);
  };

  // Re-load status when the Preview toggle flips (different lane = different account).
  useEffect(() => {
    if (tenant) {
      setDisplayName(preview ? PREVIEW_FIXTURES.displayName : tenant.client_name);
      setContactEmail(preview ? PREVIEW_FIXTURES.contactEmail : (tenant.contact_email ?? ""));
      void loadStatus(tenant.id, env);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  const create = async () => {
    if (!tenant) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/admin/villagers/managed-create?env=${env}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: tenant.id, displayName: displayName.trim(), contactEmail: contactEmail.trim(), country }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ kind: "err", text: d?.error ? `Create: ${d.error}` : `Create failed (HTTP ${res.status}).` }); return; }
      setMsg({ kind: "ok", text: d.created ? `Created managed account ${d.account?.stripeAccountId} (${env}).` : `Account already exists (${env}).` });
      await loadStatus(tenant.id, env);
    } catch { setMsg({ kind: "err", text: "Create failed — couldn't reach the server." }); }
    finally { setBusy(false); }
  };

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    if (!tenant) throw new Error("no tenant");
    const res = await fetch(`/api/admin/villagers/managed-account-session?env=${env}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId: tenant.id }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.clientSecret) throw new Error(d?.error ?? "account_session_failed");
    return d.clientSecret as string;
  }, [tenant, env]);

  const recheck = async () => {
    if (!tenant) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/admin/villagers/managed-recheck?env=${env}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId: tenant.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setAccount(d.account ?? account); setMsg({ kind: "ok", text: `Re-checked — state: ${d.account?.onboardingState ?? "?"}.` }); }
      else setMsg({ kind: "err", text: d?.error ? `Recheck: ${d.error}` : `Recheck failed (HTTP ${res.status}).` });
    } finally { setBusy(false); }
  };

  // Hosted onboarding: mint a Stripe Account Link and open it in a new tab. The reliable path when the
  // embedded country picker won't render inside this modal — Stripe's hosted page has no overlay iframe.
  const openHosted = async () => {
    if (!tenant) return;
    setHosting(true); setMsg(null);
    try {
      const res = await fetch(`/api/admin/villagers/managed-account-link?env=${env}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId: tenant.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.url) { setMsg({ kind: "err", text: d?.error ? `Hosted: ${d.error}` : `Hosted onboarding failed (HTTP ${res.status}).` }); return; }
      window.open(d.url as string, "_blank", "noopener,noreferrer");
      setMsg({ kind: "ok", text: "Opened Stripe hosted onboarding in a new tab. Finish there, then hit Re-check." });
    } catch { setMsg({ kind: "err", text: "Hosted onboarding failed — couldn't reach the server." }); }
    finally { setHosting(false); }
  };

  const runTestCharge = async () => {
    if (!tenant) return;
    setCharging(true); setMsg(null);
    try {
      const res = await fetch(`/api/admin/villagers/managed-charge?env=${env}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberId: tenant.id,
          amountCents: Math.round(Number(chgAmount) * 100),
          applicationFeeAmount: Math.round(Number(chgFee) * 100),
          nonce: crypto.randomUUID(),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ kind: "err", text: d?.error ? `Charge: ${d.error}` : `Charge failed (HTTP ${res.status}).` }); return; }
      setMsg({ kind: "ok", text: `Test charge ${d.status} — ${usd(d.amountCents)} on ${d.stripeAccountId}, fee ${usd(d.applicationFeeAmount)} → platform.` });
    } catch { setMsg({ kind: "err", text: "Charge failed — couldn't reach the server." }); }
    finally { setCharging(false); }
  };

  const state = account?.onboardingState ?? (tenant ? "none" : null);

  return (
    <FlatBackdrop onClick={onClose}>
      <ModalContainer $accent="gold" $maxWidth="48rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle>Managed Onboarding</ModalTitle>
              <Sub>Set up a TGV-managed Stripe account on a tenant&apos;s behalf · obscured under TGV Connect</Sub>
            </div>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <Stack>
            {/* Preview toggle */}
            <PreviewBar $on={preview}>
              <div>
                <PreviewTitle>{preview ? "Preview mode (Stripe TEST)" : "LIVE mode — real provisioning"}</PreviewTitle>
                <Dim>
                  {preview
                    ? "Runs the whole pipeline in test mode with auto-filled details — no real money, nothing linked to a live tenant."
                    : "Creates a REAL managed account under TGV Connect and links it to the tenant. Use deliberately."}
                </Dim>
              </div>
              <Toggle type="button" $on={preview} onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
                <Knob $on={preview} />
                <ToggleLabel>{preview ? "PREVIEW" : "LIVE"}</ToggleLabel>
              </Toggle>
            </PreviewBar>

            {/* Tenant search */}
            <div>
              <Label>Find a tenant (client project)</Label>
              <SearchInput placeholder="Search by client name or domain…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
              {searching && <Dim>Searching…</Dim>}
              {tenants.length > 0 && (
                <Results>
                  {tenants.map((t) => (
                    <ResultRow key={t.id} type="button" onClick={() => selectTenant(t)}>
                      <strong>{t.client_name}</strong>
                      <Dim>{t.domain} · {t.env}{t.connected_account_id ? " · linked" : ""}</Dim>
                    </ResultRow>
                  ))}
                </Results>
              )}
            </div>

            {tenant && (
              <Card>
                <Head>
                  <div><strong>{tenant.client_name}</strong> <Dim>{tenant.domain}</Dim></div>
                  <Mono>{tenant.id.slice(0, 8)} · {env}</Mono>
                </Head>

                {loadingStatus ? (
                  <Dim>Loading status…</Dim>
                ) : state === "none" ? (
                  <>
                    <Note>No managed account in the <strong>{env}</strong> lane yet. {preview ? "Details are pre-filled with test fixtures." : "Confirm the merchant details, then create."}</Note>
                    <FieldRow>
                      <Field><FLabel>Display name</FLabel><TextInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></Field>
                      <Field><FLabel>Contact email</FLabel><TextInput value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></Field>
                      <Field $narrow><FLabel>Country</FLabel><TextInput value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} /></Field>
                    </FieldRow>
                    <Actions>
                      <PrimaryBtn type="button" disabled={busy || !contactEmail.trim()} onClick={create}>
                        {busy ? "Creating…" : preview ? "Create test account" : "Create managed account"}
                      </PrimaryBtn>
                    </Actions>
                  </>
                ) : state === "onboarding" ? (
                  <>
                    <StatePill $tone="pending">Onboarding — not yet ready to charge</StatePill>
                    <Note>Complete Stripe onboarding below. {preview ? "In test mode you can auto-fill and skip through quickly." : ""} When done, re-check to flip the account to <strong>ready</strong>.</Note>
                    {publishableKey ? (
                      <EmbedWrap>
                        <EmbeddedManagedOnboarding publishableKey={publishableKey} fetchClientSecret={fetchClientSecret} onExit={recheck} />
                      </EmbedWrap>
                    ) : (
                      <ErrText>No platform publishable key configured for {env} (set STRIPE_CONNECT_PUBLISHABLE_KEY{env === "test" ? "_TEST" : ""} on tgv.com).</ErrText>
                    )}
                    <Note style={{ opacity: 0.85 }}>
                      Picker not opening in the embed? Use <strong>hosted onboarding</strong> — Stripe&apos;s own page in a new
                      tab (no embed overlay). Finish there, come back, and hit <strong>Re-check</strong>.
                    </Note>
                    <Actions>
                      <SecondaryBtn type="button" disabled={busy} onClick={recheck}>{busy ? "Checking…" : "Re-check status"}</SecondaryBtn>
                      <PrimaryBtn type="button" disabled={hosting} onClick={openHosted}>{hosting ? "Opening…" : "Open hosted onboarding ↗"}</PrimaryBtn>
                    </Actions>
                  </>
                ) : state === "ready" ? (
                  <>
                    <StatePill $tone="ready">✓ Ready — charges enabled</StatePill>
                    <Note>This account can take payments. {account?.onboardingCompletedAt ? `Onboarded ${new Date(account.onboardingCompletedAt).toLocaleString()}.` : ""}</Note>
                    {env === "test" ? (
                      <>
                        <Note style={{ opacity: 0.85 }}>Prove the rail end-to-end: a server-confirmed test charge. The app fee lands on the TGV platform balance.</Note>
                        <ChargeRow>
                          <Field $narrow><FLabel>Amount $</FLabel><TextInput value={chgAmount} onChange={(e) => setChgAmount(e.target.value)} inputMode="decimal" /></Field>
                          <Field $narrow><FLabel>App fee $</FLabel><TextInput value={chgFee} onChange={(e) => setChgFee(e.target.value)} inputMode="decimal" /></Field>
                          <PrimaryBtn type="button" disabled={charging} onClick={runTestCharge}>{charging ? "Charging…" : "Run test charge"}</PrimaryBtn>
                        </ChargeRow>
                      </>
                    ) : (
                      <Note style={{ opacity: 0.85 }}>Live charges are taken from the tenant&apos;s own dashboard (the hard rule still re-verifies charges_enabled on every charge).</Note>
                    )}
                    <Actions>
                      <SecondaryBtn type="button" disabled={busy} onClick={recheck}>{busy ? "Checking…" : "Re-check"}</SecondaryBtn>
                    </Actions>
                  </>
                ) : null}

                {msg && (msg.kind === "ok" ? <OkText>{msg.text}</OkText> : <ErrText>{msg.text}</ErrText>)}
              </Card>
            )}
          </Stack>
        </ModalBody>
      </ModalContainer>
    </FlatBackdrop>
  );
}

/* ── styles ─────────────────────────────────────────────────────────────── */
// Stripe's embedded Connect components break when ANY ancestor has a CSS filter/backdrop-filter/
// transform/perspective — those create a containing block that misroutes pointer hit-testing into the
// iframe, so the onboarding form renders but is 100% unclickable. The shared ModalBackdrop applies
// `backdrop-filter: blur(6px)`; we override it to none ONLY for this modal so the embed is interactive.
const FlatBackdrop = styled(ModalBackdrop)`backdrop-filter: none; -webkit-backdrop-filter: none;`;
const Sub = styled.div`font-size: 0.75rem; color: var(--t-textFaint); letter-spacing: 0.04em; margin-top: 0.125rem;`;
const Stack = styled.div`display: flex; flex-direction: column; gap: 1rem;`;
const Label = styled.div`font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: ${colors.gold}; margin-bottom: 0.35rem;`;
const SearchInput = styled.input`width: 100%; padding: 0.5rem 0.65rem; background: rgba(0,0,0,0.3); border: 1px solid var(--t-border); border-radius: 0.45rem; color: var(--t-text); font-size: 0.85rem; &:focus { outline: none; border-color: rgba(${rgb.cyan}, 0.6); }`;
const Results = styled.div`margin-top: 0.4rem; display: flex; flex-direction: column; border: 1px solid var(--t-border); border-radius: 0.45rem; overflow: hidden; max-height: 14rem; overflow-y: auto;`;
const ResultRow = styled.button`display: flex; flex-direction: column; gap: 0.1rem; text-align: left; padding: 0.5rem 0.65rem; background: transparent; border: 0; border-bottom: 1px solid rgba(${rgb.gold}, 0.08); cursor: pointer; color: var(--t-text); font-size: 0.8rem; &:hover { background: rgba(${rgb.cyan}, 0.08); } &:last-child { border-bottom: 0; }`;
const Dim = styled.span`color: var(--t-textFaint); font-size: 0.72rem;`;
const Card = styled.div`display: flex; flex-direction: column; gap: 0.7rem; padding: 0.85rem 1rem; border: 1px solid rgba(${rgb.gold}, 0.18); border-radius: 0.625rem; background: rgba(${rgb.gold}, 0.04);`;
const Head = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; font-size: 0.85rem;`;
const Mono = styled.span`font-family: var(--font-geist-mono), monospace; color: ${colors.cyan}; font-size: 0.72rem;`;
const Note = styled.div`font-size: 0.72rem; line-height: 1.45; color: var(--t-textFaint);`;
const FieldRow = styled.div`display: flex; gap: 0.5rem; flex-wrap: wrap;`;
const ChargeRow = styled.div`display: flex; gap: 0.5rem; align-items: flex-end; flex-wrap: wrap;`;
const Field = styled.div<{ $narrow?: boolean }>`display: flex; flex-direction: column; gap: 0.2rem; flex: ${(p) => (p.$narrow ? "0 0 6rem" : "1 1 12rem")};`;
const FLabel = styled.div`font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--t-textFaint);`;
const TextInput = styled.input`width: 100%; padding: 0.4rem 0.55rem; background: rgba(0,0,0,0.3); border: 1px solid var(--t-border); border-radius: 0.375rem; color: var(--t-text); font-size: 0.8rem; &:focus { outline: none; border-color: rgba(${rgb.cyan}, 0.6); }`;
const Actions = styled.div`display: flex; gap: 0.5rem; flex-wrap: wrap;`;
const PrimaryBtn = styled.button`padding: 0.45rem 1rem; font-size: 0.8rem; border-radius: 0.4rem; cursor: pointer; background: rgba(${rgb.cyan}, 0.14); border: 1px solid rgba(${rgb.cyan}, 0.55); color: ${colors.cyan}; &:hover:not(:disabled) { background: rgba(${rgb.cyan}, 0.24); } &:disabled { opacity: 0.5; cursor: not-allowed; }`;
const SecondaryBtn = styled.button`padding: 0.4rem 0.85rem; font-size: 0.78rem; border-radius: 0.4rem; cursor: pointer; background: transparent; border: 1px solid var(--t-border); color: var(--t-text); &:hover:not(:disabled) { border-color: rgba(${rgb.cyan}, 0.5); } &:disabled { opacity: 0.5; }`;
// No max-height / overflow here ON PURPOSE: Stripe's embedded onboarding renders its own dropdowns
// (e.g. Business location) as in-flow popovers, and a nested clipping container would cut them off
// below the fold — they'd be unreachable. Let the embed size itself; ModalBody (overflow-y:auto) scrolls.
const EmbedWrap = styled.div`background: var(--t-bg); border: 1px solid var(--t-border); border-radius: 0.5rem; padding: 0.25rem;`;
const ErrText = styled.div`font-size: 0.75rem; color: ${colors.pink};`;
const OkText = styled.div`font-size: 0.75rem; color: #4ade80;`;
const StatePill = styled.div<{ $tone: "pending" | "ready" }>`align-self: flex-start; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; padding: 0.2rem 0.6rem; border-radius: 999px; border: 1px solid ${(p) => (p.$tone === "ready" ? "rgba(74,222,128,0.5)" : "rgba(245,158,11,0.5)")}; background: ${(p) => (p.$tone === "ready" ? "rgba(74,222,128,0.1)" : "rgba(245,158,11,0.1)")}; color: ${(p) => (p.$tone === "ready" ? "#4ade80" : "#f59e0b")};`;
const PreviewBar = styled.div<{ $on: boolean }>`display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.65rem 0.85rem; border-radius: 0.55rem; border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.4)` : "rgba(245,158,11,0.5)")}; background: ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.06)` : "rgba(245,158,11,0.08)")};`;
const PreviewTitle = styled.div`font-size: 0.82rem; font-weight: 700; color: var(--t-text); margin-bottom: 0.15rem;`;
const Toggle = styled.button<{ $on: boolean }>`display: flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.55rem; border-radius: 999px; cursor: pointer; border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.55)` : "rgba(245,158,11,0.55)")}; background: ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.12)` : "rgba(245,158,11,0.12)")};`;
const Knob = styled.span<{ $on: boolean }>`width: 0.6rem; height: 0.6rem; border-radius: 50%; background: ${(p) => (p.$on ? colors.cyan : "#f59e0b")}; box-shadow: 0 0 8px ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.6)` : "rgba(245,158,11,0.6)")};`;
const ToggleLabel = styled.span`font-size: 0.68rem; font-weight: 800; letter-spacing: 0.08em; color: var(--t-text);`;

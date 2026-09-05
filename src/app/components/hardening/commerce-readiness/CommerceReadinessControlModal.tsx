"use client";

// CommerceReadinessControlModal — the fleet store-readiness surface
// (checklist #8, the Office half of the #11 audit).
//
// Pattern: ~/.claude/CLAUDE.md §"Hardening UTILS Surfaces". One row per tenant
// site, its overall commerce badge (green/amber/red) + canTransact, expanding
// to the same seven per-check rows the member's own StoreReadinessCard shows —
// PLUS the staff-only rows a villager never sees (connect_webhook). Data comes
// from /api/admin/commerce-readiness → tgv.com's internal fleet read → the ONE
// computeStoreReadiness computer, so this view can never disagree with what a
// tenant's dashboard tells them.
//
// Sections:
//   1. Store fleet     — every site that IS a store, worst-first
//   2. Not stores yet  — sites with no account and no products (dim, no noise)
//   3. Fleet-wide levers — the two env switches the audit reads (state + flip
//      recipe; env vars are Gio-flipped, never a live toggle here)

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";

type ReadinessStatus = "blocked" | "warn" | "ok";
type ReadinessCheck = {
  key: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
  fixHref?: string | null;
  audience?: "owner" | "staff";
};
type StoreReadiness = {
  siteId: string;
  siteName: string;
  env: "live" | "test";
  canTransact: boolean;
  overall: ReadinessStatus;
  checks: ReadinessCheck[];
  checkedAt: string;
};
type FleetSite = {
  siteId: string;
  clientName: string | null;
  subdomain: string | null;
  domain: string | null;
  siteEnv: string;
  deployStatus: string | null;
  hasStore: boolean;
  readiness: StoreReadiness | null;
  error?: string;
};
type Levers = {
  storefrontTxEmails: { on: boolean; recipe: string };
  connectWebhook: { configured: boolean; recipe: string };
};

const RANK: Record<ReadinessStatus, number> = { blocked: 0, warn: 1, ok: 2 };

const statusColor = (s: ReadinessStatus) =>
  s === "ok" ? colors.green : s === "warn" ? colors.gold : colors.red;
const statusLabel = (s: ReadinessStatus) =>
  s === "ok" ? "ready" : s === "warn" ? "needs attention" : "blocked";

function SiteRow({ site }: { site: FleetSite }) {
  const [open, setOpen] = useState(false);
  const r = site.readiness;
  const name = site.clientName || site.subdomain || site.siteId.slice(0, 8);
  return (
    <RowWrap>
      <RowHead type="button" onClick={() => setOpen((o) => !o)}>
        <Caret>{open ? "▾" : "▸"}</Caret>
        <RowName>
          {name}
          <RowMeta>
            {site.domain ?? "—"} · {site.siteEnv}
            {site.deployStatus && site.deployStatus !== "live" ? ` · ${site.deployStatus}` : ""}
          </RowMeta>
        </RowName>
        {r ? (
          <>
            {r.canTransact && <TransactTag>can transact</TransactTag>}
            <StatusPill $c={statusColor(r.overall)}>{statusLabel(r.overall)}</StatusPill>
          </>
        ) : (
          <StatusPill $c={colors.red}>audit failed</StatusPill>
        )}
      </RowHead>
      {open && (
        <CheckList>
          {r ? (
            r.checks.map((c) => (
              <CheckRow key={c.key}>
                <Dot $c={statusColor(c.status)} />
                <CheckBody>
                  <CheckLabel>
                    {c.label}
                    {c.audience === "staff" && <StaffTag>staff-only</StaffTag>}
                  </CheckLabel>
                  <CheckDetail>{c.detail}</CheckDetail>
                </CheckBody>
              </CheckRow>
            ))
          ) : (
            <CheckDetail>The audit itself failed for this site: {site.error ?? "unknown"}.</CheckDetail>
          )}
        </CheckList>
      )}
    </RowWrap>
  );
}

export default function CommerceReadinessControlModal({ onClose }: { onClose: () => void }) {
  const [sites, setSites] = useState<FleetSite[] | null>(null);
  const [levers, setLevers] = useState<Levers | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/commerce-readiness", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setSites(Array.isArray(d.sites) ? d.sites : []);
        setLevers(d.levers ?? null);
      } else {
        setErr(d.error ?? `HTTP ${res.status}`);
      }
    } catch {
      setErr("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Stores worst-first (a blocked store outranks a green one for an operator's
  // attention); non-stores alphabetical in their own quiet pile.
  const stores = (sites ?? [])
    .filter((s) => s.hasStore || s.error)
    .sort((a, b) =>
      (RANK[a.readiness?.overall ?? "blocked"] - RANK[b.readiness?.overall ?? "blocked"]) ||
      (a.clientName ?? a.subdomain ?? "").localeCompare(b.clientName ?? b.subdomain ?? ""),
    );
  const notStores = (sites ?? []).filter((s) => !s.hasStore && !s.error);

  const sections: HCMSection[] = [
    {
      id: "fleet",
      title: "Store fleet",
      qmbm:
        "One row per tenant site that IS a store (a Stripe account connected, or a product " +
        "published). The badge is the worst status across every readiness check — the same " +
        "computeStoreReadiness computer the member's own dashboard card runs, so this view " +
        "can never disagree with what a tenant sees. Expand a row for the per-check detail; " +
        "rows tagged staff-only (like the Stripe Connect webhook) are platform plumbing that " +
        "never reaches a villager's checklist or their badge.\n\n" +
        "'can transact' is the hard gate: an account resolves, Stripe onboarding is finished, " +
        "and at least one product is published — everything else is a notification plane. This " +
        "surface exists because a store once took money while its owner heard nothing " +
        "(the original Guardian Stuffies gap); silent half-wiring is what it makes impossible.",
      body: (
        <div>
          <TopRow>
            <RefreshBtn type="button" onClick={() => void refresh()} disabled={loading}>
              {loading ? "Auditing…" : "↻ Re-run the audit"}
            </RefreshBtn>
            {err && <ErrText>{err}</ErrText>}
          </TopRow>
          {sites === null && !err ? (
            <Dim>Auditing the fleet…</Dim>
          ) : stores.length === 0 ? (
            <Dim>No tenant site has a store yet.</Dim>
          ) : (
            stores.map((s) => <SiteRow key={s.siteId} site={s} />)
          )}
        </div>
      ),
    },
    {
      id: "not-stores",
      title: `Not stores yet (${notStores.length})`,
      qmbm:
        "Sites with no connected payment account and no published products — tenants that " +
        "simply don't sell anything (yet). Kept out of the fleet list so a village site " +
        "without commerce doesn't read as a wall of red.",
      body:
        notStores.length === 0 ? (
          <Dim>Every site is a store.</Dim>
        ) : (
          <div>
            {notStores.map((s) => (
              <QuietRow key={s.siteId}>
                {s.clientName || s.subdomain || s.siteId.slice(0, 8)}
                <RowMeta>
                  {s.domain ?? "—"} · {s.siteEnv}
                </RowMeta>
              </QuietRow>
            ))}
          </div>
        ),
    },
    {
      id: "levers",
      title: "Fleet-wide levers",
      qmbm:
        "The two deploy-global switches the audit reads. Both are env vars on tgv.com's RCS " +
        "process — this panel shows their live state and the flip recipe, but the flip itself " +
        "is deliberate ops work (edit .env.local + pm2 restart), never a click here. While the " +
        "email master switch is OFF, every store's two email checks collapse into one amber " +
        "note fleet-wide.",
      body: levers ? (
        <div>
          <LeverRow>
            <Dot $c={levers.storefrontTxEmails.on ? colors.green : colors.gold} />
            <CheckBody>
              <CheckLabel>Storefront transactional emails (STOREFRONT_TX_EMAILS)</CheckLabel>
              <CheckDetail>
                {levers.storefrontTxEmails.on
                  ? "ON — owner + buyer emails send per-template."
                  : "OFF — paused fleet-wide; owners still see every sale in-app."}
              </CheckDetail>
              <Recipe>Flip: {levers.storefrontTxEmails.recipe}</Recipe>
            </CheckBody>
          </LeverRow>
          <LeverRow>
            <Dot $c={levers.connectWebhook.configured ? colors.green : colors.gold} />
            <CheckBody>
              <CheckLabel>Stripe Connect webhook (STRIPE_STOREFRONT_WEBHOOK_SECRET)</CheckLabel>
              <CheckDetail>
                {levers.connectWebhook.configured
                  ? "Configured — async payments fulfill on their own."
                  : "Not configured — card orders still complete on the return trip; delayed bank payments may wait for the buyer to come back."}
              </CheckDetail>
              <Recipe>Flip: {levers.connectWebhook.recipe}</Recipe>
            </CheckBody>
          </LeverRow>
        </div>
      ) : (
        <Dim>{err ? "Lever state unavailable." : "Loading…"}</Dim>
      ),
    },
  ];

  return (
    <HardeningControlModal
      title="Commerce Readiness"
      subtitle="Every tenant store's green/amber/red audit — the fleet view of the same checklist each owner sees on their dashboard."
      qmbm={
        "What is this?\n\n" +
        "Every working storefront needs three planes: money (Stripe account + charges " +
        "enabled), fulfilment (something published to buy), and notification (owner + buyer " +
        "hear about the sale). A store can be live and taking money while a plane is quietly " +
        "unwired — that actually happened (a sale landed; the owner heard nothing).\n\n" +
        "This surface runs the per-store readiness audit across the WHOLE fleet at once. " +
        "It is a pure read of our own registry tables (no Stripe calls), computed by the same " +
        "code that renders each member's own Store readiness card — one computer, two views. " +
        "Fix links live on the member's side; the operator's move here is usually to tell the " +
        "tenant what's amber, or to flip one of the fleet-wide levers below."
      }
      onClose={onClose}
      sections={sections}
    />
  );
}

/* ── styled ── */

const TopRow = styled.div`
  display: flex; align-items: center; gap: 0.6rem;
  margin-bottom: 0.6rem;
`;
const RefreshBtn = styled.button`
  padding: 0.3rem 0.7rem;
  font-size: 0.72rem; font-weight: 700;
  border-radius: 999px;
  cursor: pointer;
  background: transparent;
  color: ${colors.cyan};
  border: 1px solid rgba(${rgb.cyan}, 0.45);
  &:hover:not(:disabled) { background: rgba(${rgb.cyan}, 0.1); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;
const ErrText = styled.span`
  font-size: 0.72rem; color: ${colors.red};
`;
const Dim = styled.div`
  font-size: 0.75rem; color: var(--t-textFaint);
`;
const RowWrap = styled.div`
  border: 1px solid var(--t-border);
  border-radius: 0.45rem;
  background: rgba(0, 0, 0, 0.2);
  margin-bottom: 0.4rem;
`;
const RowHead = styled.button`
  display: flex; align-items: center; gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.6rem;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--t-text);
`;
const Caret = styled.span`
  flex: 0 0 auto;
  font-size: 0.7rem;
  color: var(--t-textFaint);
`;
const RowName = styled.div`
  flex: 1 1 auto; min-width: 0;
  font-size: 0.82rem; font-weight: 600;
`;
const RowMeta = styled.div`
  font-size: 0.68rem; font-weight: 400;
  color: var(--t-textFaint);
`;
const StatusPill = styled.span<{ $c: string }>`
  flex: 0 0 auto;
  padding: 0.15rem 0.55rem;
  font-size: 0.68rem; font-weight: 700;
  border-radius: 999px;
  color: ${(p) => p.$c};
  border: 1px solid ${(p) => p.$c};
  background: transparent;
`;
const TransactTag = styled.span`
  flex: 0 0 auto;
  font-size: 0.64rem; font-weight: 700;
  letter-spacing: 0.04em;
  color: ${colors.green};
`;
const CheckList = styled.div`
  display: flex; flex-direction: column; gap: 0.45rem;
  padding: 0.2rem 0.6rem 0.6rem 1.6rem;
`;
const CheckRow = styled.div`
  display: flex; align-items: flex-start; gap: 0.5rem;
`;
const LeverRow = styled.div`
  display: flex; align-items: flex-start; gap: 0.5rem;
  padding: 0.45rem 0.2rem;
`;
const Dot = styled.span<{ $c: string }>`
  flex: 0 0 auto;
  width: 0.55rem; height: 0.55rem;
  margin-top: 0.28rem;
  border-radius: 50%;
  background: ${(p) => p.$c};
  box-shadow: 0 0 6px ${(p) => p.$c};
`;
const CheckBody = styled.div`
  flex: 1 1 auto; min-width: 0;
`;
const CheckLabel = styled.div`
  font-size: 0.76rem; font-weight: 600; color: var(--t-text);
`;
const StaffTag = styled.span`
  margin-left: 0.4rem;
  font-size: 0.6rem; font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${colors.gold};
`;
const CheckDetail = styled.div`
  font-size: 0.7rem; line-height: 1.45; color: var(--t-textFaint);
`;
const Recipe = styled.div`
  margin-top: 0.2rem;
  font-size: 0.66rem; line-height: 1.4;
  font-family: ui-monospace, monospace;
  color: var(--t-textFaint);
  opacity: 0.85;
`;
const QuietRow = styled.div`
  display: flex; align-items: baseline; gap: 0.5rem;
  padding: 0.3rem 0.2rem;
  font-size: 0.78rem;
  color: var(--t-textFaint);
`;

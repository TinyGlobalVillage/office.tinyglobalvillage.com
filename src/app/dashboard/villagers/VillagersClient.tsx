"use client";

// VillagersClient — the operator surface for managing TGV members ("villagers"): their wallets,
// payouts, and entitlements. Rendered by villagers/page.tsx, which admin-gates it server-side
// (this client never loads for a non-admin). Tiles open modal consoles; every action they drive
// is audited and additionally guarded by requireAdmin on its API route.
//
// Tiles are grouped into logical, alphabetically-sorted sections (the default layout below). An
// operator can flip "Edit layout" to drag tiles between/within groups and rename the group titles;
// the arrangement persists to this browser (localStorage LAYOUT_KEY). New tiles added in code
// appear automatically (normalizeLayout appends any registry tile not present in the saved layout).

import { useState, useEffect, useRef, type ReactNode } from "react";
import styled, { css } from "styled-components";
import { colors, rgb } from "../../theme";
import TopNav from "../../components/TopNav";
import {
  MembersIcon,
  WalletIcon,
  SearchIcon,
  SettingsIcon,
  CashIcon,
  ShieldIcon,
  BankIcon,
  GraduationIcon,
  LotusIcon,
  StarIcon,
  GlobeIcon,
  ChartIcon,
  PaypalIcon,
} from "../../components/icons";
import MemberWalletModal from "../../components/villagers/MemberWalletModal";
import PayoutsModal from "../../components/villagers/PayoutsModal";
import WalletControlModal from "../../components/hardening/wallet-control/WalletControlModal";
import ManagedOnboardingModal from "../../components/villagers/ManagedOnboardingModal";
import CourseControlModal from "../../components/villagers/CourseControlModal";
import StudioControlModal from "../../components/villagers/StudioControlModal";
import PerformersControlModal from "../../components/villagers/PerformersControlModal";
import DnsModal from "../../components/villagers/DnsModal";
import EcosystemAnalyticsModal from "../../components/villagers/EcosystemAnalyticsModal";
import PaypalControlModal from "../../components/villagers/PaypalControlModal";
import MoneyStoresModal from "../../components/villagers/MoneyStoresModal";
import MemberLookupModal from "../../components/villagers/MemberLookupModal";
import DashboardConfigModal from "../../components/villagers/DashboardConfigModal";
import RequestTenantAccessModal from "../../components/villagers/RequestTenantAccessModal";
import KeycloakWireModal from "../../components/villagers/KeycloakWireModal";
import GuestClaimsModal from "../../components/villagers/GuestClaimsModal";
import StudioConfigModal from "../../components/villagers/StudioConfigModal";
import OnboardVillagerModal from "../../components/villagers/OnboardVillagerModal";
import OnboardConfigModal from "../../components/villagers/OnboardConfigModal";

/* ── Layout model ──────────────────────────────────────────────── */

type TileGearDef = { onClick: () => void; title: string };
type TileDef = {
  id: string;
  title: string;
  icon: ReactNode;
  sub: ReactNode;
  onClick: () => void;
  gear?: TileGearDef;
};
type SectionLayout = { id: string; title: string; tileIds: string[] };

const LAYOUT_KEY = "tgv-villagers-layout-v1";

// Default grouping: logical categories, tiles alphabetically sorted within each.
const DEFAULT_LAYOUT: SectionLayout[] = [
  {
    id: "members",
    title: "Members & Onboarding",
    tileIds: ["guestClaims", "memberLookup", "onboardVillager"],
  },
  {
    id: "money",
    title: "Money & Wallets",
    tileIds: [
      "memberWallet",
      "moneyStores",
      "payouts",
      "paypalFaucet",
      "stripeOnboarding",
      "walletCashOut",
    ],
  },
  {
    id: "suites",
    title: "Product Suites",
    tileIds: ["courseSuite", "performersSuite", "studioSuite"],
  },
  {
    id: "access",
    title: "Access & Identity",
    tileIds: ["requestAccess", "keycloakWire"],
  },
  {
    id: "sites",
    title: "Sites & Content",
    tileIds: ["demoTgv", "dns", "pageEditor"],
  },
  {
    id: "platform",
    title: "Platform & Analytics",
    tileIds: ["dashboardConfig", "ecosystemAnalytics"],
  },
];

// Reconcile a saved layout with the live tile registry: drop unknown / duplicate ids, and append
// any registry tile that isn't placed yet (to its default section if that section still exists,
// else the last section). Guarantees every tile shows exactly once.
function normalizeLayout(
  source: SectionLayout[],
  knownIds: string[],
): SectionLayout[] {
  const known = new Set(knownIds);
  const placed = new Set<string>();
  const sections: SectionLayout[] = source.map((s, i) => {
    const tileIds = (Array.isArray(s.tileIds) ? s.tileIds : []).filter(
      (id) => known.has(id) && !placed.has(id),
    );
    tileIds.forEach((id) => placed.add(id));
    return {
      id: typeof s.id === "string" && s.id ? s.id : `sec-${i}`,
      title: typeof s.title === "string" ? s.title : "",
      tileIds,
    };
  });

  const missing = knownIds.filter((id) => !placed.has(id));
  for (const id of missing) {
    const def = DEFAULT_LAYOUT.find((s) => s.tileIds.includes(id));
    let target = def ? sections.find((s) => s.id === def.id) : undefined;
    if (!target) target = sections[sections.length - 1];
    if (!target) {
      target = { id: "more", title: "More", tileIds: [] };
      sections.push(target);
    }
    target.tileIds.push(id);
  }
  return sections;
}

// Move a tile to before `beforeTileId` in `targetSectionId` (or to the end when null).
function moveTile(
  layout: SectionLayout[],
  tileId: string,
  targetSectionId: string,
  beforeTileId: string | null,
): SectionLayout[] {
  const next = layout.map((s) => ({
    ...s,
    tileIds: s.tileIds.filter((id) => id !== tileId),
  }));
  const target = next.find((s) => s.id === targetSectionId);
  if (!target) return layout;
  if (!beforeTileId) {
    target.tileIds.push(tileId);
  } else {
    const idx = target.tileIds.indexOf(beforeTileId);
    if (idx < 0) target.tileIds.push(tileId);
    else target.tileIds.splice(idx, 0, tileId);
  }
  return next;
}

/* ── Styled ────────────────────────────────────────────────────── */

const PageMain = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 0 0.25rem 4rem;
  max-width: 80rem;
  margin: 0 auto;
  width: 100%;

  @media (min-width: 768px) {
    padding: 0 1rem 4rem;
  }
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1.25rem 0 1rem;
`;

const TitleWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
`;

const PageTitle = styled.h1`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: ${colors.gold};
  text-shadow: 0 0 10px rgba(${rgb.gold}, 0.4);

  [data-theme="light"] & {
    text-shadow: none;
  }
`;

const PageSubtitle = styled.p`
  margin: 0;
  font-size: 0.8125rem;
  color: var(--t-textFaint);
  line-height: 1.45;
`;

const EditControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
`;

const EditBtn = styled.button<{ $active?: boolean }>`
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 0.4rem 0.75rem;
  border-radius: 0.5rem;
  cursor: pointer;
  color: ${colors.gold};
  border: 1px solid rgba(${rgb.gold}, 0.45);
  background: ${(p) =>
    p.$active ? `rgba(${rgb.gold}, 0.16)` : `rgba(${rgb.gold}, 0.04)`};
  transition: all 0.15s;

  &:hover {
    border-color: rgba(${rgb.gold}, 0.7);
    box-shadow: 0 0 10px rgba(${rgb.gold}, 0.2);
  }
`;

const GhostBtn = styled.button`
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.4rem 0.7rem;
  border-radius: 0.5rem;
  cursor: pointer;
  color: var(--t-textFaint);
  border: 1px solid var(--t-border, rgba(255, 255, 255, 0.15));
  background: transparent;
  transition: all 0.15s;

  &:hover {
    color: var(--t-text);
    border-color: rgba(${rgb.gold}, 0.4);
  }
`;

const EditHint = styled.p`
  margin: 0 0 1.25rem;
  font-size: 0.75rem;
  color: ${colors.gold};
  opacity: 0.85;
  line-height: 1.45;
`;

const Grid = styled.div<{ $edit?: boolean }>`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.75rem;
  ${(p) =>
    p.$edit &&
    css`
      min-height: 4rem;
      border: 1px dashed rgba(${rgb.gold}, 0.18);
      border-radius: 0.75rem;
      padding: 0.5rem;
    `}
`;

const Section = styled.section`
  margin-bottom: 1.75rem;
`;

const SectionTitle = styled.h2`
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${colors.gold};
  opacity: 0.85;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: linear-gradient(
      to right,
      rgba(${rgb.gold}, 0.3),
      rgba(${rgb.gold}, 0)
    );
  }
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.75rem;

  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: linear-gradient(
      to right,
      rgba(${rgb.gold}, 0.3),
      rgba(${rgb.gold}, 0)
    );
  }
`;

const TitleInput = styled.input`
  background: rgba(${rgb.gold}, 0.06);
  border: 1px dashed rgba(${rgb.gold}, 0.4);
  border-radius: 0.375rem;
  color: ${colors.gold};
  font-size: 0.8125rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 0.3rem 0.55rem;
  min-width: 14rem;
  max-width: 26rem;

  &:focus {
    outline: none;
    border-color: rgba(${rgb.gold}, 0.75);
    box-shadow: 0 0 8px rgba(${rgb.gold}, 0.2);
  }
`;

const Tile = styled.button<{ $edit?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 1rem;
  text-align: left;
  cursor: pointer;
  background: rgba(${rgb.gold}, 0.04);
  border: 1px solid rgba(${rgb.gold}, 0.3);
  border-radius: 0.625rem;
  color: var(--t-text);
  transition: all 0.15s;

  &:hover {
    background: rgba(${rgb.gold}, 0.1);
    border-color: rgba(${rgb.gold}, 0.55);
    box-shadow: 0 0 18px rgba(${rgb.gold}, 0.15);
  }

  ${(p) =>
    p.$edit &&
    css`
      /* In edit mode the cell owns the pointer (for drag); the button is inert. */
      pointer-events: none;
      cursor: grab;
    `}
`;

const TileTop = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: ${colors.gold};
  letter-spacing: 0.04em;
`;

const TileSub = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  line-height: 1.45;
`;

const TileCell = styled.div<{ $edit?: boolean; $dragging?: boolean }>`
  position: relative;
  display: grid;

  ${(p) =>
    p.$edit &&
    css`
      cursor: grab;
      border-radius: 0.7rem;
      outline: 1px dashed rgba(${rgb.gold}, 0.4);
      outline-offset: 3px;

      &:active {
        cursor: grabbing;
      }
    `}

  ${(p) =>
    p.$dragging &&
    css`
      opacity: 0.4;
    `}
`;

const TileGear = styled.button`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 1;
  background: rgba(${rgb.gold}, 0.08);
  border: 1px solid rgba(${rgb.gold}, 0.35);
  color: ${colors.gold};
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.375rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;

  &:hover {
    border-color: rgba(${rgb.gold}, 0.7);
    box-shadow: 0 0 8px rgba(${rgb.gold}, 0.25);
  }
`;

/* ── Page ──────────────────────────────────────────────────────── */

export default function VillagersClient() {
  const openDemoTgvOperator = async () => {
    try {
      const r = await fetch('/api/demo-tgv/operator-link', { method: 'POST' });
      const d = await r.json();
      if (d?.url) window.open(d.url, '_blank', 'noopener');
      else alert('Could not open DemoTGV — operator link not configured.');
    } catch {
      alert('Could not open DemoTGV.');
    }
  };

  const [openMemberWallet, setOpenMemberWallet] = useState(false);
  const [openMemberLookup, setOpenMemberLookup] = useState(false);
  const [openDashboardConfig, setOpenDashboardConfig] = useState(false);
  const [openAccessGrant, setOpenAccessGrant] = useState(false);
  const [openPayouts, setOpenPayouts] = useState(false);
  const [openWalletControl, setOpenWalletControl] = useState(false);
  const [openManaged, setOpenManaged] = useState(false);
  const [openCourse, setOpenCourse] = useState(false);
  const [openStudio, setOpenStudio] = useState(false);
  const [openPerformers, setOpenPerformers] = useState(false);
  const [openDns, setOpenDns] = useState(false);
  const [openEcosystem, setOpenEcosystem] = useState(false);
  const [openPaypal, setOpenPaypal] = useState(false);
  const [openMoney, setOpenMoney] = useState(false);
  const [openKeycloakWire, setOpenKeycloakWire] = useState(false);
  const [openGuestClaims, setOpenGuestClaims] = useState(false);
  const [openOnboardVillager, setOpenOnboardVillager] = useState(false);
  const [openOnboardConfig, setOpenOnboardConfig] = useState(false);
  // Open the TGV Template Studio in a NEW TAB (not an iframe). The tgv.com
  // editor is admin-gated by Keycloak, which refuses cross-origin framing
  // (the iframe died with "connection closed") and its session cookie is not
  // sent in a third-party frame anyway. A same-origin tab authenticates
  // normally; the studio's "Close" button self-closes it. Slug/lang/base live
  // behind the tile gear (StudioConfigModal), persisted to localStorage.
  const launchTemplateStudio = () => {
    const fallbackBase =
      process.env.NEXT_PUBLIC_TGV_URL ?? "https://tinyglobalvillage.com";
    let cfg = { slug: "home", lang: "en", base: fallbackBase };
    try {
      const raw = localStorage.getItem("tgv-studio-cfg");
      if (raw) {
        const c = JSON.parse(raw);
        cfg = {
          slug: typeof c.slug === "string" && c.slug ? c.slug : cfg.slug,
          lang: typeof c.lang === "string" && c.lang ? c.lang : cfg.lang,
          base: typeof c.base === "string" && c.base ? c.base : cfg.base,
        };
      }
    } catch {
      /* ignore malformed cfg */
    }
    const url = `${cfg.base}/${encodeURIComponent(cfg.lang)}/editor/${encodeURIComponent(
      cfg.slug,
    )}?studio=1&popout=1`;
    // Deliberately NOT "noopener" so the studio tab stays script-closable and
    // its "Close" button can window.close() it.
    window.open(url, "_blank");
  };
  const [openStudioConfig, setOpenStudioConfig] = useState(false);

  // ── Tile registry (id → definition). Closures capture the setters above. ──
  const TILES: Record<string, TileDef> = {
    guestClaims: {
      id: "guestClaims",
      title: "Guest Claims",
      icon: <MembersIcon size={18} />,
      onClick: () => setOpenGuestClaims(true),
      sub: (
        <>
          Guests who bought without an account — send a one-time claim link that
          creates their passkey login and attaches their purchase history
          (guest→member, F20). Issuance is audit-logged.
        </>
      ),
    },
    memberLookup: {
      id: "memberLookup",
      title: "Member Lookup",
      icon: <SearchIcon size={18} />,
      onClick: () => setOpenMemberLookup(true),
      sub: (
        <>
          Search a member and open their profile — Member-since, role, their sites, and the
          Yellow Pages founding toggle. Set billing on their behalf (plan, renewal date,
          custom amount, waiver, notify-to-pay). Records intent only; no money moves.
        </>
      ),
    },
    onboardVillager: {
      id: "onboardVillager",
      title: "Onboard Villager",
      icon: <MembersIcon size={18} />,
      onClick: () => setOpenOnboardVillager(true),
      gear: { onClick: () => setOpenOnboardConfig(true), title: "Onboard config" },
      sub: (
        <>
          Create a member + their first site on their behalf — landing template or
          migrate their existing site, waive fees / record plan intent, send the
          passkey invite. Existing emails add a site, never a duplicate. Config
          (AI designer beta) behind the gear.
        </>
      ),
    },
    memberWallet: {
      id: "memberWallet",
      title: "Member Wallet",
      icon: <WalletIcon size={18} />,
      onClick: () => setOpenMemberWallet(true),
      sub: (
        <>
          Search a villager and manage their token wallet — view Cash / Available /
          Retainer (live + test) and release retainer to Available or Cash on their behalf.
        </>
      ),
    },
    moneyStores: {
      id: "moneyStores",
      title: "Money & Stores",
      icon: <CashIcon size={18} />,
      onClick: () => setOpenMoney(true),
      sub: (
        <>
          Per-site wallet &amp; Stripe config for a villager site — pool takings into one wallet or
          keep a separate pool, and use the site&apos;s own managed Stripe account or share another of
          the owner&apos;s. Moved off the villager dashboard; tgv.com re-validates every change.
        </>
      ),
    },
    payouts: {
      id: "payouts",
      title: "Payouts",
      icon: <CashIcon size={18} />,
      onClick: () => setOpenPayouts(true),
      sub: (
        <>
          Work the member cash-out queue — approve requests, watch each one&apos;s fraud-hold
          countdown, mark paid, or release a trusted member early. Cancel/fail during the hold
          returns their cash. Inert until withdrawals launch.
        </>
      ),
    },
    paypalFaucet: {
      id: "paypalFaucet",
      title: "PayPal Faucet",
      icon: <PaypalIcon size={18} />,
      onClick: () => setOpenPaypal(true),
      sub: (
        <>
          Tenant PayPal rail (the island) — enable / disable a tenant&apos;s PayPal, set its
          public credentials (client-id, hosted-button-id), and the global killswitch. Money goes
          straight to the tenant&apos;s own PayPal — off-stack, no tokens, no TGV float.
        </>
      ),
    },
    stripeOnboarding: {
      id: "stripeOnboarding",
      title: "Stripe Onboarding",
      icon: <BankIcon size={18} />,
      onClick: () => setOpenManaged(true),
      sub: (
        <>
          Set up a TGV-managed Stripe account for a tenant — obscured under TGV Connect — and
          watch the embedded onboarding through to charges-enabled. Flip Preview to run the whole
          pipeline in test mode with auto-filled details.
        </>
      ),
    },
    walletCashOut: {
      id: "walletCashOut",
      title: "Wallet Cash-Out",
      icon: <ShieldIcon size={18} />,
      onClick: () => setOpenWalletControl(true),
      sub: (
        <>
          Cash-out safety posture — the two-key launch gate + runtime killswitch, fraud limits,
          and the full activity timeline. Stays OFF until KYC + clawback ship.
        </>
      ),
    },
    courseSuite: {
      id: "courseSuite",
      title: "Course Suite",
      icon: <GraduationIcon size={18} />,
      onClick: () => setOpenCourse(true),
      sub: (
        <>
          Cross-tenant oversight for the course suite — real-learner usage, completions and
          pass-rates per tenant, suite health, and the enablement killswitch (global + per-tenant)
          at the bottom. The master console for @tgv/module-course.
        </>
      ),
    },
    performersSuite: {
      id: "performersSuite",
      title: "Performers Suite",
      icon: <StarIcon size={18} />,
      onClick: () => setOpenPerformers(true),
      sub: (
        <>
          Cross-tenant oversight for the performers suite — talent roster, upcoming gigs, the
          offering catalog, paid revenue, the abundance income pools, and the unpaid-payout /
          pending-purchase work-queues, with the enablement killswitch at the bottom. The master
          console for @tgv/module-performers.
        </>
      ),
    },
    studioSuite: {
      id: "studioSuite",
      title: "Studio Suite",
      icon: <LotusIcon size={18} />,
      onClick: () => setOpenStudio(true),
      sub: (
        <>
          Cross-tenant oversight for the studio suite (the reinvented MindBody) — bookings,
          classes and appointments, active passes and no-show rate per tenant, suite health, and
          the enablement killswitch (global + per-tenant) at the bottom. The master console for
          @tgv/module-studio.
        </>
      ),
    },
    requestAccess: {
      id: "requestAccess",
      title: "Request Tenant Access",
      icon: <ShieldIcon size={18} />,
      onClick: () => setOpenAccessGrant(true),
      sub: (
        <>
          Ask a tenant for consent-gated, time-boxed access to act on their account. They approve
          on their dashboard and pick exactly what to grant (money is the highest-trust scope);
          you enter the emailed code to activate. Never mutate an account without consent.
        </>
      ),
    },
    keycloakWire: {
      id: "keycloakWire",
      title: "Wire Client to Keycloak",
      icon: <ShieldIcon size={18} />,
      onClick: () => setOpenKeycloakWire(true),
      sub: (
        <>
          Provision a deployed tenant app as an OIDC relying-party on the fleet login —
          creates the realm client, registers slashed + unslashed redirect URIs, and
          file-drops the secret into the app&apos;s .env.local server-side. Cutover
          (AUTH_IDP flip) stays a separate, explicit step.
        </>
      ),
    },
    demoTgv: {
      id: "demoTgv",
      title: "Demo TGV",
      icon: <GlobeIcon size={18} />,
      onClick: openDemoTgvOperator,
      sub: (
        <>
          Open the real DemoTGV as an operator and curate it in the page editor — this is the
          MASTER that guest sessions clone. Save-draft / publish here flows to future guests.
          Opens demo.tinyglobalvillage.com in a new tab via a short-lived staff token.
        </>
      ),
    },
    dns: {
      id: "dns",
      title: "DNS",
      icon: <GlobeIcon size={18} />,
      onClick: () => setOpenDns(true),
      sub: (
        <>
          Operate DNS across every Cloudflare zone — TGV.com, Office, and each tenant&apos;s
          domains — grouped by owning villager. Pick a zone, then add / edit / delete records.
          Office holds no provider creds (it proxies the engine); every edit hits production DNS
          and is audited.
        </>
      ),
    },
    pageEditor: {
      id: "pageEditor",
      title: "Page Editor",
      icon: <GlobeIcon size={18} />,
      onClick: launchTemplateStudio,
      gear: { onClick: () => setOpenStudioConfig(true), title: "Studio settings" },
      sub: (
        <>
          Template Studio - experiment with Paint Mode and the Site Theme on the
          Village landing, then save reusable &quot;looks&quot; and page templates for
          clients. Config behind the gear.
        </>
      ),
    },
    dashboardConfig: {
      id: "dashboardConfig",
      title: "Dashboard Config",
      icon: <SettingsIcon size={18} />,
      onClick: () => setOpenDashboardConfig(true),
      sub: (
        <>
          The soft-launch board — turn each dashboard feature Off / Admin-preview / On for
          every member at once. Stage a feature for admins only, test it, then flick it
          public. Every change is audited.
        </>
      ),
    },
    ecosystemAnalytics: {
      id: "ecosystemAnalytics",
      title: "Ecosystem Analytics",
      icon: <ChartIcon size={18} />,
      onClick: () => setOpenEcosystem(true),
      sub: (
        <>
          Anonymized roll-up of the whole token + money economy — tokens in circulation per
          bucket, gift volume (member → member), referral rewards, service payments, cash paid
          out, and managed Stripe accounts. Aggregates only; no individual wallets.
        </>
      ),
    },
  };

  // ── Layout state (persisted per-browser) ──
  const [layout, setLayout] = useState<SectionLayout[]>(DEFAULT_LAYOUT);
  const [editMode, setEditMode] = useState(false);
  const [dragTile, setDragTile] = useState<string | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    let base: SectionLayout[] = DEFAULT_LAYOUT;
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) base = parsed;
    } catch {
      /* ignore malformed layout */
    }
    setLayout(normalizeLayout(base, Object.keys(TILES)));
    hydrated.current = true;
    // Registry ids are static; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    } catch {
      /* storage full / unavailable — layout stays in memory */
    }
  }, [layout]);

  const handleDrop = (sectionId: string, beforeTileId: string | null) => {
    if (!dragTile) return;
    if (beforeTileId && beforeTileId === dragTile) return;
    setLayout((l) => moveTile(l, dragTile, sectionId, beforeTileId));
  };

  const renameSection = (sectionId: string, title: string) =>
    setLayout((l) => l.map((s) => (s.id === sectionId ? { ...s, title } : s)));

  const resetLayout = () => {
    try {
      localStorage.removeItem(LAYOUT_KEY);
    } catch {
      /* ignore */
    }
    setLayout(normalizeLayout(DEFAULT_LAYOUT, Object.keys(TILES)));
  };

  const renderTile = (tile: TileDef, sectionId: string) => (
    <TileCell
      key={tile.id}
      $edit={editMode}
      $dragging={dragTile === tile.id}
      draggable={editMode}
      onDragStart={
        editMode
          ? (e) => {
              setDragTile(tile.id);
              e.dataTransfer.effectAllowed = "move";
              // Firefox refuses to start a drag unless data is set here.
              e.dataTransfer.setData("text/plain", tile.id);
            }
          : undefined
      }
      onDragEnd={editMode ? () => setDragTile(null) : undefined}
      onDragOver={
        editMode
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }
          : undefined
      }
      onDrop={
        editMode
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDrop(sectionId, tile.id);
            }
          : undefined
      }
    >
      <Tile
        type="button"
        onClick={editMode ? undefined : tile.onClick}
        $edit={editMode}
      >
        <TileTop>
          {tile.icon} {tile.title}
        </TileTop>
        <TileSub>{tile.sub}</TileSub>
      </Tile>
      {tile.gear && (
        <TileGear
          type="button"
          onClick={editMode ? undefined : tile.gear.onClick}
          title={tile.gear.title}
          aria-label={tile.gear.title}
          disabled={editMode}
          style={editMode ? { pointerEvents: "none" } : undefined}
        >
          <SettingsIcon size={14} />
        </TileGear>
      )}
    </TileCell>
  );

  const visibleSections = layout.filter(
    (s) => editMode || s.tileIds.length > 0,
  );

  return (
    <>
      <TopNav />
      <PageMain>
        <HeaderRow>
          <TitleWrap>
            <MembersIcon size={26} style={{ color: colors.gold }} />
            <PageTitle>Villagers</PageTitle>
          </TitleWrap>
          <EditControls>
            {editMode && (
              <GhostBtn type="button" onClick={resetLayout}>
                Reset
              </GhostBtn>
            )}
            <EditBtn
              type="button"
              onClick={() => setEditMode((e) => !e)}
              $active={editMode}
            >
              {editMode ? "Done" : "Edit layout"}
            </EditBtn>
          </EditControls>
        </HeaderRow>
        <PageSubtitle style={{ marginBottom: editMode ? "0.5rem" : "1.25rem" }}>
          Manage members on behalf of the TGV tenant — wallets, payouts, and
          entitlements. Every action here is audited.
        </PageSubtitle>
        {editMode && (
          <EditHint>
            Drag tiles to rearrange them or move them between groups; edit a
            group name to relabel it. Your layout saves to this browser — hit
            Reset to restore the default grouping.
          </EditHint>
        )}

        {visibleSections.map((section) => (
          <Section key={section.id}>
            {editMode ? (
              <TitleRow>
                <TitleInput
                  value={section.title}
                  onChange={(e) => renameSection(section.id, e.target.value)}
                  placeholder="Group name"
                  aria-label={`Rename group ${section.title}`}
                />
              </TitleRow>
            ) : (
              <SectionTitle>{section.title}</SectionTitle>
            )}
            <Grid
              $edit={editMode}
              onDragOver={
                editMode
                  ? (e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }
                  : undefined
              }
              onDrop={
                editMode
                  ? (e) => {
                      e.preventDefault();
                      handleDrop(section.id, null);
                    }
                  : undefined
              }
            >
              {section.tileIds.map((id) => {
                const tile = TILES[id];
                return tile ? renderTile(tile, section.id) : null;
              })}
            </Grid>
          </Section>
        ))}
      </PageMain>

      {openMemberWallet && (
        <MemberWalletModal onClose={() => setOpenMemberWallet(false)} />
      )}

      {openMemberLookup && (
        <MemberLookupModal onClose={() => setOpenMemberLookup(false)} />
      )}

      {openDashboardConfig && (
        <DashboardConfigModal onClose={() => setOpenDashboardConfig(false)} />
      )}

      {openAccessGrant && <RequestTenantAccessModal onClose={() => setOpenAccessGrant(false)} />}

      {openPayouts && <PayoutsModal onClose={() => setOpenPayouts(false)} />}

      {openWalletControl && (
        <WalletControlModal onClose={() => setOpenWalletControl(false)} />
      )}

      {openManaged && <ManagedOnboardingModal onClose={() => setOpenManaged(false)} />}
      {openOnboardVillager && <OnboardVillagerModal onClose={() => setOpenOnboardVillager(false)} />}
      {openOnboardConfig && <OnboardConfigModal onClose={() => setOpenOnboardConfig(false)} />}

      {openCourse && <CourseControlModal onClose={() => setOpenCourse(false)} />}

      {openStudio && <StudioControlModal onClose={() => setOpenStudio(false)} />}

      {openPerformers && <PerformersControlModal onClose={() => setOpenPerformers(false)} />}

      {openDns && <DnsModal onClose={() => setOpenDns(false)} />}

      {openEcosystem && <EcosystemAnalyticsModal onClose={() => setOpenEcosystem(false)} />}

      {openPaypal && <PaypalControlModal onClose={() => setOpenPaypal(false)} />}

      {openMoney && <MoneyStoresModal onClose={() => setOpenMoney(false)} />}

      {openKeycloakWire && <KeycloakWireModal onClose={() => setOpenKeycloakWire(false)} />}

      {openGuestClaims && <GuestClaimsModal onClose={() => setOpenGuestClaims(false)} />}

      {openStudioConfig && (
        <StudioConfigModal onClose={() => setOpenStudioConfig(false)} />
      )}
    </>
  );
}

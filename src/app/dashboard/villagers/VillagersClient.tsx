"use client";

// VillagersClient — the operator surface for managing TGV members ("villagers"): their wallets,
// payouts, and entitlements. Rendered by villagers/page.tsx, which admin-gates it server-side
// (this client never loads for a non-admin). Tiles open modal consoles; every action they drive
// is audited and additionally guarded by requireAdmin on its API route.

import { useState } from "react";
import styled from "styled-components";
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
import MemberLookupModal from "../../components/villagers/MemberLookupModal";
import DashboardConfigModal from "../../components/villagers/DashboardConfigModal";
import RequestTenantAccessModal from "../../components/villagers/RequestTenantAccessModal";

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

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.75rem;
`;

const Tile = styled.button`
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

/* ── Page ──────────────────────────────────────────────────────── */

export default function VillagersClient() {
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

  return (
    <>
      <TopNav />
      <PageMain>
        <HeaderRow>
          <TitleWrap>
            <MembersIcon size={26} style={{ color: colors.gold }} />
            <PageTitle>Villagers</PageTitle>
          </TitleWrap>
        </HeaderRow>
        <PageSubtitle style={{ marginBottom: "1.25rem" }}>
          Manage members on behalf of the TGV tenant — wallets, payouts, and
          entitlements. Every action here is audited.
        </PageSubtitle>

        <Grid>
          <Tile type="button" onClick={() => setOpenMemberWallet(true)}>
            <TileTop><WalletIcon size={18} /> Member Wallet</TileTop>
            <TileSub>
              Search a villager and manage their token wallet — view Cash / Available /
              Retainer (live + test) and release retainer to Available or Cash on their behalf.
            </TileSub>
          </Tile>

          <Tile type="button" onClick={() => setOpenMemberLookup(true)}>
            <TileTop><SearchIcon size={18} /> Member Lookup</TileTop>
            <TileSub>
              Search a member and open their profile — Member-since, role, their sites, and the
              Yellow Pages founding toggle. Set billing on their behalf (plan, renewal date,
              custom amount, waiver, notify-to-pay). Records intent only; no money moves.
            </TileSub>
          </Tile>

          <Tile type="button" onClick={() => setOpenDashboardConfig(true)}>
            <TileTop><SettingsIcon size={18} /> Dashboard Config</TileTop>
            <TileSub>
              The soft-launch board — turn each dashboard feature Off / Admin-preview / On for
              every member at once. Stage a feature for admins only, test it, then flick it
              public. Every change is audited.
            </TileSub>
          </Tile>

          <Tile type="button" onClick={() => setOpenAccessGrant(true)}>
            <TileTop><ShieldIcon size={18} /> Request Tenant Access</TileTop>
            <TileSub>
              Ask a tenant for consent-gated, time-boxed access to act on their account. They approve
              on their dashboard and pick exactly what to grant (money is the highest-trust scope);
              you enter the emailed code to activate. Never mutate an account without consent.
            </TileSub>
          </Tile>

          <Tile type="button" onClick={() => setOpenPayouts(true)}>
            <TileTop><CashIcon size={18} /> Payouts</TileTop>
            <TileSub>
              Work the member cash-out queue — approve requests, watch each one&apos;s fraud-hold
              countdown, mark paid, or release a trusted member early. Cancel/fail during the hold
              returns their cash. Inert until withdrawals launch.
            </TileSub>
          </Tile>

          <Tile type="button" onClick={() => setOpenWalletControl(true)}>
            <TileTop><ShieldIcon size={18} /> Wallet Cash-Out</TileTop>
            <TileSub>
              Cash-out safety posture — the two-key launch gate + runtime killswitch, fraud limits,
              and the full activity timeline. Stays OFF until KYC + clawback ship.
            </TileSub>
          </Tile>

          <Tile type="button" onClick={() => setOpenManaged(true)}>
            <TileTop><BankIcon size={18} /> Stripe Onboarding</TileTop>
            <TileSub>
              Set up a TGV-managed Stripe account for a tenant — obscured under TGV Connect — and
              watch the embedded onboarding through to charges-enabled. Flip Preview to run the whole
              pipeline in test mode with auto-filled details.
            </TileSub>
          </Tile>

          <Tile type="button" onClick={() => setOpenCourse(true)}>
            <TileTop><GraduationIcon size={18} /> Course Suite</TileTop>
            <TileSub>
              Cross-tenant oversight for the course suite — real-learner usage, completions and
              pass-rates per tenant, suite health, and the enablement killswitch (global + per-tenant)
              at the bottom. The master console for @tgv/module-course.
            </TileSub>
          </Tile>

          <Tile type="button" onClick={() => setOpenStudio(true)}>
            <TileTop><LotusIcon size={18} /> Studio Suite</TileTop>
            <TileSub>
              Cross-tenant oversight for the studio suite (the reinvented MindBody) — bookings,
              classes and appointments, active passes and no-show rate per tenant, suite health, and
              the enablement killswitch (global + per-tenant) at the bottom. The master console for
              @tgv/module-studio.
            </TileSub>
          </Tile>

          <Tile type="button" onClick={() => setOpenPerformers(true)}>
            <TileTop><StarIcon size={18} /> Performers Suite</TileTop>
            <TileSub>
              Cross-tenant oversight for the performers suite — talent roster, upcoming gigs, the
              offering catalog, paid revenue, the abundance income pools, and the unpaid-payout /
              pending-purchase work-queues, with the enablement killswitch at the bottom. The master
              console for @tgv/module-performers.
            </TileSub>
          </Tile>

          <Tile type="button" onClick={() => setOpenDns(true)}>
            <TileTop><GlobeIcon size={18} /> DNS</TileTop>
            <TileSub>
              Operate DNS across every Cloudflare zone — TGV.com, Office, and each tenant&apos;s
              domains — grouped by owning villager. Pick a zone, then add / edit / delete records.
              Office holds no provider creds (it proxies the engine); every edit hits production DNS
              and is audited.
            </TileSub>
          </Tile>

          <Tile type="button" onClick={() => setOpenEcosystem(true)}>
            <TileTop><ChartIcon size={18} /> Ecosystem Analytics</TileTop>
            <TileSub>
              Anonymized roll-up of the whole token + money economy — tokens in circulation per
              bucket, gift volume (member → member), referral rewards, service payments, cash paid
              out, and managed Stripe accounts. Aggregates only; no individual wallets.
            </TileSub>
          </Tile>

          <Tile type="button" onClick={() => setOpenPaypal(true)}>
            <TileTop><PaypalIcon size={18} /> PayPal Faucet</TileTop>
            <TileSub>
              Tenant PayPal rail (the island) — enable / disable a tenant&apos;s PayPal, set its
              public credentials (client-id, hosted-button-id), and the global killswitch. Money goes
              straight to the tenant&apos;s own PayPal — off-stack, no tokens, no TGV float.
            </TileSub>
          </Tile>
        </Grid>
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

      {openCourse && <CourseControlModal onClose={() => setOpenCourse(false)} />}

      {openStudio && <StudioControlModal onClose={() => setOpenStudio(false)} />}

      {openPerformers && <PerformersControlModal onClose={() => setOpenPerformers(false)} />}

      {openDns && <DnsModal onClose={() => setOpenDns(false)} />}

      {openEcosystem && <EcosystemAnalyticsModal onClose={() => setOpenEcosystem(false)} />}

      {openPaypal && <PaypalControlModal onClose={() => setOpenPaypal(false)} />}
    </>
  );
}

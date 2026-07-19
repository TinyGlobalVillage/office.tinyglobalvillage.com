"use client";

// WalletClient — office chrome around the canonical @tgv/module-wallet panel, pointed at
// Office's /api/wallet proxy. That proxy forwards to HQ acting as THE BUSINESS member, so
// this is the TGV company wallet (not a staffer's personal one) — same panel, same gates.
//
// hqContext is deliberately OFF: that flag appends ?ctx=hq, which HQ resolves behind the
// `hq.wallet` capability on a BROWSER session. Office authenticates server-to-server, so the
// business is named by the proxy instead (see src/lib/wallet-bridge.ts).
//
// showReferral is off too — a referral code is a person's, not the company's.

import styled from "styled-components";
import { colors, rgb } from "../../theme";
import TopNav from "../../components/TopNav";
import { CashIcon } from "../../components/icons";
import { WalletPanel } from "@tgv/module-wallet/WalletPanel";

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
  gap: 0.625rem;
  margin: 1.25rem 0 0.5rem;
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
  margin: 0 0 1.25rem;
  font-size: 0.8125rem;
  color: var(--t-textFaint);
  line-height: 1.45;
`;

export default function WalletClient() {
  return (
    <>
      <TopNav />
      <PageMain>
        <HeaderRow>
          <CashIcon size={26} style={{ color: colors.gold }} />
          <PageTitle>Wallet</PageTitle>
        </HeaderRow>
        <PageSubtitle>
          The TGV business wallet — the same three buckets (Cash, Available, Retainer) you see on
          HQ. Balances and money movement run on tinyglobalvillage.com, which owns the ledger;
          Office just shows it and asks.
        </PageSubtitle>
        <WalletPanel apiBase="/api/wallet" showReferral={false} />
      </PageMain>
    </>
  );
}

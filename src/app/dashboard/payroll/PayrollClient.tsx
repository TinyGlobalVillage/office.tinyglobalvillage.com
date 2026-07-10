"use client";

// PayrollClient — office chrome around the canonical @tgv/module-payroll desk.
// Gold accent (money surface); the desk itself is host-agnostic and reads
// --payroll-accent from this wrapper.

import styled from "styled-components";
import { colors, rgb } from "../../theme";
import TopNav from "../../components/TopNav";
import { CashIcon } from "../../components/icons";
import { PayrollDesk } from "@tgv/module-payroll";

const PageMain = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 0 0.25rem 4rem;
  max-width: 80rem;
  margin: 0 auto;
  width: 100%;
  --payroll-accent: ${colors.gold};
  --payroll-accent-rgb: ${rgb.gold};

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

export default function PayrollClient() {
  return (
    <>
      <TopNav />
      <PageMain>
        <HeaderRow>
          <CashIcon size={26} style={{ color: colors.gold }} />
          <PageTitle>Payroll</PageTitle>
        </HeaderRow>
        <PageSubtitle>
          Staff time ledgers, audited adjustments, revision requests, and rates. Edits here are
          visible to staff in their Hours Ledger on next refresh — every change writes the audit
          trail.
        </PageSubtitle>
        <PayrollDesk apiBase="/api/payroll" />
      </PageMain>
    </>
  );
}

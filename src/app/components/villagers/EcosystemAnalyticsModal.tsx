"use client";

// EcosystemAnalyticsModal — the anonymized roll-up of TGV's token + money economy on the Villagers
// surface. An operator sees the SHAPE of the economy: tokens in circulation per bucket, gift volume
// (member-to-member transfers), referral rewards, service payments, cash paid out, and how many
// managed Stripe accounts exist — all aggregate, never an individual's wallet.
//
// Reads /api/admin/villagers/ecosystem-analytics (raw tgv_db aggregates). Operator-only — the route
// is requireAdmin-gated. Plain modal shell (like MemberWalletModal), not the HardeningControlModal.

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

type Lane = "live" | "test";
type Bucket = { bucket: string; outstanding: number; holders: number };
type Reason = { reason: string; credited: number; debited: number; entries: number };
type Withdrawal = { status: string; count: number; tokens: number; cents: number };

type Analytics = {
  env: string;
  tokenValueUsd: number;
  members: number;
  totalEntries: number;
  circulating: number;
  gifted: number;
  buckets: Bucket[];
  byReason: Reason[];
  withdrawals: Withdrawal[];
  managedAccounts: number | null;
};

const RATE = 0.25;
const usd = (tokens: number, rate = RATE) => `$${(tokens * rate).toFixed(2)}`;
const centsUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// Friendlier labels for the reasons we know; anything else shows its raw reason string.
const REASON_LABEL: Record<string, string> = {
  gift_transfer: "Gifts / transfers (member → member)",
  referral_reward: "Referral rewards",
  signup_bonus: "Signup bonuses",
  purchase_redemption: "Purchase redemptions",
  retainer_release: "Retainer releases",
  withdrawal: "Withdrawals (debited)",
  withdrawal_refund: "Withdrawal refunds",
  admin_grant: "Admin grants",
  admin_deduct: "Admin deductions",
};

export default function EcosystemAnalyticsModal({ onClose }: { onClose: () => void }) {
  const [lane, setLane] = useState<Lane>("live");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (l: Lane) => {
    setLoading(true);
    setErr(null);
    setData(null);
    try {
      const res = await fetch(`/api/admin/villagers/ecosystem-analytics?env=${l}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? `HTTP ${res.status}`);
      setData(d as Analytics);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(lane);
  }, [lane, load]);

  const rate = data?.tokenValueUsd ?? RATE;
  const paid = data?.withdrawals.find((w) => w.status === "paid");

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="gold" $maxWidth="50rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle>Ecosystem Analytics</ModalTitle>
              <Sub>Anonymized roll-up of the token + money economy · no individual wallets</Sub>
            </div>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <Stack>
            <LaneTabs>
              {(["live", "test"] as Lane[]).map((l) => (
                <LaneTab key={l} type="button" $active={lane === l} onClick={() => setLane(l)}>
                  {l}
                </LaneTab>
              ))}
            </LaneTabs>

            {loading && <Dim>Loading…</Dim>}
            {err && <ErrText>{err}</ErrText>}

            {data && !loading && (
              <>
                <StatRow>
                  <Stat>
                    <SLabel>Members</SLabel>
                    <SVal>{data.members}</SVal>
                    <Dim>with wallet activity</Dim>
                  </Stat>
                  <Stat>
                    <SLabel>In circulation</SLabel>
                    <SVal>{data.circulating}</SVal>
                    <Dim>{usd(data.circulating, rate)} across all buckets</Dim>
                  </Stat>
                  <Stat $accent>
                    <SLabel>Gifted</SLabel>
                    <SVal>{data.gifted}</SVal>
                    <Dim>{usd(data.gifted, rate)} member → member</Dim>
                  </Stat>
                  <Stat>
                    <SLabel>Cash paid out</SLabel>
                    <SVal>{paid ? paid.tokens : 0}</SVal>
                    <Dim>{paid ? centsUsd(paid.cents) : "$0.00"} · {paid?.count ?? 0} payouts</Dim>
                  </Stat>
                </StatRow>

                <Section>
                  <SecTitle>Tokens in circulation, by bucket</SecTitle>
                  <BucketsRow>
                    {data.buckets.length === 0 && <Dim>No tokens in this lane yet.</Dim>}
                    {data.buckets.map((b) => (
                      <BCard key={b.bucket} $accent={b.bucket === "retainer"}>
                        <BLabel>{b.bucket}</BLabel>
                        <BVal>
                          {b.outstanding} <Dim>({usd(b.outstanding, rate)})</Dim>
                        </BVal>
                        <Dim>{b.holders} holder{b.holders === 1 ? "" : "s"}</Dim>
                      </BCard>
                    ))}
                  </BucketsRow>
                </Section>

                <Section>
                  <SecTitle>The economy, by reason</SecTitle>
                  <Table>
                    <THead>
                      <span>Flow</span>
                      <RightCol>Credited</RightCol>
                      <RightCol>Debited</RightCol>
                      <RightCol>Entries</RightCol>
                    </THead>
                    {data.byReason.length === 0 && <Dim style={{ padding: "0.5rem 0" }}>No activity yet.</Dim>}
                    {data.byReason.map((r) => (
                      <TRow key={r.reason}>
                        <span>{REASON_LABEL[r.reason] ?? r.reason}</span>
                        <RightCol>{r.credited ? `+${r.credited}` : "—"}</RightCol>
                        <RightCol>{r.debited ? `−${r.debited}` : "—"}</RightCol>
                        <RightCol>{r.entries}</RightCol>
                      </TRow>
                    ))}
                  </Table>
                </Section>

                <Section>
                  <SecTitle>Money side</SecTitle>
                  <MoneyRow>
                    <Stat>
                      <SLabel>Managed Stripe accounts</SLabel>
                      <SVal>{data.managedAccounts ?? "—"}</SVal>
                      <Dim>{data.managedAccounts === null ? "not tracked in this env" : "provisioned"}</Dim>
                    </Stat>
                    <Stat>
                      <SLabel>Withdrawals</SLabel>
                      <SVal>{data.withdrawals.reduce((s, w) => s + w.count, 0)}</SVal>
                      <Dim>
                        {data.withdrawals.length === 0
                          ? "none yet"
                          : data.withdrawals.map((w) => `${w.count} ${w.status}`).join(" · ")}
                      </Dim>
                    </Stat>
                  </MoneyRow>
                  <Note>
                    Stripe gross payment volume (true GMV) will surface here once the payments-platform
                    charge ledger lands — today the token economy above is the proxy for platform flow.
                  </Note>
                </Section>

                <Note style={{ opacity: 0.75 }}>
                  Every number here is an aggregate — counts and sums over the ledger. No member, email,
                  or individual wallet is exposed on this surface.
                </Note>
              </>
            )}
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
const StatRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  @media (max-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;
const Stat = styled.div<{ $accent?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.7rem 0.8rem;
  border-radius: 0.5rem;
  border: 1px solid ${(p) => (p.$accent ? `rgba(${rgb.gold}, 0.45)` : "var(--t-border)")};
  background: ${(p) => (p.$accent ? `rgba(${rgb.gold}, 0.08)` : "rgba(0,0,0,0.2)")};
`;
const SLabel = styled.div`
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--t-textFaint);
`;
const SVal = styled.div`
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--t-text);
  line-height: 1.1;
`;
const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;
const SecTitle = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${colors.gold};
`;
const BucketsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;
const BCard = styled.div<{ $accent?: boolean }>`
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
const Table = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid var(--t-border);
  border-radius: 0.45rem;
  overflow: hidden;
`;
const THead = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 0.5rem;
  padding: 0.4rem 0.65rem;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--t-textFaint);
  background: rgba(0, 0, 0, 0.25);
`;
const TRow = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 0.5rem;
  padding: 0.45rem 0.65rem;
  font-size: 0.8rem;
  color: var(--t-text);
  border-top: 1px solid rgba(${rgb.gold}, 0.08);
`;
const RightCol = styled.span`
  text-align: right;
  font-variant-numeric: tabular-nums;
`;
const MoneyRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
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

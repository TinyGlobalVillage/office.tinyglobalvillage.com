// GET /api/admin/villagers/ecosystem-analytics?env=live — an ANONYMIZED roll-up of the whole TGV
// token + money economy, for the Villagers Ecosystem Analytics tile.
//
// Every figure here is an AGGREGATE (sum / count / distinct-count) over tgv_db `token_ledger` and
// `withdrawals` — no member_id, email, or name ever leaves this route. That's the "anonymized
// ecosystem roll-up" contract: an operator sees the shape of the economy (tokens in circulation,
// gift volume, referral rewards, service payments, cash paid out), never an individual's wallet.
//
// Reads tgv_db directly (raw SQL — tgv.com-owned tables, not in Office's schema; mirrors the
// member-wallet + cash-out queue routes). Operator-only (requireAdmin). Lane-scoped (live | test).
import { type NextRequest, NextResponse } from "next/server";
import { sql, type SQL } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";

export const runtime = "nodejs";

const TOKEN_VALUE_USD = 0.25;

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const env = new URL(req.url).searchParams.get("env") === "test" ? "test" : "live";

  // Tokens in circulation, per bucket (SUM(delta)) + how many distinct holders hold that bucket.
  const bucketsRes = await db.execute(sql`
    select bucket,
           coalesce(sum(delta), 0)::int as outstanding,
           count(distinct member_id)::int as holders
      from token_ledger
     where env = ${env}
     group by bucket
  `);

  // The economy by reason: credits minted (delta>0) vs debits spent/moved-out (delta<0), and how
  // many ledger entries. This surfaces gifts (gift_transfer), referrals (referral_*), service
  // payments, signup bonuses, withdrawals, admin grants — whatever reasons exist, no hardcoded set.
  const reasonRes = await db.execute(sql`
    select reason,
           coalesce(sum(case when delta > 0 then delta else 0 end), 0)::int as credited,
           coalesce(sum(case when delta < 0 then -delta else 0 end), 0)::int as debited,
           count(*)::int as entries
      from token_ledger
     where env = ${env}
     group by reason
     order by credited desc
  `);

  // Headline reach: distinct members who have ANY ledger entry + total entries.
  const reachRes = await db.execute(sql`
    select count(distinct member_id)::int as members,
           count(*)::int as entries
      from token_ledger
     where env = ${env}
  `);

  // Cash actually paid out (and the rest of the withdrawal lifecycle), by status.
  const withdrawalsRes = await db.execute(sql`
    select status,
           count(*)::int as count,
           coalesce(sum(amount_tokens), 0)::int as tokens,
           coalesce(sum(amount_cents), 0)::int as cents
      from withdrawals
     where env = ${env}
     group by status
  `);

  // Managed Stripe (Connect) accounts provisioned — a money-side reach metric. Defensive: the
  // connected_accounts table/columns are owned by @tgv/module-registry and may not exist in every
  // env, so a failure here degrades to null rather than 500-ing the whole roll-up.
  let managedAccounts: number | null = null;
  try {
    const acctRes = await db.execute(sql`select count(*)::int as count from connected_accounts`);
    managedAccounts = Number((acctRes.rows?.[0] as { count?: number } | undefined)?.count ?? 0);
  } catch {
    managedAccounts = null;
  }

  // ── Village population (env-scoped through villager_sites) ──────────────────
  // Villagers = members who OWN ≥1 site — a villager is a STATUS: owning a `villager`
  // row makes you one (TGV HQ, Refusionist, ResonantWeaver, Nevlo, …). Customers =
  // members who've bought from a villager's store (`customers` junction, guests with a
  // null account excluded). Members = the DEDUPED UNION of the two — every unique person
  // who is a villager and/or a customer, so a villager who also buys from another villager
  // counts once. Each count is defensive: the live `customers` table carries a
  // `seller_site_id` FK not reflected in every env's schema, so a failure degrades that
  // figure to null (→ "—" in the UI) instead of 500-ing the whole roll-up.
  const countOne = async (query: SQL): Promise<number | null> => {
    try {
      const r = await db.execute(query);
      return Number((r.rows?.[0] as { n?: number } | undefined)?.n ?? 0);
    } catch {
      return null;
    }
  };
  const villagers = await countOne(sql`
    select count(distinct v.member_id)::int as n
      from villager v
      join villager_sites vs on vs.id = v.site_id
     where vs.env = ${env}
  `);
  const customers = await countOne(sql`
    select count(distinct c.customer_member_id)::int as n
      from customers c
      join villager_sites vs on vs.id = c.seller_site_id
     where vs.env = ${env} and c.customer_member_id is not null
  `);
  let memberPeople = await countOne(sql`
    select count(*)::int as n from (
      select v.member_id as mid
        from villager v
        join villager_sites vs on vs.id = v.site_id
       where vs.env = ${env}
      union
      select c.customer_member_id as mid
        from customers c
        join villager_sites vs on vs.id = c.seller_site_id
       where vs.env = ${env} and c.customer_member_id is not null
    ) u
  `);
  // Union failed (e.g. customers.seller_site_id absent in this env) → best-effort headcount
  // is the villager count we already have.
  if (memberPeople === null) memberPeople = villagers;

  const buckets = (bucketsRes.rows as Array<{ bucket: string; outstanding: number; holders: number }>).map(
    (r) => ({ bucket: r.bucket, outstanding: Number(r.outstanding) || 0, holders: Number(r.holders) || 0 }),
  );
  const byReason = (
    reasonRes.rows as Array<{ reason: string; credited: number; debited: number; entries: number }>
  ).map((r) => ({
    reason: r.reason,
    credited: Number(r.credited) || 0,
    debited: Number(r.debited) || 0,
    entries: Number(r.entries) || 0,
  }));
  const reach = reachRes.rows?.[0] as { members?: number; entries?: number } | undefined;
  const withdrawals = (
    withdrawalsRes.rows as Array<{ status: string; count: number; tokens: number; cents: number }>
  ).map((r) => ({
    status: r.status,
    count: Number(r.count) || 0,
    tokens: Number(r.tokens) || 0,
    cents: Number(r.cents) || 0,
  }));

  const gifted = byReason.find((r) => r.reason === "gift_transfer")?.credited ?? 0;
  const circulating = buckets.reduce((s, b) => s + b.outstanding, 0);

  return NextResponse.json({
    env,
    tokenValueUsd: TOKEN_VALUE_USD,
    members: Number(reach?.members ?? 0),
    totalEntries: Number(reach?.entries ?? 0),
    circulating,
    gifted,
    buckets,
    byReason,
    withdrawals,
    managedAccounts,
    population: { villagers, customers, members: memberPeople },
  });
}

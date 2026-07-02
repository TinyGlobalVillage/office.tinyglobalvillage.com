// GET /api/admin/villagers/member-wallet?memberId=<uuid> — a member's 3-bucket token balances,
// both lanes (live + test), for the Villagers Member Wallet screen.
//
// Reads tgv_db `token_ledger` directly (raw SQL — tgv.com-owned table, not in Office's schema;
// mirrors the cash-out queue route). Balance = SUM(delta) per (env, bucket). Operator-only.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const zero = () => ({ cash: 0, available: 0, retainer: 0 });

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const memberId = (new URL(req.url).searchParams.get("memberId") ?? "").trim();
  if (!UUID_RE.test(memberId)) {
    return NextResponse.json({ error: "memberId must be a uuid" }, { status: 400 });
  }

  const res = await db.execute(sql`
    select env, bucket, coalesce(sum(delta), 0)::int as sum
      from token_ledger
     where member_id = ${memberId}
     group by env, bucket
  `);

  const balances: Record<"live" | "test", { cash: number; available: number; retainer: number }> = {
    live: zero(),
    test: zero(),
  };
  for (const r of res.rows as Array<{ env: string; bucket: string; sum: number }>) {
    const lane = r.env === "test" ? "test" : "live";
    if (r.bucket === "cash" || r.bucket === "available" || r.bucket === "retainer") {
      balances[lane][r.bucket] = Number(r.sum) || 0;
    }
  }
  return NextResponse.json({ memberId, balances });
}

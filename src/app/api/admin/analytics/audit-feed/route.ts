// GET /api/admin/analytics/audit-feed?limit=N
//
// Activity Timeline for the (promoted) EcosystemAnalyticsModal — the economy suite's operator feed.
// Analytics has no per-tenant enablement of its own, so this surfaces the MONEY-side operator
// actions already recorded in admin_audit_log: withdrawals (approve/paid/failed) and managed Stripe
// account events. Same shared { rows: TimelineRow[] } contract every suite tile uses.
//
// Read-only. Gated by requireAdmin.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { fetchAdminAuditRows } from "@/lib/suite-oversight";

export const runtime = "nodejs";

const ADMIN_ACTIONS = [
  "wallet.withdrawal_approve",
  "wallet.withdrawal_paid",
  "wallet.withdrawal_failed",
  "connect.managed_create",
  "connect.managed_charge_test",
] as const;

const ADMIN_LABEL: Record<string, string> = {
  "wallet.withdrawal_approve": "withdrawal approved",
  "wallet.withdrawal_paid": "withdrawal paid out",
  "wallet.withdrawal_failed": "withdrawal failed",
  "connect.managed_create": "managed Stripe account created",
  "connect.managed_charge_test": "managed test charge",
};
const ADMIN_OUTCOME: Record<string, string> = {
  "wallet.withdrawal_approve": "ok",
  "wallet.withdrawal_paid": "ok",
  "wallet.withdrawal_failed": "warn",
  "connect.managed_create": "ok",
  "connect.managed_charge_test": "ok",
};

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? "120")));

  const rows = await fetchAdminAuditRows({
    actions: ADMIN_ACTIONS,
    labels: ADMIN_LABEL,
    outcomes: ADMIN_OUTCOME,
    // mixed wallet.* / connect.* actions, all explicitly labelled above — no single prefix to strip.
    prefix: "",
    limit,
  });

  return NextResponse.json({ rows });
}

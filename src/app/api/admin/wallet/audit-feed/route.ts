// GET /api/admin/wallet/audit-feed?limit=N
//
// Activity Timeline for the WalletControlModal HCM tile. Reads admin_audit_log filtered to the
// wallet withdrawal actions, newest-first. Shape matches the AuditLogTimeline shared component
// contract ({ rows: TimelineRow[] }). Mirrors /api/admin/invitations/audit-feed.
//
// Pre-launch, only `wallet.withdrawal_config_update` fires (killswitch/limits edits); the queue
// transition actions are listed for forward-compat (they begin firing with Slice 3 at launch).
import { type NextRequest, NextResponse } from "next/server";
import { desc, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";

export const runtime = "nodejs";

const WALLET_ACTIONS = [
  "wallet.withdrawal_config_update",
  "wallet.withdrawal_approve",
  "wallet.withdrawal_paid",
  "wallet.withdrawal_failed",
  "wallet.withdrawal_cancel",
] as const;

const LABEL: Record<string, string> = {
  "wallet.withdrawal_config_update": "config updated",
  "wallet.withdrawal_approve": "withdrawal approved",
  "wallet.withdrawal_paid": "withdrawal paid",
  "wallet.withdrawal_failed": "withdrawal failed",
  "wallet.withdrawal_cancel": "withdrawal cancelled",
};
const OUTCOME: Record<string, string> = {
  "wallet.withdrawal_config_update": "ok",
  "wallet.withdrawal_approve": "ok",
  "wallet.withdrawal_paid": "ok",
  "wallet.withdrawal_failed": "err",
  "wallet.withdrawal_cancel": "warn",
};

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? "100")));

  const rows = await db
    .select({
      id: schema.adminAuditLog.id,
      createdAt: schema.adminAuditLog.createdAt,
      action: schema.adminAuditLog.action,
      note: schema.adminAuditLog.note,
      actorUserId: schema.adminAuditLog.actorUserId,
    })
    .from(schema.adminAuditLog)
    .where(inArray(schema.adminAuditLog.action, WALLET_ACTIONS as unknown as string[]))
    .orderBy(desc(schema.adminAuditLog.createdAt))
    .limit(limit);

  const shaped = rows.map((r) => ({
    id: r.id,
    ts: r.createdAt.toISOString(),
    kind: r.action,
    label: LABEL[r.action] ?? r.action.replaceAll("_", " "),
    detail: r.note ?? null,
    ip: null,
    by: r.actorUserId,
    outcome: OUTCOME[r.action] ?? "ok",
  }));

  return NextResponse.json({ rows: shaped });
}

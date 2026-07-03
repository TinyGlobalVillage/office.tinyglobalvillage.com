// GET /api/hardening/keycloak/audit-log
//
// Combined activity feed for the Keycloak HCM timeline — every keycloak.*
// action (realm updates, enrollment resends, sign-out-everywhere, client
// wiring, config changes) from the shared hardening JSONL sink.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readHardeningAuditRows } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ rows: readHardeningAuditRows(["keycloak."]) });
}

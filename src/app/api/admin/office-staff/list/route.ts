// GET /api/admin/office-staff/list
//
// Lists every Office STAFF account (TGV LLC employees) from the flat-file
// store data/users.json, with auth-enrollment counts for the
// OfficeStaffControlModal HCM. No secrets leave the box — only counts +
// display fields.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readUsers } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const store = readUsers();
  const staff = Object.entries(store).map(([username, u]) => ({
    username,
    displayName: u.displayName,
    email: u.email,
    passkeyCount: u.webauthnCredentials?.length ?? 0,
    totpEnabled: !!u.totpEnabled,
    recoveryCount: u.recoveryCodesHash?.length ?? 0,
  }));

  return NextResponse.json({ staff });
}

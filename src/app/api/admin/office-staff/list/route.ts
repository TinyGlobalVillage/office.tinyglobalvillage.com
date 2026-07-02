// GET /api/admin/office-staff/list
//
// Lists every Office STAFF account with auth-enrollment counts for the
// OfficeStaffControlModal HCM, read from the CANONICAL member store
// (members / member_passkeys). The office-staff.json roster is the
// username↔email map (and bounds the result to actual staff, so the non-staff
// admin@ member identity never surfaces). No secrets leave the box — only
// counts + display fields. Raw pgPool query (not Drizzle select-fields) per the
// @tgv/module-registry cross-bundle caveat.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readRoster } from "@/lib/member-auth/bridge";
import { pgPool } from "@/lib/pg-pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const roster = readRoster();
  const emails = Object.values(roster).map((r) => r.email.toLowerCase());

  let byEmail: Record<string, { name: string | null; passkey_count: number; totp_enabled: boolean; recovery_count: number }> = {};
  if (emails.length) {
    const { rows } = await pgPool.query<{
      email: string; name: string | null; passkey_count: number; totp_enabled: boolean; recovery_count: number;
    }>(
      `SELECT mu.email, mu.name,
         count(mp.credential_id)::int AS passkey_count,
         (mu.totp_secret IS NOT NULL) AS totp_enabled,
         coalesce(array_length(mu.recovery_codes_hash, 1), 0)::int AS recovery_count
       FROM members mu
       LEFT JOIN member_passkeys mp ON mp.member_id = mu.id
       WHERE lower(mu.email) = ANY($1)
       GROUP BY mu.email, mu.name, mu.totp_secret, mu.recovery_codes_hash`,
      [emails],
    );
    byEmail = Object.fromEntries(rows.map((r) => [r.email.toLowerCase(), r]));
  }

  const staff = Object.entries(roster).map(([username, r]) => {
    const m = byEmail[r.email.toLowerCase()];
    return {
      username,
      displayName: m?.name ?? username,
      email: r.email,
      role: r.role,
      passkeyCount: m?.passkey_count ?? 0,
      totpEnabled: m?.totp_enabled ?? false,
      recoveryCount: m?.recovery_count ?? 0,
    };
  });

  return NextResponse.json({ staff });
}

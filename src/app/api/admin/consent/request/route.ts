// POST /api/admin/consent/request — an Office admin requests scoped, consent-gated access to a
// tenant's account (kind=access_grant). The tenant owner approves on their dashboard; a code is
// emailed to the admin. Body: { targetSiteId, scopes[], note? }. Operator-only.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { memberIdForUsername } from "@/lib/member-auth/bridge";
import { db } from "@/lib/db-drizzle";
import { createConsentRequest } from "@tgv/module-consent/server";
import { OFFICE_CONSENT_MAIL } from "@/lib/consent/mail";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const adminMemberId = await memberIdForUsername(gate.username);
  if (!adminMemberId)
    return NextResponse.json({ ok: false, error: "your Office account has no members row" }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const targetSiteId = String(body.targetSiteId ?? "");
  const scopes = Array.isArray(body.scopes) ? body.scopes.map(String) : [];
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : undefined;
  if (!targetSiteId) return NextResponse.json({ ok: false, error: "targetSiteId required" }, { status: 400 });
  if (!scopes.length) return NextResponse.json({ ok: false, error: "pick at least one scope" }, { status: 400 });

  try {
    const res = await createConsentRequest(
      db as never,
      { kind: "access_grant", requesterMemberId: adminMemberId, targetSiteId, scopes, note },
      OFFICE_CONSENT_MAIL,
    );
    return NextResponse.json({ ok: true, id: res.id, reused: res.reused });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}

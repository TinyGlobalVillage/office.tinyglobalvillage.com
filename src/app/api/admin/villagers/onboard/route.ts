// /api/admin/villagers/onboard — operator-driven villager onboarding (P7
// "Add-villager onboarding"). Office collects the intent (person, subdomain,
// template, comp levers) and forwards to tgv.com's internal orchestrator
// (/api/internal/onboard-villager) via the internal-secret seam — tgv.com owns
// person/site/Keycloak/template writes; Office attributes + audits the action.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { resolveAdminActorId } from "@/lib/admin-actor";
import { db, schema } from "@/lib/db-drizzle";

export const runtime = "nodejs";

function tgvBase(): string {
  return (process.env.TGV_BASE_URL ?? "https://tinyglobalvillage.com").replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return NextResponse.json({ error: "internal_secret_unconfigured" }, { status: 503 });

  const actorId = await resolveAdminActorId(gate.username);
  if (!actorId) return NextResponse.json({ error: "no_actor_for_audit" }, { status: 500 });

  const bodyText = await req.text();

  let res: Response;
  try {
    res = await fetch(`${tgvBase()}/api/internal/onboard-villager`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": secret,
        "x-operator-actor-id": actorId,
      },
      cache: "no-store",
      body: bodyText,
    });
  } catch {
    return NextResponse.json({ error: "tgv_unreachable" }, { status: 502 });
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (res.ok && data.ok) {
    try {
      const intent = JSON.parse(bodyText) as Record<string, unknown>;
      await db.insert(schema.adminAuditLog).values({
        actorUserId: actorId,
        action: "member.onboarded_from_office",
        targetType: "member_user",
        targetId: String(data.memberId ?? ""),
        before: {},
        after: {
          email: intent.email ?? null,
          subdomain: data.subdomain ?? null,
          siteId: data.siteId ?? null,
          template: data.templatePicked ?? null,
          waiverUntil: intent.waiverUntil ?? null,
          enrollmentSent: data.enrollmentSent ?? false,
        },
        note: `Villager onboarded from Office by ${gate.username}`,
      });
    } catch (e) {
      console.error("[villagers/onboard] audit insert failed (non-fatal)", e);
    }
  }

  return NextResponse.json(data, { status: res.status });
}

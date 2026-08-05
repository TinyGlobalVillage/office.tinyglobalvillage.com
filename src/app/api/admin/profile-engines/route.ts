// /api/admin/profile-engines — who may see a bespoke Profile tab (plan 31/32).
//
// GET  ?engine=&search=&page=&pageSize= → the catalog plus one page of members
//                                          with their grant state for that engine.
// PUT  { memberId, engine, enabled }    → tick or untick one member; audited.
//
// THE SITE IS NOT A PARAMETER. An engine belongs to exactly the sites the
// catalog names (@tgv/module-dashboard/profile-engines/catalog), so the site is
// DERIVED here rather than accepted from the client — otherwise the surface
// would let an operator grant resonantweaver's engine to a giocoelho member by
// editing one field in a request. The catalog is checked again inside
// setMemberEngineGrant, so this is belt and braces on purpose.
//
// The write also reaches refusionist's own `member_orakle_prefs` for cospro (see
// grants.ts) — the live site still reads that flag, and an operator toggle that
// looked inert would be worse than no toggle at all.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { pgPool } from "@/lib/pg-pool";
import { db, schema } from "@/lib/db-drizzle";
import { resolveAdminActorId } from "@/lib/admin-actor";
import { PROFILE_ENGINES, engineByKey } from "@tgv/module-dashboard/profile-engines/catalog";
import {
  listMemberEngineGrants,
  setMemberEngineGrant,
} from "@tgv/module-dashboard/profile-engines/grants";

export const runtime = "nodejs";

/** The one site this engine belongs to. Multi-site engines would need a picker;
 *  neither of today's two has more than one, and guessing would be a leak. */
function siteFor(engineKey: string): string | null {
  return engineByKey(engineKey)?.sites[0] ?? null;
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const url = new URL(req.url);
  const engine = (url.searchParams.get("engine") ?? PROFILE_ENGINES[0]?.key ?? "").trim();
  const search = url.searchParams.get("search");
  const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") ?? 10) || 10, 1), 100);
  const page = Math.max(Number(url.searchParams.get("page") ?? 1) || 1, 1);
  const site = siteFor(engine);

  const catalog = PROFILE_ENGINES.map((e) => ({
    key: e.key,
    label: e.label,
    blurb: e.blurb,
    site: e.sites[0] ?? null,
  }));

  if (!site) {
    return NextResponse.json({ ok: true, engines: catalog, engine, site: null, rows: [], total: 0, page, pageSize });
  }

  const { rows, total } = await listMemberEngineGrants(pgPool, {
    site,
    engine,
    search,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return NextResponse.json({ ok: true, engines: catalog, engine, site, rows, total, page, pageSize });
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  // Same rule as the feature-flag board: no resolvable actor, no write. A grant
  // that nobody is on the hook for is exactly what the audit trail is for.
  const actorUserId = await resolveAdminActorId(gate.username);
  if (!actorUserId) {
    return NextResponse.json(
      { ok: false, error: "Admin actor not registered in users table" },
      { status: 403 },
    );
  }

  let body: { memberId?: string; engine?: string; enabled?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const memberId = (body.memberId ?? "").trim();
  const engine = (body.engine ?? "").trim();
  const enabled = body.enabled === true;
  const site = siteFor(engine);
  if (!memberId) return NextResponse.json({ ok: false, error: "memberId required" }, { status: 400 });
  if (!site) return NextResponse.json({ ok: false, error: `unknown engine "${engine}"` }, { status: 400 });

  const res = await setMemberEngineGrant(pgPool, {
    memberId,
    engine,
    site,
    enabled,
    actor: gate.username,
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });

  await db.insert(schema.adminAuditLog).values({
    actorUserId,
    action: enabled ? "platform.profile_engine_grant" : "platform.profile_engine_revoke",
    targetType: "profile_engine",
    targetId: `${engine}:${memberId}`,
    before: { enabled: !enabled },
    after: { enabled },
    note: `Profile engine '${engine}' (${site}) ${enabled ? "granted to" : "revoked from"} member ${memberId} by ${gate.username}`,
  });

  return NextResponse.json({ ok: true, memberId, engine, site, enabled });
}

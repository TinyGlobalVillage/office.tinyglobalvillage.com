// /api/app-access — staff levels for the TGV desktop app (plan tgv-desktop-app.md P3; tables tgv.com 0254).
// GET  ?village=hq → levels, assignments, owners, the village's root ceiling, what the caller may edit.
// POST {action, …}: level.save | level.delete | assign | owner.save (owner.save = superadmin only).
// Superadmin edits every village; a village owner edits their own village's levels and staff, with
// Backend roots clipped to the ceiling HQ gave the village. Every change → hardening audit log.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db-drizzle";
import { officeMemberAuth } from "@/lib/member-auth/config";
import { allBackendRoots, APP_MODES, clipRoots } from "@tgv/module-auth/auth/member-auth/appAccess";
import { logHardeningAction } from "@/lib/audit-log";

const noStore = { "Cache-Control": "no-store" };
type Rows<T> = { rows: T[] };
const rows = async <T,>(q: ReturnType<typeof sql>) => ((await db.execute(q)) as unknown as Rows<T>).rows;
const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: noStore });

async function caller(village: string) {
  const s = await officeMemberAuth.getActiveSession();
  if (!s || !s.twoFactorVerified || s.viaApp) return null;
  const superadmin = s.user.role === "superadmin";
  const [own] = await rows<{ backend_roots: string[] }>(sql`
    SELECT backend_roots FROM app_village_owners WHERE village_id = ${village} AND member_id = ${s.userId}`);
  if (!superadmin && !own) return "forbidden" as const;
  const ceiling = superadmin
    ? village === "hq"
      ? allBackendRoots()
      : clipRoots(
          (await rows<{ backend_roots: string[] }>(sql`SELECT backend_roots FROM app_village_owners WHERE village_id = ${village}`))
            .flatMap((r) => r.backend_roots),
          allBackendRoots(),
        )
    : clipRoots(own!.backend_roots, allBackendRoots());
  return { id: s.userId, email: s.user.email, superadmin, ceiling };
}

function villageOf(v: unknown) {
  const s = String(v ?? "hq");
  return /^[a-z0-9-]{1,64}$/.test(s) ? s : null;
}

export async function GET(req: NextRequest) {
  const village = villageOf(req.nextUrl.searchParams.get("village"));
  if (!village) return fail("bad village");
  const c = await caller(village);
  if (!c) return fail("unauthorized", 401);
  if (c === "forbidden") return fail("not your village", 403);
  const levels = await rows(sql`
    SELECT id, name, modes, backend_roots, backend_writable, backend_terminal, backend_git, updated_at
    FROM app_staff_levels WHERE village_id = ${village} ORDER BY name`);
  const members = await rows(sql`
    SELECT m.member_id, m.level_id, u.email, u.name, u.role
    FROM app_staff_level_members m JOIN members u ON u.id = m.member_id
    WHERE m.village_id = ${village} ORDER BY lower(u.email)`);
  const owners = await rows(sql`
    SELECT o.member_id, o.backend_roots, u.email, u.name
    FROM app_village_owners o JOIN members u ON u.id = o.member_id
    WHERE o.village_id = ${village} ORDER BY lower(u.email)`);
  return NextResponse.json(
    { ok: true, village, levels, members, owners, ceiling: c.ceiling, modes: APP_MODES, superadmin: c.superadmin },
    { headers: noStore },
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const village = villageOf(body.village);
  if (!village) return fail("bad village");
  const c = await caller(village);
  if (!c) return fail("unauthorized", 401);
  if (c === "forbidden") return fail("not your village", 403);
  const action = String(body.action ?? "");
  const audit = (success: boolean, target: string | null, details: Record<string, unknown>) =>
    logHardeningAction({ action: `app-access.${action}`, target, user: c.email, success, details: { village, ...details } });

  const memberByEmail = async (email: unknown) =>
    (await rows<{ id: string }>(sql`SELECT id FROM members WHERE lower(email) = ${String(email ?? "").trim().toLowerCase()} AND deleted_at IS NULL LIMIT 1`))[0]?.id;

  if (action === "level.save") {
    const l = (body.level ?? {}) as Record<string, unknown>;
    const name = String(l.name ?? "").trim().slice(0, 60);
    if (!name) return fail("name the level");
    const modes = (Array.isArray(l.modes) ? l.modes : []).map(String).filter((m) => (APP_MODES as readonly string[]).includes(m));
    const roots = clipRoots((Array.isArray(l.backend_roots) ? l.backend_roots : []).map(String), c.ceiling);
    const flags = { w: !!l.backend_writable, t: !!l.backend_terminal, g: !!l.backend_git };
    const modesSql = sql`ARRAY[${sql.join(modes.map((m) => sql`${m}`), sql`, `)}]::text[]`;
    const rootsSql = roots.length ? sql`ARRAY[${sql.join(roots.map((r) => sql`${r}`), sql`, `)}]::text[]` : sql`'{}'::text[]`;
    const modesVal = modes.length ? modesSql : sql`'{}'::text[]`;
    const [row] = l.id
      ? await rows<{ id: string }>(sql`
          UPDATE app_staff_levels SET name = ${name}, modes = ${modesVal}, backend_roots = ${rootsSql},
            backend_writable = ${flags.w}, backend_terminal = ${flags.t}, backend_git = ${flags.g},
            updated_by = ${c.id}, updated_at = now()
          WHERE id = ${String(l.id)} AND village_id = ${village} RETURNING id`)
      : await rows<{ id: string }>(sql`
          INSERT INTO app_staff_levels (village_id, name, modes, backend_roots, backend_writable, backend_terminal, backend_git, updated_by)
          VALUES (${village}, ${name}, ${modesVal}, ${rootsSql}, ${flags.w}, ${flags.t}, ${flags.g}, ${c.id}) RETURNING id`);
    audit(!!row, row?.id ?? null, { name, modes, roots, ...flags });
    return row ? NextResponse.json({ ok: true, id: row.id, roots }, { headers: noStore }) : fail("level not found", 404);
  }

  if (action === "level.delete") {
    const [row] = await rows<{ id: string }>(sql`
      DELETE FROM app_staff_levels WHERE id = ${String(body.id ?? "")} AND village_id = ${village} RETURNING id`);
    audit(!!row, String(body.id ?? ""), {});
    return NextResponse.json({ ok: !!row }, { headers: noStore });
  }

  if (action === "assign") {
    const memberId = await memberByEmail(body.email);
    if (!memberId) return fail("no member with that email", 404);
    if (body.levelId) {
      const [lv] = await rows<{ id: string }>(sql`SELECT id FROM app_staff_levels WHERE id = ${String(body.levelId)} AND village_id = ${village}`);
      if (!lv) return fail("level not found", 404);
      await db.execute(sql`
        INSERT INTO app_staff_level_members (village_id, member_id, level_id, assigned_by)
        VALUES (${village}, ${memberId}, ${lv.id}, ${c.id})
        ON CONFLICT (village_id, member_id) DO UPDATE SET level_id = EXCLUDED.level_id, assigned_by = EXCLUDED.assigned_by, assigned_at = now()`);
    } else {
      await db.execute(sql`DELETE FROM app_staff_level_members WHERE village_id = ${village} AND member_id = ${memberId}`);
    }
    audit(true, String(body.email ?? ""), { levelId: body.levelId ?? null });
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  if (action === "owner.save") {
    if (!c.superadmin) return fail("superadmin only", 403);
    const memberId = await memberByEmail(body.email);
    if (!memberId) return fail("no member with that email", 404);
    if (body.remove) {
      await db.execute(sql`DELETE FROM app_village_owners WHERE village_id = ${village} AND member_id = ${memberId}`);
    } else {
      const roots = clipRoots((Array.isArray(body.backend_roots) ? body.backend_roots : []).map(String), allBackendRoots());
      const rootsSql = roots.length ? sql`ARRAY[${sql.join(roots.map((r) => sql`${r}`), sql`, `)}]::text[]` : sql`'{}'::text[]`;
      await db.execute(sql`
        INSERT INTO app_village_owners (village_id, member_id, backend_roots) VALUES (${village}, ${memberId}, ${rootsSql})
        ON CONFLICT (village_id, member_id) DO UPDATE SET backend_roots = EXCLUDED.backend_roots`);
    }
    audit(true, String(body.email ?? ""), { remove: !!body.remove, roots: body.backend_roots ?? null });
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  return fail("unknown action");
}

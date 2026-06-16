// /api/admin/course/config — Office operator control for the @tgv/module-course killswitch.
//
//   GET → the current enablement config (global killswitch + per-tenant map).
//   PUT → mutate the global killswitch OR a single tenant's enablement/cap; write the shared file;
//         audit the change to admin_audit_log.
//
// Unlike the wallet config (tenant-owned money → proxied to tgv.com), course enablement is
// cross-tenant OPERATOR config, so Office owns the file directly (see lib/course-config.ts). The
// tenant /api/course dispatcher reads the same file via @tgv/module-course's isCourseEnabled().
//
// Gated by requireAdmin; the change is attributed to the operator's legacy users.id.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { resolveAdminActorId } from "@/lib/admin-actor";
import { existsSync } from "node:fs";
import { db, schema } from "@/lib/db-drizzle";
import {
  type CourseEnablementConfig,
  COURSE_CONFIG_PATH,
  readCourseConfig,
  writeCourseConfig,
} from "@/lib/course-config";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json({ config: readCourseConfig() });
}

type PutBody = {
  globalKillswitch?: boolean;
  tenant?: { memberId: string; enabled?: boolean; maxCourses?: number | null };
};

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const actorUserId = await resolveAdminActorId(gate.username);
  if (!actorUserId) return NextResponse.json({ error: "no_actor_for_audit" }, { status: 500 });

  const body = (await req.json().catch(() => null)) as PutBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // The SEED fallback (missing file) gives us a registry to mutate so the tenant list persists — but
  // the AUDIT `before` must reflect ACTUAL disk state, so it's null when no file has ever been written
  // (don't log the seed as if it were the prior live config).
  const fileExists = existsSync(COURSE_CONFIG_PATH);
  const current = readCourseConfig();
  const next: CourseEnablementConfig = {
    globalKillswitch: current.globalKillswitch,
    perTenant: { ...current.perTenant },
  };

  // Decide the single logical change (the modal saves one control at a time) for an honest audit row.
  let action: string | null = null;
  let targetId = "global";
  let note = "";

  if (typeof body.globalKillswitch === "boolean" && body.globalKillswitch !== current.globalKillswitch) {
    next.globalKillswitch = body.globalKillswitch;
    action = body.globalKillswitch ? "course.killswitch_on" : "course.killswitch_off";
    note = `Global course killswitch ${body.globalKillswitch ? "ENGAGED — all tenants blocked" : "released"}`;
  } else if (body.tenant && typeof body.tenant.memberId === "string") {
    const id = body.tenant.memberId;
    const cur = next.perTenant[id];
    if (!cur) return NextResponse.json({ error: "unknown_tenant" }, { status: 404 });
    targetId = id;

    if (typeof body.tenant.enabled === "boolean" && body.tenant.enabled !== cur.enabled) {
      next.perTenant[id] = { ...cur, enabled: body.tenant.enabled };
      action = body.tenant.enabled ? "course.tenant_enabled" : "course.tenant_disabled";
      note = `Course ${body.tenant.enabled ? "enabled" : "disabled"} for ${cur.label ?? id}`;
    } else if (body.tenant.maxCourses !== undefined) {
      const cap =
        body.tenant.maxCourses === null
          ? null
          : Math.max(0, Math.floor(Number(body.tenant.maxCourses) || 0));
      if (cap !== (cur.maxCourses ?? null)) {
        next.perTenant[id] = { ...cur, maxCourses: cap };
        action = "course.config_update";
        note = `Course cap for ${cur.label ?? id} → ${cap === null || cap === 0 ? "unlimited" : cap}`;
      }
    }
  }

  if (!action) {
    // No recognised/effective change — return current state without writing or auditing.
    return NextResponse.json({ config: current, changed: false });
  }

  writeCourseConfig(next);

  await db.insert(schema.adminAuditLog).values({
    actorUserId,
    action,
    targetType: "course_config",
    targetId,
    before: fileExists ? (current as unknown as Record<string, unknown>) : null,
    after: next as unknown as Record<string, unknown>,
    note: `${note}${fileExists ? "" : " (initial config write)"} — by ${gate.username}`,
  });

  return NextResponse.json({ config: next, changed: true });
}

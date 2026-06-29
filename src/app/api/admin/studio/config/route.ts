// /api/admin/studio/config — Office operator control for the @tgv/module-studio killswitch.
//
//   GET → the current enablement config (global killswitch + per-tenant map).
//   PUT → mutate the global killswitch OR a single tenant's enablement; write the shared file;
//         audit the change to admin_audit_log.
//
// Unlike the wallet config (tenant-owned money → proxied to tgv.com), studio enablement is
// cross-tenant OPERATOR config, so Office owns the file directly (see lib/studio-config.ts). Each
// host's studio dispatcher reads the same file via @tgv/module-studio's isStudioEnabled().
//
// Gated by requireAdmin; the change is attributed to the operator's legacy users.id.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { resolveAdminActorId } from "@/lib/admin-actor";
import { existsSync } from "node:fs";
import { db, schema } from "@/lib/db-drizzle";
import {
  type StudioEnablementConfig,
  STUDIO_CONFIG_PATH,
  readStudioConfig,
  writeStudioConfig,
} from "@/lib/studio-config";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json({ config: readStudioConfig() });
}

type PutBody = {
  globalKillswitch?: boolean;
  tenant?: { memberId: string; enabled?: boolean; lateCancelWindowHours?: number | null };
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
  const fileExists = existsSync(STUDIO_CONFIG_PATH);
  const current = readStudioConfig();
  const next: StudioEnablementConfig = {
    globalKillswitch: current.globalKillswitch,
    lateCancelWindowHours: current.lateCancelWindowHours,
    perTenant: { ...current.perTenant },
  };

  // Decide the single logical change (the modal saves one control at a time) for an honest audit row.
  let action: string | null = null;
  let targetId = "global";
  let note = "";

  if (typeof body.globalKillswitch === "boolean" && body.globalKillswitch !== current.globalKillswitch) {
    next.globalKillswitch = body.globalKillswitch;
    action = body.globalKillswitch ? "studio.killswitch_on" : "studio.killswitch_off";
    note = `Global studio killswitch ${body.globalKillswitch ? "ENGAGED — all tenants blocked" : "released"}`;
  } else if (body.tenant && typeof body.tenant.memberId === "string") {
    const id = body.tenant.memberId;
    const cur = next.perTenant[id];
    if (!cur) return NextResponse.json({ error: "unknown_tenant" }, { status: 404 });
    targetId = id;

    if (typeof body.tenant.enabled === "boolean" && body.tenant.enabled !== cur.enabled) {
      next.perTenant[id] = { ...cur, enabled: body.tenant.enabled };
      action = body.tenant.enabled ? "studio.tenant_enabled" : "studio.tenant_disabled";
      note = `Studio ${body.tenant.enabled ? "enabled" : "disabled"} for ${cur.label ?? id}`;
    } else if (body.tenant.lateCancelWindowHours !== undefined) {
      // Forfeiture window: a non-negative integer sets a per-tenant override; null clears it
      // (the tenant then inherits the platform default).
      const raw = body.tenant.lateCancelWindowHours;
      const val =
        raw === null
          ? null
          : typeof raw === "number" && Number.isFinite(raw) && raw >= 0
            ? Math.floor(raw)
            : undefined;
      if (val === undefined) {
        return NextResponse.json({ error: "invalid_window" }, { status: 400 });
      }
      if (val !== (cur.lateCancelWindowHours ?? null)) {
        if (val === null) {
          const copy = { ...cur };
          delete copy.lateCancelWindowHours;
          next.perTenant[id] = copy;
        } else {
          next.perTenant[id] = { ...cur, lateCancelWindowHours: val };
        }
        action = "studio.late_cancel_window_set";
        note =
          val === null
            ? `Late-cancel window cleared for ${cur.label ?? id} (now platform default)`
            : `Late-cancel window set to ${val}h for ${cur.label ?? id}`;
      }
    }
  }

  if (!action) {
    // No recognised/effective change — return current state without writing or auditing.
    return NextResponse.json({ config: current, changed: false });
  }

  writeStudioConfig(next);

  await db.insert(schema.adminAuditLog).values({
    actorUserId,
    action,
    targetType: "studio_config",
    targetId,
    before: fileExists ? (current as unknown as Record<string, unknown>) : null,
    after: next as unknown as Record<string, unknown>,
    note: `${note}${fileExists ? "" : " (initial config write)"} — by ${gate.username}`,
  });

  return NextResponse.json({ config: next, changed: true });
}

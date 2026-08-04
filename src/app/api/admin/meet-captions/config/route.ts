// /api/admin/meet-captions/config — Office operator control for meet live captions.
//
//   GET → the current config (global killswitch + whisper engine params).
//   PUT → flip the killswitch OR update the engine params (endpoint / model / language /
//         maxRooms); write the shared file; audit the change to admin_audit_log.
//
// The file is read at runtime by the meet settings handler and services/meet-captions
// (see lib/meet-captions-config.ts) — a flip here takes effect with no restart.
// Gated by requireAdmin; the change is attributed to the operator's legacy users.id.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { resolveAdminActorId } from "@/lib/admin-actor";
import { db, schema } from "@/lib/db-drizzle";
import {
  type MeetCaptionsConfig,
  SEED_CONFIG,
  readMeetCaptionsConfig,
  readMeetCaptionsConfigStrict,
  writeMeetCaptionsConfig,
} from "@/lib/meet-captions-config";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json({ config: readMeetCaptionsConfig() });
}

type PutBody = {
  globalKillswitch?: boolean;
  params?: {
    whisperEndpoint?: string;
    whisperModel?: string;
    language?: string;
    maxRooms?: number;
  };
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

  // Strict WRITE baseline: a CORRUPT file aborts (never clobber an unparseable config with seed
  // defaults + a fabricated audit `before`); a MISSING file mutates on the seed with before=null.
  const strict = readMeetCaptionsConfigStrict();
  if (strict === "corrupt") {
    return NextResponse.json({ error: "config_corrupt" }, { status: 409 });
  }
  const fileExists = strict !== "missing";
  const current = strict === "missing" ? SEED_CONFIG : strict;
  const next: MeetCaptionsConfig = { ...current, perTenant: { ...current.perTenant } };

  let action: string | null = null;
  let note = "";

  if (typeof body.globalKillswitch === "boolean" && body.globalKillswitch !== current.globalKillswitch) {
    next.globalKillswitch = body.globalKillswitch;
    action = body.globalKillswitch ? "meet_captions.killswitch_on" : "meet_captions.killswitch_off";
    note = body.globalKillswitch
      ? "Meet captions killswitch ENGAGED — captions off platform-wide"
      : "Meet captions killswitch released — hosts may turn captions on";
  } else if (body.params && typeof body.params === "object") {
    const p = body.params;
    const changed: string[] = [];
    if (typeof p.whisperEndpoint === "string" && p.whisperEndpoint.trim() && p.whisperEndpoint.trim() !== current.whisperEndpoint) {
      if (!/^https?:\/\//.test(p.whisperEndpoint.trim())) {
        return NextResponse.json({ error: "invalid_whisper_endpoint" }, { status: 400 });
      }
      next.whisperEndpoint = p.whisperEndpoint.trim();
      changed.push("endpoint");
    }
    if (typeof p.whisperModel === "string" && p.whisperModel.trim() && p.whisperModel.trim() !== current.whisperModel) {
      next.whisperModel = p.whisperModel.trim();
      changed.push("model");
    }
    if (typeof p.language === "string" && p.language.trim().toLowerCase() !== current.language) {
      next.language = p.language.trim().toLowerCase();
      changed.push("language");
    }
    if (typeof p.maxRooms === "number" && Number.isFinite(p.maxRooms)) {
      const rooms = Math.max(1, Math.min(20, Math.floor(p.maxRooms)));
      if (rooms !== current.maxRooms) {
        next.maxRooms = rooms;
        changed.push("maxRooms");
      }
    }
    if (changed.length > 0) {
      action = "meet_captions.config_updated";
      note = `Meet captions engine updated (${changed.join(", ")})`;
    }
  }

  if (!action) {
    // No recognised/effective change — return current state without writing or auditing.
    return NextResponse.json({ config: current, changed: false });
  }

  writeMeetCaptionsConfig(next);

  await db.insert(schema.adminAuditLog).values({
    actorUserId,
    action,
    targetType: "meet_captions_config",
    targetId: "global",
    before: fileExists ? (current as unknown as Record<string, unknown>) : null,
    after: next as unknown as Record<string, unknown>,
    note: `${note}${fileExists ? "" : " (initial config write)"} — by ${gate.username}`,
  });

  return NextResponse.json({ config: next, changed: true });
}

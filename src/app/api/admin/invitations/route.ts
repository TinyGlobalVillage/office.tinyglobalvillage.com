// /api/admin/invitations — Office operator API over the shared invite_codes /
// invite_redemptions tables (the Invitations tile under Utils → Hardening).
//
//   GET   → list codes + redemption summary
//   POST  → mint a code (+ email via tgv.com internal endpoint), OR
//           { action:"resend", id } to re-send an existing code's email
//   PATCH → revoke / reactivate / edit note, expiry, max_uses
//
// Gated by Office requireAdmin. Mutations write admin_audit_log. The branded
// invite email lives on tgv.com (Nodemailer + brand); Office triggers it via
// POST /api/internal/send-invite with INTERNAL_API_SECRET — best-effort, the
// code is created regardless and its link is always copyable from the modal.
import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";
import { resolveAdminActorId } from "@/lib/admin-actor";

export const runtime = "nodejs";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateInviteCode(): string {
  const bytes = randomBytes(8);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `TGV-${s.slice(0, 4)}-${s.slice(4, 8)}`;
}

function tgvBase(): string {
  return (process.env.TGV_BASE_URL ?? "https://tinyglobalvillage.com").replace(/\/$/, "");
}
function inviteLink(code: string): string {
  return `${tgvBase()}/claim?invite=${encodeURIComponent(code)}`;
}

// Fire the branded email via tgv.com. Best-effort; returns whether it sent.
async function triggerInviteEmail(to: string, code: string): Promise<boolean> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  try {
    const res = await fetch(`${tgvBase()}/api/internal/send-invite`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": secret },
      body: JSON.stringify({ to, code }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const res = await db.execute(sql`
    select c.id, c.code, c.email, c.max_uses, c.used_count, c.expires_at, c.active, c.note,
           c.created_at,
           (select count(*) from invite_redemptions r where r.invite_code_id = c.id)::int
             as redeemed_count,
           (select ru.email from invite_redemptions r
              join members ru on ru.id = r.member_user_id
             where r.invite_code_id = c.id order by r.redeemed_at desc limit 1)
             as latest_redeemer,
           (select max(r.redeemed_at) from invite_redemptions r where r.invite_code_id = c.id)
             as latest_redeemed_at
      from invite_codes c
     order by c.created_at desc
  `);
  return NextResponse.json({ ok: true, codes: res.rows, base: tgvBase() });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const actorUserId = await resolveAdminActorId(gate.username);

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    id?: string;
    email?: string;
    code?: string;
    maxUses?: number | null;
    expiresAt?: string | null;
    note?: string | null;
  } | null;

  // Resend an existing code's email.
  if (body?.action === "resend") {
    if (!body.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
    const row = await db.execute(sql`
      select code, email from invite_codes where id = ${body.id} limit 1
    `);
    const r = row.rows[0] as { code: string; email: string | null } | undefined;
    if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (!r.email) return NextResponse.json({ error: "no_email" }, { status: 422 });
    const sent = await triggerInviteEmail(r.email, r.code);
    await db.insert(schema.adminAuditLog).values({
      actorUserId,
      action: "invite_resent",
      targetType: "invite_code",
      targetId: body.id,
      note: `Resent by ${gate.username} to ${r.email}${sent ? "" : " (send failed)"}`,
    });
    return NextResponse.json({ ok: true, emailed: sent });
  }

  // Mint a new code.
  const email = body?.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const code = (body?.code?.trim() || generateInviteCode()).slice(0, 64);
  const maxUses = body?.maxUses === null ? null : (body?.maxUses ?? 1);
  const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json({ error: "invalid_expiry" }, { status: 400 });
  }
  const note = body?.note?.slice(0, 500) ?? null;

  let id: string;
  try {
    const ins = await db.execute(sql`
      insert into invite_codes (code, email, max_uses, expires_at, note, created_by)
      values (${code}, ${email}, ${maxUses}, ${expiresAt ? expiresAt.toISOString() : null},
              ${note}, ${actorUserId})
      returning id
    `);
    id = (ins.rows[0] as { id: string }).id;
  } catch {
    return NextResponse.json({ error: "code_exists" }, { status: 409 });
  }

  const emailed = email ? await triggerInviteEmail(email, code) : false;

  await db.insert(schema.adminAuditLog).values({
    actorUserId,
    action: "invite_created",
    targetType: "invite_code",
    targetId: id,
    after: { code, email, maxUses, expiresAt: expiresAt?.toISOString() ?? null },
    note: `Created by ${gate.username}${email ? ` for ${email}` : " (generic)"}${
      emailed ? "" : email ? " (email not sent)" : ""
    }`,
  });

  return NextResponse.json({ ok: true, id, code, link: inviteLink(code), emailed });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const actorUserId = await resolveAdminActorId(gate.username);

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    active?: boolean;
    note?: string | null;
    expiresAt?: string | null;
    maxUses?: number | null;
  } | null;
  if (!body?.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const changes: string[] = [];
  if (typeof body.active === "boolean") {
    await db.execute(
      sql`update invite_codes set active = ${body.active}, updated_at = now() where id = ${body.id}`,
    );
    changes.push(body.active ? "reactivated" : "revoked");
  }
  if (body.note !== undefined) {
    await db.execute(
      sql`update invite_codes set note = ${body.note?.slice(0, 500) ?? null}, updated_at = now() where id = ${body.id}`,
    );
    changes.push("note");
  }
  if (body.expiresAt !== undefined) {
    const exp = body.expiresAt ? new Date(body.expiresAt) : null;
    if (exp && Number.isNaN(exp.getTime())) {
      return NextResponse.json({ error: "invalid_expiry" }, { status: 400 });
    }
    await db.execute(
      sql`update invite_codes set expires_at = ${exp ? exp.toISOString() : null}, updated_at = now() where id = ${body.id}`,
    );
    changes.push("expiry");
  }
  if (body.maxUses !== undefined) {
    await db.execute(
      sql`update invite_codes set max_uses = ${body.maxUses}, updated_at = now() where id = ${body.id}`,
    );
    changes.push("max_uses");
  }

  if (changes.length > 0) {
    await db.insert(schema.adminAuditLog).values({
      actorUserId,
      action: "invite_updated",
      targetType: "invite_code",
      targetId: body.id,
      note: `Updated by ${gate.username}: ${changes.join(", ")}`,
    });
  }

  return NextResponse.json({ ok: true });
}

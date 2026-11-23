// /api/staff/signup — the navbar "Sign Up" hot button (Gio 2026-11-22).
//
// Any signed-in member of staff signs a person up by name + email. That mints a
// single-use, email-bound invite code (the same invite_codes table the Invitations
// tile manages — so every sign-up shows up, and can be revoked, there) and has
// tgv.com send the sign-up email: "Sign up in your browser" + "Download the app".
// The claim link drops them into the wizard, which offers payment or the demo.
//
//   GET  → the caller's recent sign-ups (status: sent / joined / expired / revoked)
//   POST → { name, email, note? } sign someone up, or { action: "resend", id }
//
// Gated by requireAuth (staff — not admin-only: front desk signs people up too).
// Every sign-up and resend writes admin_audit_log.
import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { requireAuth } from "@/lib/api-auth";
import { db, schema } from "@/lib/db-drizzle";
import { resolveAdminActorId } from "@/lib/admin-actor";

export const runtime = "nodejs";

const NOTE_PREFIX = "Sign Up";
const EXPIRES_DAYS = 30;
const MAX_PER_HOUR = 30;
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
const inviteLink = (code: string) => `${tgvBase()}/claim?invite=${encodeURIComponent(code)}`;

async function sendSignupEmail(to: string, code: string, name: string | null, invitedBy: string | null): Promise<boolean> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  try {
    const res = await fetch(`${tgvBase()}/api/internal/send-invite`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": secret },
      body: JSON.stringify({ to, code, variant: "signup", name, invitedBy }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** "Sign Up · <name>" — the person's name rides in the note (invite_codes has no name column). */
const noteFor = (name: string, extra: string | null) => `${NOTE_PREFIX} · ${name}${extra ? ` — ${extra}` : ""}`.slice(0, 500);
const nameFromNote = (note: string | null) => (note ?? "").replace(new RegExp(`^${NOTE_PREFIX} · `), "").split(" — ")[0] || null;

export async function GET(req: NextRequest) {
  const me = await requireAuth(req);
  if (!me?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = await resolveAdminActorId(me.username);
  if (!actor) return NextResponse.json({ ok: true, signups: [] });
  const res = await db.execute(sql`
    select c.id, c.code, c.email, c.note, c.active, c.expires_at, c.created_at,
           (select count(*) from invite_redemptions r where r.invite_code_id = c.id)::int as redeemed
      from invite_codes c
     where c.note like ${NOTE_PREFIX + " · %"} and c.created_by = ${actor}::uuid
     order by c.created_at desc
     limit 12
  `);
  const now = Date.now();
  const rows = (res.rows as { id: string; code: string; email: string | null; note: string | null; active: boolean; expires_at: string | null; created_at: string; redeemed: number }[]).map((r) => ({
    id: r.id,
    email: r.email,
    name: nameFromNote(r.note),
    link: inviteLink(r.code),
    createdAt: r.created_at,
    status: r.redeemed > 0 ? "joined" : !r.active ? "revoked" : r.expires_at && new Date(r.expires_at).getTime() < now ? "expired" : "sent",
  }));
  return NextResponse.json({ ok: true, signups: rows });
}

export async function POST(req: NextRequest) {
  const me = await requireAuth(req);
  if (!me?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Every sign-up is attributed in the audit log, so the caller must resolve to a staff member record.
  const actorUserId = await resolveAdminActorId(me.username);
  if (!actorUserId) return NextResponse.json({ error: "no_staff_record" }, { status: 403 });
  const staffName = (me.name ?? "").trim() || me.username;

  const body = (await req.json().catch(() => null)) as { action?: string; id?: string; name?: string; email?: string; note?: string } | null;

  if (body?.action === "resend") {
    if (!body.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
    const row = await db.execute(sql`select code, email, note, active from invite_codes where id = ${body.id} and note like ${NOTE_PREFIX + " · %"} limit 1`);
    const r = row.rows[0] as { code: string; email: string | null; note: string | null; active: boolean } | undefined;
    if (!r?.email) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (!r.active) return NextResponse.json({ error: "revoked" }, { status: 409 });
    const emailed = await sendSignupEmail(r.email, r.code, nameFromNote(r.note), staffName);
    await db.insert(schema.adminAuditLog).values({
      actorUserId, action: "signup_invite_resent", targetType: "invite_code", targetId: body.id,
      note: `Sign-up email resent by ${me.username} to ${r.email}${emailed ? "" : " (send failed)"}`,
    });
    return NextResponse.json({ ok: true, emailed, link: inviteLink(r.code) });
  }

  const name = (body?.name ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  const email = (body?.email ?? "").trim().toLowerCase();
  if (!name) return NextResponse.json({ error: "missing_name" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) return NextResponse.json({ error: "invalid_email" }, { status: 400 });

  // Already a member → nothing to sign up.
  const existing = await db.execute(sql`select 1 from members where lower(email) = ${email} limit 1`);
  if (existing.rows.length) return NextResponse.json({ error: "already_member" }, { status: 409 });

  // Someone already signed this address up and it is still open → say so instead of minting a second code.
  const open = await db.execute(sql`
    select c.id from invite_codes c
     where lower(c.email) = ${email} and c.active and (c.expires_at is null or c.expires_at > now())
       and not exists (select 1 from invite_redemptions r where r.invite_code_id = c.id)
     order by c.created_at desc limit 1
  `);
  if (open.rows.length) return NextResponse.json({ error: "already_invited", id: (open.rows[0] as { id: string }).id }, { status: 409 });

  const recent = await db.execute(sql`select count(*)::int as n from invite_codes where created_by = ${actorUserId}::uuid and created_at > now() - interval '1 hour'`);
  if (((recent.rows[0] as { n: number } | undefined)?.n ?? 0) >= MAX_PER_HOUR)
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const code = generateInviteCode();
  const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 86_400_000).toISOString();
  const note = noteFor(name, body?.note?.trim() ? `${body.note.trim().slice(0, 300)} (by ${me.username})` : `by ${me.username}`);
  let id: string;
  try {
    const ins = await db.execute(sql`
      insert into invite_codes (code, email, max_uses, expires_at, note, created_by)
      values (${code}, ${email}, 1, ${expiresAt}, ${note}, ${actorUserId})
      returning id
    `);
    id = (ins.rows[0] as { id: string }).id;
  } catch {
    return NextResponse.json({ error: "could_not_create" }, { status: 500 });
  }

  const emailed = await sendSignupEmail(email, code, name, staffName);
  await db.insert(schema.adminAuditLog).values({
    actorUserId, action: "signup_invite_created", targetType: "invite_code", targetId: id,
    after: { email, name, expiresAt },
    note: `${name} <${email}> signed up by ${me.username}${emailed ? "" : " (email not sent)"}`,
  });

  return NextResponse.json({ ok: true, id, emailed, link: inviteLink(code), expiresAt });
}

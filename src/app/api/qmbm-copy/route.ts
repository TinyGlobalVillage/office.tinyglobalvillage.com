// /api/qmbm-copy — Office's door to the same staff-edited ? bubble wording tgv.com serves
// (public.qmbm_copy, TGV migration 0193; tgv.com's route is the twin). Same shape both sides, so the
// shared InfoBubble asks its own origin and never knows which app it is in. Writes: Office admins
// (the roster's refusionist + marmar), via requireAdmin.
import { type NextRequest, NextResponse } from "next/server";
import { pgPool } from "@/lib/pg-pool";
import { requireAdmin } from "@/lib/api-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_KEY = 300;
const MAX_TITLE = 200;
const MAX_TEXT = 8000;

export async function GET(req: NextRequest) {
  const [r, gate] = await Promise.all([
    pgPool.query<{ key: string; title: string | null; body: string | null }>(
      "SELECT key, title, body FROM public.qmbm_copy",
    ).catch(() => null),
    requireAdmin(req),
  ]);
  const entries: Record<string, { title: string | null; text: string | null }> = {};
  for (const row of r?.rows ?? []) entries[row.key] = { title: row.title, text: row.body };
  return NextResponse.json({ entries, canEdit: !(gate instanceof NextResponse) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const b = (await req.json().catch(() => ({}))) as { key?: unknown; title?: unknown; text?: unknown };
  const key = typeof b.key === "string" ? b.key.trim() : "";
  if (!key || key.length > MAX_KEY) return NextResponse.json({ error: "bad_key" }, { status: 400 });
  const title = typeof b.title === "string" ? b.title.trim().slice(0, MAX_TITLE) : "";
  const text = typeof b.text === "string" ? b.text.trim().slice(0, MAX_TEXT) : "";
  if (!title && !text) {
    await pgPool.query("DELETE FROM public.qmbm_copy WHERE key = $1", [key]);
    return NextResponse.json({ ok: true, cleared: true });
  }
  await pgPool.query(
    `INSERT INTO public.qmbm_copy (key, title, body, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (key) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body,
       updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, title || null, text || null, `office:${gate.username}`],
  );
  return NextResponse.json({ ok: true });
}

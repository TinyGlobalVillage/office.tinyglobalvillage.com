// src/app/api/demo-preview/[id]/heartbeat/route.ts
// POST → keep a preview alive while the operator has the modal open. The reaper
// tears down previews idle > 4 min. Admin-only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { engine, ID_RE } from "@/lib/demo-preview-engine";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    return NextResponse.json(await engine(["heartbeat", "--id", id]));
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

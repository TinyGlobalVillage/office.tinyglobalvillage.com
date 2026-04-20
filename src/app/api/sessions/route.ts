export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { listSessions, createUserSession } from "@/lib/sessions";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  return NextResponse.json({ sessions: listSessions(username) });
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const body = (await req.json().catch(() => null)) as { name?: string; cap?: number | null } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const cap =
    typeof body?.cap === "number" && Number.isFinite(body.cap) && body.cap >= 2 && body.cap <= 50
      ? Math.floor(body.cap)
      : null;

  const session = createUserSession({ name, cap, createdBy: username });
  return NextResponse.json({ ok: true, session });
}

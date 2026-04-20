export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getSession, applyAdminOp, listSessions, type AdminOp } from "@/lib/sessions";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const { id } = await params;

  const session = getSession(id);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Use the list-shaped viewer-projection so hidden invisible members stay hidden.
  const visible = listSessions(username).find(s => s.id === id);
  return NextResponse.json({ session: visible ?? null });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const { id } = await params;

  const op = (await req.json().catch(() => null)) as AdminOp | null;
  if (!op || typeof (op as { op?: unknown }).op !== "string") {
    return NextResponse.json({ error: "Invalid op" }, { status: 400 });
  }

  const result = applyAdminOp(id, username, op);
  if (!result.ok) {
    const status = result.code === "not-found" ? 404 : result.code === "forbidden" ? 403 : 400;
    return NextResponse.json({ error: result.message, code: result.code }, { status });
  }
  return NextResponse.json({ ok: true, session: result.session });
}

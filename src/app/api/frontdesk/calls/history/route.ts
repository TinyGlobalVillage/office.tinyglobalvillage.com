import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { listCalls, deleteCall, deleteAllCalls } from "@/lib/frontdesk/calls";

const EXEC_USERNAMES = new Set(["admin", "marmar"]);

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") ?? "200", 10) || 200));
  const username = token.username ?? "";
  const isExec = EXEC_USERNAMES.has(username);
  const all = listCalls(limit);
  // Non-execs see only calls they handled (placed outbound or picked up inbound).
  const calls = isExec ? all : all.filter(c => c.answeredBy === username);
  return NextResponse.json({ calls });
}

export async function DELETE(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!EXEC_USERNAMES.has(token.username ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    const ok = deleteCall(id);
    return NextResponse.json({ ok });
  }
  const n = deleteAllCalls();
  return NextResponse.json({ ok: true, deleted: n });
}

// /api/frontdesk/support/[...path] — Office Front Desk "Tickets" tab → tgv.com support desk.
// Catch-all forwards queue-only subpaths (queue, queue/:id, queue/:id/{claim,reply,complete}) over the
// internal seam. Villager routes (ticket/*) are NOT forwarded — and even if they were, tgv.com gates
// those on a member session, not the seam, so they'd 401. requireAdmin + operator→member_user_id live
// in proxySupport.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { proxySupport } from "@/lib/support-proxy";

type Ctx = { params: Promise<{ path: string[] }> };

async function resolvePath(params: Ctx["params"]): Promise<string | null> {
  const { path } = await params;
  // Allowlist: only the staff queue surface is reachable from Office.
  if (!Array.isArray(path) || path[0] !== "queue") return null;
  return path.join("/");
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const path = await resolvePath(params);
  if (!path) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return proxySupport(req, { path, method: "GET" });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const path = await resolvePath(params);
  if (!path) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return proxySupport(req, { path, method: "POST" });
}

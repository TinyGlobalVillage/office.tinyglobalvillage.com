import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const USERS_FILE = path.join(process.cwd(), "data", "users.json");
const WEBHOOK_URL = process.env.TGV_COMPONENT_WEBHOOK_URL || "http://localhost:4003";
const TRIGGER_TOKEN = process.env.TGV_COMPONENT_WEBHOOK_TRIGGER_TOKEN || "";

function isAdmin(username: string | undefined): boolean {
  if (!username) return false;
  try {
    const db = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    return db[username]?.role === "admin";
  } catch { return false; }
}

/**
 * POST /api/sandbox/deploy
 * Body: { components: ["@tgv/ui"], targets?: ["refusionist.com"], preview?: boolean }
 *
 * Admin-only. Proxies to tgv-component-webhook /trigger so the bearer token
 * never leaves the server.
 */
export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(token.username)) return NextResponse.json({ error: "admin only" }, { status: 403 });

  let body: { components?: string[]; targets?: string[]; preview?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  if (!body.components || !body.components.length) {
    return NextResponse.json({ error: "components[] required" }, { status: 400 });
  }
  if (!TRIGGER_TOKEN) {
    return NextResponse.json({ error: "TGV_COMPONENT_WEBHOOK_TRIGGER_TOKEN not configured" }, { status: 500 });
  }

  // Preview mode: not yet implemented downstream; for now we just return the plan
  if (body.preview) {
    return NextResponse.json({ preview: true, plan: { components: body.components, targets: body.targets ?? "all" } });
  }

  const res = await fetch(`${WEBHOOK_URL}/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TRIGGER_TOKEN}` },
    body: JSON.stringify({ components: body.components, targets: body.targets }),
  }).catch((e) => ({ ok: false, status: 502, json: async () => ({ error: e.message }) } as Response));

  if (!res.ok) {
    return NextResponse.json({ error: "webhook unreachable", status: res.status }, { status: 502 });
  }
  const data = await res.json().catch(() => ({}));
  return NextResponse.json({ accepted: true, ...data });
}

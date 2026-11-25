import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getHiddenMenuLinks, setHiddenMenuLinks } from "@/lib/nav-menu-prefs-store";

// The signed-in user's balloon-menu link picks (which links they hid).
export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ hidden: getHiddenMenuLinks(token.username) });
}

export async function PUT(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.hidden)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  return NextResponse.json({ hidden: setHiddenMenuLinks(token.username, body.hidden) });
}

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { listPinsFor, setPin, removePin, type PinMenu } from "@/lib/chat-pins";

const EXEC_TEAM = ["admin", "marmar"];

function parseMenu(v: unknown): PinMenu | null {
  return v === "users" || v === "groups" || v === "both" ? v : null;
}

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  return NextResponse.json({ pins: listPinsFor(username) });
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const body = await req.json().catch(() => null);
  const chatId = typeof body?.chatId === "string" ? body.chatId : "";
  const menu = parseMenu(body?.menu);
  const scope = body?.scope === "global" ? "global" : "user";
  if (!chatId || !menu) {
    return NextResponse.json({ error: "Missing chatId or menu" }, { status: 400 });
  }

  if (scope === "global") {
    if (!EXEC_TEAM.includes(username)) {
      return NextResponse.json({ error: "Only exec can pin globally" }, { status: 403 });
    }
  } else if (menu === "both") {
    return NextResponse.json({ error: "User pins cannot span both menus" }, { status: 400 });
  }

  const pin = setPin({
    chatId,
    userId: scope === "global" ? null : username,
    menu,
    pinnedAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, pin });
}

export async function DELETE(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const chatId = req.nextUrl.searchParams.get("chatId") ?? "";
  const scope = req.nextUrl.searchParams.get("scope") === "global" ? "global" : "user";
  if (!chatId) return NextResponse.json({ error: "Missing chatId" }, { status: 400 });

  if (scope === "global" && !EXEC_TEAM.includes(username)) {
    return NextResponse.json({ error: "Only exec can unpin global pins" }, { status: 403 });
  }

  const removed = removePin(chatId, scope === "global" ? null : username);
  if (!removed) return NextResponse.json({ error: "Pin not found or undeletable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

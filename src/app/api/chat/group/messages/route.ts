import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { readGroupDb, writeGroupDb, type GroupMessage } from "../route";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const groupId = req.nextUrl.searchParams.get("groupId");
  if (!groupId) return NextResponse.json({ error: "Missing groupId" }, { status: 400 });
  const db = readGroupDb();
  const group = db.groups[groupId];
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  if (!group.memberIds.includes(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ messages: db.messages[groupId] ?? [] });
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const body = await req.json().catch(() => null);
  const groupId = typeof body?.groupId === "string" ? body.groupId : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!groupId || !content) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const db = readGroupDb();
  const group = db.groups[groupId];
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  if (!group.memberIds.includes(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const msg: GroupMessage = {
    id: `gm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    groupId,
    from: username,
    content,
    createdAt: new Date().toISOString(),
  };
  if (!db.messages[groupId]) db.messages[groupId] = [];
  db.messages[groupId].push(msg);
  db.messages[groupId] = db.messages[groupId].slice(-500);
  writeGroupDb(db);
  return NextResponse.json({ ok: true, message: msg });
}

export async function PATCH(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const body = await req.json().catch(() => null);
  const groupId = typeof body?.groupId === "string" ? body.groupId : "";
  const id = typeof body?.id === "string" ? body.id : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!groupId || !id || !content) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const db = readGroupDb();
  const group = db.groups[groupId];
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  if (!group.memberIds.includes(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const msg = db.messages[groupId]?.find((m) => m.id === id && m.from === username);
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  msg.content = content;
  msg.editedAt = new Date().toISOString();
  writeGroupDb(db);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const groupId = req.nextUrl.searchParams.get("groupId");
  const id = req.nextUrl.searchParams.get("id");
  if (!groupId || !id) return NextResponse.json({ error: "Missing params" }, { status: 400 });
  const db = readGroupDb();
  const group = db.groups[groupId];
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  if (!group.memberIds.includes(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const list = db.messages[groupId] ?? [];
  const before = list.length;
  db.messages[groupId] = list.filter((m) => !(m.id === id && m.from === username));
  if (db.messages[groupId].length === before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  writeGroupDb(db);
  return NextResponse.json({ ok: true });
}

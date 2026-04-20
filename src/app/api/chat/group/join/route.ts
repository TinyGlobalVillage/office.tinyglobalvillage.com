import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { readGroupDb, writeGroupDb } from "../route";

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const body = await req.json().catch(() => null);
  const groupId = typeof body?.groupId === "string" ? body.groupId : "";
  if (!groupId) return NextResponse.json({ error: "Missing groupId" }, { status: 400 });

  const db = readGroupDb();
  const group = db.groups[groupId];
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  if (group.banned?.includes(username)) {
    return NextResponse.json({ error: "You are banned from this group." }, { status: 403 });
  }
  if (group.memberIds.includes(username)) {
    return NextResponse.json({ ok: true, group });
  }
  if (group.visibility !== "open") {
    return NextResponse.json({ error: "Group is not open to join. Ask an admin for an invite." }, { status: 403 });
  }
  if (group.blockedFromSelfAdd?.includes(username)) {
    return NextResponse.json({ error: "You are blocked from self-joining this group." }, { status: 403 });
  }
  group.memberIds = [...group.memberIds, username];
  writeGroupDb(db);
  return NextResponse.json({ ok: true, group });
}

export async function DELETE(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const groupId = req.nextUrl.searchParams.get("groupId") ?? "";
  if (!groupId) return NextResponse.json({ error: "Missing groupId" }, { status: 400 });

  const db = readGroupDb();
  const group = db.groups[groupId];
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  if (username === group.createdBy) {
    return NextResponse.json({ error: "Creator cannot leave. Delete the group instead." }, { status: 400 });
  }
  group.memberIds = group.memberIds.filter((m) => m !== username);
  group.admins = group.admins.filter((a) => a !== username);
  writeGroupDb(db);
  return NextResponse.json({ ok: true });
}

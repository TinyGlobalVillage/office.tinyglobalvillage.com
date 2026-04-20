import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { readGroupDb, writeGroupDb, type GroupChat } from "../route";

type Patch =
  | { op: "setVisibility"; value: "open" | "restricted" | "invisible" }
  | { op: "rename"; value: string }
  | { op: "addMembers"; usernames: string[] }
  | { op: "removeMembers"; usernames: string[] }
  | { op: "promote"; username: string }
  | { op: "demote"; username: string }
  | { op: "setBlockedFromSelfAdd"; usernames: string[] }
  | { op: "ban"; username: string }
  | { op: "unban"; username: string }
  | { op: "addInvisible"; username: string }
  | { op: "removeInvisible"; username: string }
  | { op: "deleteMessages"; ids: string[] }
  | { op: "truncateMessages" }
  | { op: "deleteGroup" };

function requireGroupAdmin(groupId: string, username: string) {
  const db = readGroupDb();
  const group = db.groups[groupId];
  if (!group) return { error: "Group not found", status: 404 as const, db, group: null };
  if (!group.admins.includes(username)) {
    return { error: "Forbidden", status: 403 as const, db, group: null };
  }
  return { db, group };
}

export async function PATCH(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const body = await req.json().catch(() => null);
  const groupId = typeof body?.groupId === "string" ? body.groupId : "";
  const patch = body?.patch as Patch | undefined;
  if (!groupId || !patch || typeof patch !== "object") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const check = requireGroupAdmin(groupId, username);
  if ("error" in check && check.error) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { db, group } = check;
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  switch (patch.op) {
    case "setVisibility": {
      if (!["open", "restricted", "invisible"].includes(patch.value)) {
        return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
      }
      group.visibility = patch.value;
      break;
    }
    case "rename": {
      const next = patch.value.trim();
      if (!next) return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      group.name = next;
      break;
    }
    case "addMembers": {
      const add = (patch.usernames ?? []).filter((u) => typeof u === "string");
      const banned = new Set(group.banned ?? []);
      const allowed = add.filter((u) => !banned.has(u));
      if (allowed.length !== add.length) {
        return NextResponse.json({ error: "Cannot add banned users" }, { status: 400 });
      }
      group.memberIds = Array.from(new Set([...group.memberIds, ...allowed]));
      break;
    }
    case "removeMembers": {
      const rem = new Set((patch.usernames ?? []).filter((u) => typeof u === "string"));
      rem.delete(group.createdBy);
      group.memberIds = group.memberIds.filter((m) => !rem.has(m));
      group.admins = group.admins.filter((a) => !rem.has(a));
      break;
    }
    case "promote": {
      if (!group.memberIds.includes(patch.username)) {
        return NextResponse.json({ error: "Not a member" }, { status: 400 });
      }
      if (!group.admins.includes(patch.username)) group.admins.push(patch.username);
      break;
    }
    case "demote": {
      if (patch.username === group.createdBy) {
        return NextResponse.json({ error: "Cannot demote creator" }, { status: 400 });
      }
      group.admins = group.admins.filter((a) => a !== patch.username);
      break;
    }
    case "setBlockedFromSelfAdd": {
      const blocked = (patch.usernames ?? []).filter((u) => typeof u === "string");
      group.blockedFromSelfAdd = blocked;
      break;
    }
    case "ban": {
      if (patch.username === group.createdBy) {
        return NextResponse.json({ error: "Cannot ban the creator" }, { status: 400 });
      }
      const banned = new Set(group.banned ?? []);
      banned.add(patch.username);
      group.banned = Array.from(banned);
      // Banned users are also removed from membership / admin.
      group.memberIds = group.memberIds.filter((m) => m !== patch.username);
      group.admins = group.admins.filter((a) => a !== patch.username);
      break;
    }
    case "unban": {
      group.banned = (group.banned ?? []).filter((u) => u !== patch.username);
      break;
    }
    case "addInvisible": {
      if (!group.memberIds.includes(patch.username)) {
        return NextResponse.json({ error: "Not a member" }, { status: 400 });
      }
      const inv = new Set(group.invisible ?? []);
      inv.add(patch.username);
      group.invisible = Array.from(inv);
      break;
    }
    case "removeInvisible": {
      group.invisible = (group.invisible ?? []).filter((u) => u !== patch.username);
      break;
    }
    case "deleteMessages": {
      const ids = new Set((patch.ids ?? []).filter((i) => typeof i === "string"));
      const list = db.messages[groupId] ?? [];
      db.messages[groupId] = list.filter((m) => !ids.has(m.id));
      break;
    }
    case "truncateMessages": {
      db.messages[groupId] = [];
      break;
    }
    case "deleteGroup": {
      delete db.groups[groupId];
      delete db.messages[groupId];
      writeGroupDb(db);
      return NextResponse.json({ ok: true, deleted: true });
    }
    default:
      return NextResponse.json({ error: "Unknown op" }, { status: 400 });
  }

  const updated: GroupChat = group;
  db.groups[groupId] = updated;
  writeGroupDb(db);
  return NextResponse.json({ ok: true, group: updated });
}

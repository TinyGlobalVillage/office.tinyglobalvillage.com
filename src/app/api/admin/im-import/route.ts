// POST /api/admin/im-import            → DRY RUN: do the whole move, report it, roll it back.
// POST /api/admin/im-import?commit=1   → do it for real.
//
// The one-time move of Office's file-backed chat (data/*.json) into the shared messenger's tables.
// Admin only. Safe to run twice: a message that was already moved is skipped, so a second run
// reports zero added. The JSON files are read, never written — they stay as the fallback copy.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { importOfficeChat, type ImportReport, type OfficeChatExport } from "@tgv/module-tim/server";
import { requireAuth } from "@/lib/api-auth";
import { getOfficeRole, readRoster } from "@/lib/member-auth/bridge";
import { readUsers } from "@/lib/users";
import { db } from "@/lib/db-drizzle";
import { pgPool } from "@/lib/pg-pool";

const read = <T,>(file: string, fallback: T): T => {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", file), "utf8")) as T;
  } catch {
    return fallback;
  }
};

class DryRun extends Error {}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  const username = token?.username ?? token?.sub;
  if (!username || getOfficeRole(username) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const commit = req.nextUrl.searchParams.get("commit") === "1";

  // Office username → member id, by the email both stores share.
  const emails: Record<string, string> = {};
  for (const [u, rec] of Object.entries(readUsers())) if (rec?.email) emails[u] = rec.email.toLowerCase();
  for (const [u, rec] of Object.entries(readRoster())) if (rec?.email) emails[u] = rec.email.toLowerCase();
  const wanted = Array.from(new Set(Object.values(emails)));
  const { rows } = await pgPool.query<{ id: string; email: string }>(
    `SELECT m.id, lower(m.email) AS email FROM public.members m WHERE m.deleted_at IS NULL AND lower(m.email) = ANY($1)
     UNION
     SELECT e.member_id, lower(e.email) FROM public.member_emails e
       JOIN public.members m ON m.id = e.member_id AND m.deleted_at IS NULL
      WHERE lower(e.email) = ANY($1)`,
    [wanted],
  );
  const idByEmail = new Map(rows.map((r) => [r.email, r.id]));
  const memberIdByUsername: Record<string, string> = {};
  for (const [u, e] of Object.entries(emails)) {
    const id = idByEmail.get(e);
    if (id) memberIdByUsername[u] = id;
  }

  const groups = read<{ groups?: OfficeChatExport["groups"]; messages?: OfficeChatExport["groupMessages"] }>("group-chats.json", {});
  const data: OfficeChatExport = {
    room: read<{ messages?: OfficeChatExport["room"] }>("chat-messages.json", {}).messages ?? [],
    direct: read<{ threads?: OfficeChatExport["direct"] }>("direct-messages.json", {}).threads ?? {},
    groups: groups.groups ?? {},
    groupMessages: groups.messages ?? {},
    pins: read<{ pins?: OfficeChatExport["pins"] }>("chat-pins.json", {}).pins ?? [],
    clears: read<OfficeChatExport["clears"]>("chat-clears.json", {}),
  };

  let report: ImportReport | null = null;
  try {
    await db.transaction(async (tx) => {
      report = await importOfficeChat(tx, data, memberIdByUsername);
      if (!commit) throw new DryRun();
    });
  } catch (e) {
    if (!(e instanceof DryRun)) {
      return NextResponse.json({ error: "Import failed — nothing was changed", detail: String((e as Error).message ?? e) }, { status: 500 });
    }
  }
  return NextResponse.json({ committed: commit, mapped: Object.keys(memberIdByUsername).sort(), report });
}

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const DM_FILE = path.join(process.cwd(), "data", "direct-messages.json");
const EXEC_TEAM = ["admin", "marmar"];

type DmDb = { threads: Record<string, Array<{ id: string }>> };

function threadKey(a: string, b: string) { return [a, b].sort().join("_"); }

function readDb(): DmDb {
  try {
    if (!fs.existsSync(DM_FILE)) return { threads: {} };
    return JSON.parse(fs.readFileSync(DM_FILE, "utf8"));
  } catch { return { threads: {} }; }
}

function writeDb(db: DmDb) {
  fs.mkdirSync(path.dirname(DM_FILE), { recursive: true });
  fs.writeFileSync(DM_FILE, JSON.stringify(db, null, 2));
}

/**
 * POST — wipe a DM thread for everyone. Exec-only; pairs with "Clear for me"
 * which only sets a per-user cutoff.
 * Body: `{ peer: string }`.
 */
export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  if (!EXEC_TEAM.includes(username)) {
    return NextResponse.json({ error: "Only executive team can wipe DM threads" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const peer = typeof body?.peer === "string" ? body.peer.trim() : "";
  if (!peer) return NextResponse.json({ error: "Missing peer" }, { status: 400 });
  const db = readDb();
  db.threads[threadKey(username, peer)] = [];
  writeDb(db);
  return NextResponse.json({ ok: true });
}

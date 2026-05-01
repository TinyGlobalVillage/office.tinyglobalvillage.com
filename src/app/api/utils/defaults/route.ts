/**
 * /api/utils/defaults
 *
 * Persists per-action default-value overrides for the UTILS page tools.
 * GET — any authed user reads the current overlay (so the form pre-fills
 *       with whatever defaults the admin has set).
 * POST — admin-only. Body: { actionId: string, defaults: Record<string, FieldValue> }
 *        Merges into the JSON file (other actions' defaults left untouched).
 *
 * Storage: data/utils-defaults.json. Shape:
 *   { "<actionId>": { "<fieldKey>": <string | string[]> } }
 *
 * Admins are users with role === "admin" in data/users.json.
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const DEFAULTS_FILE = path.join(process.cwd(), "data", "utils-defaults.json");
const USERS_FILE = path.join(process.cwd(), "data", "users.json");

type FieldValue = string | string[];
type DefaultsOverlay = Record<string, Record<string, FieldValue>>;

function readOverlay(): DefaultsOverlay {
  try {
    return JSON.parse(fs.readFileSync(DEFAULTS_FILE, "utf8")) as DefaultsOverlay;
  } catch {
    return {};
  }
}

function writeOverlay(o: DefaultsOverlay) {
  fs.writeFileSync(DEFAULTS_FILE, JSON.stringify(o, null, 2), "utf8");
}

function isAdmin(username: string): boolean {
  try {
    const db = JSON.parse(fs.readFileSync(USERS_FILE, "utf8")) as Record<string, { role?: string }>;
    return db[username]?.role === "admin";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ overlay: readOverlay() });
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(token.username)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as
    | { actionId?: string; defaults?: Record<string, FieldValue> }
    | null;
  if (!body || typeof body.actionId !== "string" || !body.defaults || typeof body.defaults !== "object") {
    return NextResponse.json({ error: "Invalid body — need {actionId, defaults}" }, { status: 400 });
  }

  const overlay = readOverlay();
  overlay[body.actionId] = { ...(overlay[body.actionId] ?? {}), ...body.defaults };
  writeOverlay(overlay);
  return NextResponse.json({ ok: true, overlay });
}

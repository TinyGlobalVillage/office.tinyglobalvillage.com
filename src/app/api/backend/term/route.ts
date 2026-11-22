// POST /api/backend/term {cwd, cols, rows} — open a terminal (needs the Backend `terminal` grant; cwd must be
// inside the member's folders). → {id}. Stream: GET /api/backend/term/<id>; input: POST /api/backend/term/<id>.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { getBackendCaller, inRoots } from "@/lib/backend/server";
import { openTerm } from "@/lib/backend/terminals";
import { logHardeningAction } from "@/lib/audit-log";
import { realpathSync } from "fs";

const noStore = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const caller = await getBackendCaller();
  if (!caller) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: noStore });
  if (caller === "forbidden" || !caller.grant.terminal) {
    return NextResponse.json({ ok: false, error: "no terminal access" }, { status: 403, headers: noStore });
  }
  const body = (await req.json().catch(() => ({}))) as { cwd?: unknown; cols?: unknown; rows?: unknown };
  let cwd = caller.grant.roots[0];
  if (typeof body.cwd === "string") {
    try {
      cwd = realpathSync(body.cwd);
    } catch {
      return NextResponse.json({ ok: false, error: "folder not found" }, { status: 400, headers: noStore });
    }
  }
  if (!inRoots(cwd, caller.grant.roots)) {
    return NextResponse.json({ ok: false, error: "outside your folders" }, { status: 403, headers: noStore });
  }
  const t = openTerm(caller.memberId, cwd, Number(body.cols) || 120, Number(body.rows) || 32);
  if (t === "too-many") return NextResponse.json({ ok: false, error: "too many terminals open" }, { status: 429, headers: noStore });
  logHardeningAction({ action: "backend.term.open", target: cwd, user: caller.email, success: true, details: { via: "office", id: t.id } });
  return NextResponse.json({ ok: true, id: t.id, cwd }, { headers: noStore });
}

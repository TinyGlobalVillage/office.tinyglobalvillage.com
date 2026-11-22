// POST /api/backend/fs {op, args} — the TGV app's Backend file / search / git calls (cookie or app bearer).
// Ops + fence: src/lib/backend/server.ts → apps/tgv-desktop/remote/tgv_backend.py.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { getBackendCaller, OPS, runHelper } from "@/lib/backend/server";

const noStore = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const caller = await getBackendCaller();
  if (!caller) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: noStore });
  if (caller === "forbidden") return NextResponse.json({ ok: false, error: "no Backend access" }, { status: 403, headers: noStore });
  const body = (await req.json().catch(() => null)) as { op?: unknown; args?: unknown } | null;
  const op = typeof body?.op === "string" ? body.op : "";
  if (!OPS.has(op)) return NextResponse.json({ ok: false, error: "unknown op" }, { status: 400, headers: noStore });
  const args = (body?.args && typeof body.args === "object" ? body.args : {}) as Record<string, unknown>;
  if (op === "git.commit") {
    args.author = `${(caller.name || caller.email.split("@")[0]).replace(/[<>\n]/g, "")} <${caller.email}>`;
  }
  const res = await runHelper(caller, op, args);
  if (op === "roots") res.grant = { writable: caller.grant.writable, terminal: caller.grant.terminal, git: caller.grant.git };
  return NextResponse.json(res, { headers: noStore });
}

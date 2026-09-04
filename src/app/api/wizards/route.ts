// Office Modules → Wizards: list/save the SYSTEM (TGV-wide) wizards.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { wizards, adminCtx, badRequest } from "@/lib/wizards/deps";

export async function GET(req: NextRequest) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json({ wizards: await wizards().list(ctx) });
}

export async function POST(req: NextRequest) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json({ wizard: await wizards().save(ctx, body) });
  } catch (e) {
    return badRequest(e);
  }
}

// The sibling Email Campaigns tile saves with PUT; accept both so neither
// convention is a trap for whoever wires the tenant mount.
export { POST as PUT };

// The tracking half: recent walks of one wizard, newest first.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { wizards, adminCtx } from "@/lib/wizards/deps";

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  const { key } = await params;
  const limit = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 100) || 100));
  return NextResponse.json({ runs: await wizards().runs(ctx, key, limit) });
}

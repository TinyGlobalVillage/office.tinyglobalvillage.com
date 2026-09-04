export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { wizards, adminCtx, badRequest } from "@/lib/wizards/deps";

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  const { key } = await params;
  return NextResponse.json({ wizard: await wizards().get(ctx, key) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  const { key } = await params;
  try {
    return NextResponse.json(await wizards().remove(ctx, key));
  } catch (e) {
    return badRequest(e);
  }
}

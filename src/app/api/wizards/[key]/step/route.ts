// Save ONE step of a wizard — what the board's drag-to-move and the slide editor
// call, so editing a slide never round-trips the other slides.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { wizards, adminCtx, badRequest } from "@/lib/wizards/deps";

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  const { key } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json({ wizard: await wizards().saveStep(ctx, { ...body, key }) });
  } catch (e) {
    return badRequest(e);
  }
}

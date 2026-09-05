// Workbench open: everything the full-screen email editor needs for one campaign.
// ?category=&name= are fallbacks for a brand-new custom campaign (no row yet).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { emailCampaigns, adminCtx } from "@/lib/email-campaigns/deps";

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  const { key } = await params;
  const url = new URL(req.url);
  try {
    return NextResponse.json(
      await emailCampaigns().editorDoc(ctx, key, {
        fallbackCategory: url.searchParams.get("category") ?? undefined,
        fallbackName: url.searchParams.get("name") ?? undefined,
      }),
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "editor_doc_failed" }, { status: 400 });
  }
}

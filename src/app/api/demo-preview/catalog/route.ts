// src/app/api/demo-preview/catalog/route.ts
// GET → previewable packages, their consuming tenants, and prepared recipes.
// Feeds the Demo Mode modal's package/tenant pickers. Admin-only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { engine } from "@/lib/demo-preview-engine";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await engine(["catalog"]));
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// GET /api/editor/shared-templates?status=published|sandbox
//
// Office-local mirror of the TGV /api/user/editor/shared-templates list
// endpoint. Reads from the same shared_templates table over Office's
// Drizzle client. Admin-only — surfaced inside LibraryModal → Component
// Library (SandboxModal with surface="library").
//
// Workshop write actions (POST/PATCH/DELETE/status) are deferred to step
// 2d when the workshop surface gains create/delete/publish UI.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import {
  listSharedTemplatesForStatus,
  type SharedTemplateStatus,
} from "@/lib/db-shared-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isStatus(v: unknown): v is SharedTemplateStatus {
  return v === "sandbox" || v === "published";
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const statusParam = req.nextUrl.searchParams.get("status") ?? "published";
  const status: SharedTemplateStatus = isStatus(statusParam)
    ? statusParam
    : "published";

  try {
    const templates = await listSharedTemplatesForStatus(status);
    return NextResponse.json({ templates });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "List failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

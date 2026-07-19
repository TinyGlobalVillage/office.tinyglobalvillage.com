// GET /api/editor/shared-templates?status=published|sandbox|all
//
// Office-local mirror of the TGV /api/user/editor/shared-templates list
// endpoint. Reads from the same shared_templates table over Office's
// Drizzle client. Admin-only — surfaced inside LibraryModal → Component
// Library (SandboxModal with surface="library") and, since the Template
// Gallery module, at Modules → Template Gallery.
//
// `status=all` backs the gallery's All pill (published = Live, sandbox =
// Drafts). Write actions live on the [templateId] routes.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import {
  listAllSharedTemplates,
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

  try {
    const templates =
      statusParam === "all"
        ? await listAllSharedTemplates()
        : await listSharedTemplatesForStatus(
            isStatus(statusParam) ? statusParam : "published",
          );
    return NextResponse.json({ templates });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "List failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

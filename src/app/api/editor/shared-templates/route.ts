// GET /api/editor/shared-templates?status=published|sandbox|all
//
// Office-local mirror of the TGV /api/user/editor/shared-templates list
// endpoint. Reads from the same shared_templates table over Office's
// Drizzle client. Admin-only — surfaced inside LibraryModal → Component
// Library (SandboxModal with surface="library") and, since the Template
// Gallery module, at Modules → Template Gallery.
//
// `status=all` backs the gallery's All pill (published = Live, sandbox =
// Drafts). Per-template write actions live on the [templateId] routes.
//
// POST /api/editor/shared-templates → "New template" (canon P4).
//
// A template used to be born only as a SNAPSHOT of a page that already existed:
// the studio overlay's Save-to-template. Marthe's authoring loop runs the other
// way — start empty, compose from the ratified library, then decide whether it
// goes Live — so the gallery needs to be able to create the row itself. Born
// `sandbox`, always: publishing is a separate decision on the /status route, and
// an empty template is not one the onboarding wizard should offer anyone.
//
// Office writes it directly, the same as every other action in this module. It
// cannot POST the twin route on tgv.com: that one runs behind tgv.com's own
// passkey session, which a cross-origin fetch from Office does not carry.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { resolveAdminActorId } from "@/lib/admin-actor";
import {
  createSharedTemplate,
  listAllSharedTemplates,
  listSharedTemplatesForStatus,
  listSubmittedTemplates,
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
        : statusParam === "submitted"
          ? await listSubmittedTemplates()
          : await listSharedTemplatesForStatus(
              isStatus(statusParam) ? statusParam : "published",
            );
    return NextResponse.json({ templates });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "List failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) {
    return NextResponse.json({ error: "A template needs a name." }, { status: 400 });
  }

  // Tags arrive as the comma-separated string the operator typed; splitting is
  // the form's job to describe and this route's job to actually do, so the
  // column never stores one string pretending to be a list.
  const tags =
    Array.isArray(body.tags)
      ? body.tags.filter((t): t is string => typeof t === "string")
      : typeof body.tags === "string"
        ? body.tags.split(",")
        : [];

  try {
    const template = await createSharedTemplate({
      label,
      description: typeof body.description === "string" ? body.description : "",
      category: typeof body.category === "string" ? body.category : "",
      tags,
      suggestedSlug: typeof body.suggestedSlug === "string" ? body.suggestedSlug : "",
      suggestedTitle: typeof body.suggestedTitle === "string" ? body.suggestedTitle : "",
      createdBy: await resolveAdminActorId(gate.username),
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

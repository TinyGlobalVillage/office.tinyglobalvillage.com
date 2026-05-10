/**
 * /api/shortener/links/[code]
 *
 * GET    — read one link by code (any authed user; useful for "what is this code?" lookups).
 * PATCH  — update destination / rename code / change expiresAt / tags. Caller must own the link.
 * DELETE — soft-delete. Caller must own the link.
 *
 * Ownership = `createdBy` matches caller. Personal links: caller's username.
 * Org links: any authed Office user can edit/delete shared-bucket links
 * (createdBy = "org:tgv-office"), since the bucket is intentionally shared.
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  deleteLink,
  getLink,
  updateLink,
  type UpdateInput,
} from "@/lib/shortener-store";

const ORG_OWNER = "org:tgv-office";

function ownerKeyForCaller(linkOwner: string, callerUsername: string): string {
  // If the link is in the org bucket, any authed user counts as "owner" of it.
  if (linkOwner === ORG_OWNER) return ORG_OWNER;
  // Otherwise, the only valid caller is the link's actual creator.
  return callerUsername;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const link = getLink(code);
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Personal-context links are private to their creator.
  if (link.createdBy !== ORG_OWNER && link.createdBy !== token.username) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ link });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const existing = getLink(code);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdBy !== ORG_OWNER && existing.createdBy !== token.username) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as UpdateInput | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  try {
    const link = updateLink(code, body, ownerKeyForCaller(existing.createdBy, token.username));
    return NextResponse.json({ link });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const existing = getLink(code);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdBy !== ORG_OWNER && existing.createdBy !== token.username) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    deleteLink(code, ownerKeyForCaller(existing.createdBy, token.username));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Delete failed" }, { status: 400 });
  }
}

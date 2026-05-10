/**
 * /api/qrcodes/[id]
 *
 * GET    — read one QR config (personal: creator only; org: any authed user).
 * PATCH  — update name / text / errorCorrection / transparentBg / linkedShortCode / tags.
 * DELETE — soft-delete.
 *
 * Ownership = `createdBy` matches caller. Personal QR codes private to creator;
 * org-bucket QR codes (createdBy = "org:tgv-office") shared between authed Office users.
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  deleteQRCode,
  getQRCode,
  updateQRCode,
  type UpdateQRInput,
} from "@/lib/qrcodes-store";

const ORG_OWNER = "org:tgv-office";

function ownerKeyForCaller(recordOwner: string, callerUsername: string): string {
  if (recordOwner === ORG_OWNER) return ORG_OWNER;
  return callerUsername;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const qrcode = getQRCode(id);
  if (!qrcode) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (qrcode.createdBy !== ORG_OWNER && qrcode.createdBy !== token.username) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ qrcode });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = getQRCode(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdBy !== ORG_OWNER && existing.createdBy !== token.username) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as UpdateQRInput | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  try {
    const qrcode = updateQRCode(id, body, ownerKeyForCaller(existing.createdBy, token.username));
    return NextResponse.json({ qrcode });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = getQRCode(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdBy !== ORG_OWNER && existing.createdBy !== token.username) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    deleteQRCode(id, ownerKeyForCaller(existing.createdBy, token.username));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Delete failed" }, { status: 400 });
  }
}

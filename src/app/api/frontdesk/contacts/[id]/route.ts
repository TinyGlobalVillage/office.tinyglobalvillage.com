import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getContact, updateContact, deleteContact } from "@/lib/frontdesk/contacts";
import type { Contact, ContactKind } from "@/lib/frontdesk/types";

function parseKind(raw: unknown): ContactKind | undefined {
  return raw === "client" || raw === "employee" ? raw : undefined;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const contact = getContact(id);
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ contact });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const patch: Partial<Omit<Contact, "id" | "createdAt" | "createdBy">> = {};
  if (typeof body.name === "string") patch.name = body.name;
  const kind = parseKind(body.kind);
  if (kind) patch.kind = kind;
  if ("phone" in body) patch.phone = typeof body.phone === "string" ? body.phone : null;
  if ("email" in body) patch.email = typeof body.email === "string" ? body.email : null;
  if ("company" in body) patch.company = typeof body.company === "string" ? body.company : null;
  if (typeof body.notes === "string") patch.notes = body.notes;

  const updated = updateContact(id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ contact: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = deleteContact(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

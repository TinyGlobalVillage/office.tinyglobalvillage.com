import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { listContacts, createContact } from "@/lib/frontdesk/contacts";
import type { ContactKind } from "@/lib/frontdesk/types";

function parseKind(raw: unknown): ContactKind | undefined {
  return raw === "client" || raw === "employee" ? raw : undefined;
}

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const kind = parseKind(url.searchParams.get("kind"));
  const search = url.searchParams.get("search") ?? undefined;
  return NextResponse.json({ contacts: listContacts({ kind, search }) });
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const kind = parseKind(body.kind) ?? "client";

  const contact = createContact({
    kind,
    name,
    phone: typeof body.phone === "string" ? body.phone : null,
    email: typeof body.email === "string" ? body.email : null,
    company: typeof body.company === "string" ? body.company : null,
    notes: typeof body.notes === "string" ? body.notes : "",
    createdBy: username,
  });
  return NextResponse.json({ contact });
}

/**
 * Composed components — groups of atoms built in the Component Composer.
 * GET    → { docs: ComponentDoc[] }
 * POST   { doc } → { doc } (clamped; id minted from the name on first save)
 * DELETE ?id=<id> → { ok }
 * Storage in src/lib/atom-lab/componentStore (index+entry, data/atom-lab/components/).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { deleteDoc, nextId, readDocs, saveDoc } from "@/lib/atom-lab/componentStore";
import {
  clampComponentDoc,
  isValidDocId,
  slugify,
  type ComponentDoc,
} from "@/app/components/sandbox/atom-lab/componentDoc";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const raw = await readDocs();
  const docs: ComponentDoc[] = raw
    .map((d) => {
      const id = (d as { id?: unknown })?.id;
      return typeof id === "string" && isValidDocId(id) ? clampComponentDoc(d, id) : null;
    })
    .filter((d): d is ComponentDoc => d !== null);
  return NextResponse.json({ docs });
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { doc?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const incoming = (body.doc ?? {}) as { id?: unknown; name?: unknown };
  const name = typeof incoming.name === "string" ? incoming.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  // Existing id wins; otherwise mint one from the name (collision-safe).
  const id =
    typeof incoming.id === "string" && isValidDocId(incoming.id)
      ? incoming.id
      : await nextId(slugify(name));

  const doc = clampComponentDoc(body.doc, id);
  doc.updatedBy = token.username ?? token.sub ?? "staff";
  doc.updatedAt = new Date().toISOString();
  await saveDoc(id, doc, doc.name);
  return NextResponse.json({ doc });
}

export async function DELETE(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!isValidDocId(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  return NextResponse.json({ ok: await deleteDoc(id) });
}

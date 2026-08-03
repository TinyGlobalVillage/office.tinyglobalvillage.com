/**
 * Atom Lab saved specs — per-atom styling state edited in the Atomic Editor.
 * GET    → { specs: Record<key, AtomSpec> }
 * POST   { key, spec } → { key, spec } (clamped)
 * DELETE ?key=<key> → { ok } (reset to defaults — client falls back)
 * Storage in src/lib/atom-lab/store (index+entry layout, data/atom-lab/).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { readSpecs, saveSpec, deleteSpec, isValidAtomKey } from "@/lib/atom-lab/store";
import { clampSpec, type AtomSpec } from "@/app/components/sandbox/atom-lab/atomSpec";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const records = await readSpecs();
  const specs: Record<string, AtomSpec> = {};
  for (const rec of records) specs[rec.key] = clampSpec(rec.spec);
  return NextResponse.json({ specs });
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { key?: string; spec?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const key = (body.key ?? "").trim();
  if (!isValidAtomKey(key)) return NextResponse.json({ error: "invalid key" }, { status: 400 });

  const spec = clampSpec(body.spec);
  await saveSpec(key, spec, token.username ?? token.sub ?? "staff");
  return NextResponse.json({ key, spec });
}

export async function DELETE(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!isValidAtomKey(key)) return NextResponse.json({ error: "invalid key" }, { status: 400 });
  const ok = await deleteSpec(key);
  return NextResponse.json({ ok });
}

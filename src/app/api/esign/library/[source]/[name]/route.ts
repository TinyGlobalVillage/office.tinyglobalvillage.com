// /api/esign/library/[source]/[name] — one library PDF.
//   GET    → stream it (the wizard turns the bytes back into a File and stages it).
//   DELETE → remove an uploaded one from the library shelf. Templates ship with the repo and
//            cannot be deleted here.
// Admin-only; source and name are validated and the resolved path is confined to its shelf.
import { type NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { requireAdmin } from "@/lib/api-admin";
import { isSource, removeFromLibrary, resolveEntry } from "@/lib/esign/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ source: string; name: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { source, name } = await ctx.params;
  if (!isSource(source)) return NextResponse.json({ error: "Unknown shelf" }, { status: 400 });
  const file = resolveEntry(source, name);
  if (!file) return NextResponse.json({ error: "Bad document name" }, { status: 400 });

  let buf: Buffer;
  try {
    buf = await readFile(file);
  } catch {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { source, name } = await ctx.params;
  if (source !== "library") return NextResponse.json({ error: "Templates cannot be removed" }, { status: 403 });
  const removed = await removeFromLibrary(name);
  if (!removed) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

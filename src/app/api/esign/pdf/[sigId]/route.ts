// /api/esign/pdf/[sigId] — stream the stored signed PDF for a legal_signatures row.
// The signed PDF is written to disk by tgv.com's webhook ingest under data/legal/signed/…;
// Office reads it (same RCS box, same process user). Admin-only + path-traversal guarded.
import { type NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";
import { getSignatureById } from "@tgv/module-documenso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The signed-PDF store root. Signatures may hold an absolute pdf_ref; we still confirm it
// resolves inside this root before reading (never trust a stored path blindly).
const LEGAL_ROOT = "/srv/refusion-core/data/legal";

export async function GET(req: NextRequest, ctx: { params: Promise<{ sigId: string }> }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { sigId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(sigId)) {
    return NextResponse.json({ error: "Bad signature id" }, { status: 400 });
  }

  const sig = await getSignatureById(db, sigId);
  if (!sig?.pdfRef) return NextResponse.json({ error: "No signed PDF on record" }, { status: 404 });

  const resolved = path.resolve(sig.pdfRef);
  if (resolved !== LEGAL_ROOT && !resolved.startsWith(LEGAL_ROOT + path.sep)) {
    return NextResponse.json({ error: "Refusing path outside the legal store" }, { status: 403 });
  }

  let buf: Buffer;
  try {
    buf = await readFile(resolved);
  } catch {
    return NextResponse.json({ error: "Signed PDF file missing on disk" }, { status: 404 });
  }

  const safeName = `signed-${sigId}.pdf`;
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

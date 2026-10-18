// /api/esign/library — "My Documents" for the New Document wizard.
//   GET  → every PDF on both shelves (repo templates + operator uploads), templates first.
//   POST → keep a PDF from disk on the library shelf (multipart: file [+ title]). Plain file on
//          disk, nothing sent to Documenso — the wizard still stages it and Send is still the
//          only thing that uploads.
// Admin-only, like the rest of the e-sign console.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { addToLibrary, listLibrary, MAX_PDF_BYTES } from "@/lib/esign/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const entries = await listLibrary();
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data (file [+ title])" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing PDF file" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: `PDF must be 1 byte–${MAX_PDF_BYTES / (1024 * 1024)} MB` }, { status: 400 });
  }
  const pdf = Buffer.from(await file.arrayBuffer());
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return NextResponse.json({ error: "That file is not a PDF" }, { status: 400 });
  }
  const title = String(form.get("title") ?? "").trim().slice(0, 120);

  try {
    const entry = await addToLibrary({ pdf, title, originalName: file.name, addedBy: auth.username });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Could not keep the document", detail }, { status: 500 });
  }
}

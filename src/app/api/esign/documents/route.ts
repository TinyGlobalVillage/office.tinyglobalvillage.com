// /api/esign/documents — Office E-Sign document library (origin = 'office').
//
//   GET  → list Office-origin signable docs (+ shareable direct-link URL) + the staff roster
//          (recipient picker source). Admin-only.
//   POST → upload a PDF (multipart: file + title) → create a Documenso direct-link template →
//          register it as an Office legal_documents row. Admin-only.
//
// Reuses the @tgv/module-legal/module-documenso engine wholesale — Office just scopes by origin.
import { type NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";
import {
  isDocumensoConfigured,
  createDirectLinkTemplateFromPdf,
  directLinkUrl,
  listOfficeLegalDocuments,
  createOfficeLegalDocument,
  setDocumensoTemplate,
} from "@tgv/module-documenso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB — matches Documenso practical template limit

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "document";
}

type StaffEntry = { email: string; role: string; terminalAccess?: boolean };

async function readStaff(): Promise<Array<{ username: string; email: string; role: string }>> {
  try {
    const raw = await readFile(path.join(process.cwd(), "data", "office-staff.json"), "utf8");
    const roster = JSON.parse(raw) as Record<string, StaffEntry>;
    return Object.entries(roster)
      .filter(([, v]) => v?.email)
      .map(([username, v]) => ({ username, email: v.email, role: v.role }))
      .sort((a, b) => a.username.localeCompare(b.username));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const [docs, staff] = await Promise.all([listOfficeLegalDocuments(db), readStaff()]);
  const documents = docs.map((d) => ({
    id: d.id,
    title: d.title,
    slug: d.slug,
    version: d.version,
    sendable: Boolean(d.documensoTemplateId && d.documensoDirectToken),
    shareUrl: d.documensoDirectToken ? directLinkUrl(d.documensoDirectToken) : null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
  return NextResponse.json({ ok: true, configured: isDocumensoConfigured(), documents, staff });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  if (!isDocumensoConfigured()) {
    return NextResponse.json({ error: "Documenso not configured (DOCUMENSO_URL + DOCUMENSO_API_KEY)" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data (file + title)" }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim();
  const file = form.get("file");
  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing PDF file" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: `PDF must be 1 byte–${MAX_PDF_BYTES / (1024 * 1024)} MB` }, { status: 400 });
  }

  const pdf = Buffer.from(await file.arrayBuffer());

  // 1) Create the legal_documents row (Office origin).
  const slug = `${slugify(title)}-${Date.now().toString(36)}`;
  const doc = await createOfficeLegalDocument(db, { slug, title });
  if (!doc) return NextResponse.json({ error: "Could not create document row" }, { status: 500 });

  // 2) Upload to Documenso → direct-link template (signature + auto-date field placed for us).
  let templateId: number;
  let token: string;
  try {
    ({ templateId, token } = await createDirectLinkTemplateFromPdf(pdf, title));
  } catch (err) {
    return NextResponse.json(
      { error: `Documenso template creation failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  // 3) Link the template + direct token back onto the row.
  const linked = await setDocumensoTemplate(db, doc.id, templateId, token);

  return NextResponse.json({
    ok: true,
    document: {
      id: doc.id,
      title: doc.title,
      slug: doc.slug,
      version: doc.version,
      sendable: true,
      shareUrl: directLinkUrl(token),
    },
    _ok: Boolean(linked),
  });
}

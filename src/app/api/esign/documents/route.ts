// /api/esign/documents — Office E-Sign document library (origin = 'office').
//
//   GET  → list Office-origin signable docs (+ shareable direct-link URL, kind, and — for
//          multisig — the per-signer roster) + the staff roster (recipient picker source).
//   POST → upload a PDF (multipart: file + title [+ kind + signers]). kind='waiver' (default):
//          create a Documenso direct-link template (one reusable link). kind='multisig':
//          Documenso DOCUMENT flow — named recipients each get their own emailed signing link
//          at upload time (create → recipients → fields → distribute), roster tracked in
//          public.legal_document_signers. Admin-only.
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
  deactivateOfficeLegalDocument,
  getMemberUserByEmail,
  insertLegalSend,
} from "@tgv/module-documenso";
import { createAndDistributeMultisigFromPdf } from "@tgv/module-documenso/server/multisig";
import {
  markLegalDocumentMultisig,
  insertLegalDocumentSigners,
  listLegalDocumentKinds,
  listSignersForDocuments,
  type InsertSignerInput,
} from "@tgv/module-documenso/db/multisig-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB — matches Documenso practical template limit
const MAX_SIGNERS = 10; // field stacking compresses rows; past ~10 the last page gets crowded
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  // Layer on kind (0076) + the signer roster for multisig docs — two bulk queries, no N+1.
  const kindRows = await listLegalDocumentKinds(db, docs.map((d) => d.id));
  const kindById = new Map(kindRows.map((k) => [k.id, k.kind]));
  const multisigIds = docs.filter((d) => kindById.get(d.id) === "multisig").map((d) => d.id);
  const signerRows = await listSignersForDocuments(db, multisigIds);
  const signersByDoc = new Map<string, typeof signerRows>();
  for (const s of signerRows) {
    const list = signersByDoc.get(s.legalDocumentId) ?? [];
    list.push(s);
    signersByDoc.set(s.legalDocumentId, list);
  }

  const documents = docs.map((d) => {
    const kind = kindById.get(d.id) ?? "waiver";
    const signers = (signersByDoc.get(d.id) ?? []).map((s) => ({
      email: s.signerEmail,
      name: s.signerName,
      status: s.status,
      signedAt: s.signedAt,
    }));
    return {
      id: d.id,
      title: d.title,
      slug: d.slug,
      version: d.version,
      kind,
      // multisig docs have no shareable link — they're distributed to named signers at upload
      sendable: kind === "waiver" && Boolean(d.documensoTemplateId && d.documensoDirectToken),
      shareUrl: kind === "waiver" && d.documensoDirectToken ? directLinkUrl(d.documensoDirectToken) : null,
      signers: kind === "multisig" ? signers : undefined,
      signedCount: kind === "multisig" ? signers.filter((s) => s.status === "signed").length : undefined,
      signerCount: kind === "multisig" ? signers.length : undefined,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  });
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

  // kind branch (0076): default waiver; multisig carries a JSON signer roster.
  const kind = String(form.get("kind") ?? "waiver") === "multisig" ? "multisig" : "waiver";
  let signers: Array<{ email: string; name: string | null }> = [];
  if (kind === "multisig") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(form.get("signers") ?? "[]"));
    } catch {
      return NextResponse.json({ error: "signers must be a JSON array" }, { status: 400 });
    }
    const seen = new Set<string>();
    for (const raw of Array.isArray(parsed) ? parsed : []) {
      const email = String((raw as { email?: string })?.email ?? "").trim().toLowerCase();
      const name = String((raw as { name?: string })?.name ?? "").trim() || null;
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json({ error: `Invalid signer email: "${email}"` }, { status: 400 });
      }
      if (seen.has(email)) continue;
      seen.add(email);
      signers.push({ email, name });
    }
    if (!signers.length) {
      return NextResponse.json({ error: "Multi-signature documents need at least one signer" }, { status: 400 });
    }
    if (signers.length > MAX_SIGNERS) {
      return NextResponse.json({ error: `At most ${MAX_SIGNERS} signers per document` }, { status: 400 });
    }
  }

  // 1) Create the legal_documents row (Office origin).
  const slug = `${slugify(title)}-${Date.now().toString(36)}`;
  const doc = await createOfficeLegalDocument(db, { slug, title });
  if (!doc) return NextResponse.json({ error: "Could not create document row" }, { status: 500 });

  // ── multisig: document flow — Documenso emails each named signer their own link NOW ──
  if (kind === "multisig") {
    let result;
    try {
      result = await createAndDistributeMultisigFromPdf(pdf, title, signers, {
        subject: `Please sign: ${title}`,
        message: `${auth.username} has sent you "${title}" to sign electronically. Each signer has their own signature box.`,
      });
    } catch (err) {
      return NextResponse.json(
        { error: `Documenso multisig creation failed: ${err instanceof Error ? err.message : String(err)}` },
        { status: 502 },
      );
    }

    await markLegalDocumentMultisig(db, doc.id, result.documensoDocumentId);

    const recipientByEmail = new Map(result.recipients.map((r) => [r.email, r.recipientId]));
    const signerInputs: InsertSignerInput[] = [];
    for (const [i, s] of signers.entries()) {
      const member = await getMemberUserByEmail(db, s.email).catch(() => null);
      signerInputs.push({
        signerEmail: s.email,
        signerName: s.name,
        signingOrder: i + 1,
        memberUserId: member?.id ?? null,
        documensoRecipientId: recipientByEmail.get(s.email) ?? null,
        status: "sent",
      });
    }
    await insertLegalDocumentSigners(db, doc.id, signerInputs);

    // Outbox rows so the Activity view shows each dispatch (Documenso did the emailing).
    for (const s of signerInputs) {
      await insertLegalSend(db, {
        legalDocumentId: doc.id,
        recipientEmail: s.signerEmail,
        recipientName: s.signerName ?? null,
        recipientMemberUserId: s.memberUserId ?? null,
        sentBy: auth.username,
        channel: "email",
        note: null,
        directToken: null,
      });
    }

    return NextResponse.json({
      ok: true,
      document: {
        id: doc.id,
        title: doc.title,
        slug: doc.slug,
        version: doc.version,
        kind: "multisig",
        sendable: false,
        shareUrl: null,
        signerCount: signers.length,
      },
    });
  }

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
      kind: "waiver",
      sendable: true,
      shareUrl: directLinkUrl(token),
    },
    _ok: Boolean(linked),
  });
}

// DELETE /api/esign/documents?id=<uuid> — soft-delete (deactivate) an Office document so it
// leaves the library, Send picker, and Documents gallery. Signed consent rows (legal_signatures)
// are preserved as an audit record — this hides the doc, it does not erase signatures.
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Missing or invalid document id" }, { status: 400 });
  }
  const removed = await deactivateOfficeLegalDocument(db, id);
  if (!removed) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  return NextResponse.json({ ok: true, id: removed.id });
}

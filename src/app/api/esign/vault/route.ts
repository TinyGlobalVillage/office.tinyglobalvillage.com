// /api/esign/vault — the document library for the "Documents" gallery tile: every uploaded
// Office e-sign document (legal_documents, origin='office', active), with its latest signature
// layered on (signed status + signed-PDF pointer). Read-only, admin-only.
// Download of a signed PDF reuses /api/esign/pdf/[sigId]; delete uses DELETE /api/esign/documents.
import { type NextRequest, NextResponse } from "next/server";
import { statSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";
import { directLinkUrl } from "@tgv/module-documenso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEGAL_ROOT = "/srv/refusion-core/data/legal";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const res = await db.execute(sql`
    SELECT d.id::text              AS "id",
           d.title                 AS "title",
           d.created_at            AS "createdAt",
           d.documenso_direct_token AS "directToken",
           (d.documenso_template_id IS NOT NULL AND d.documenso_direct_token IS NOT NULL) AS "sendable",
           sig.id::text            AS "signatureId",
           sig.signed_at           AS "signedAt",
           sig.pdf_ref             AS "pdfRef",
           sig.signer_name         AS "signerName",
           sig.signer_email        AS "signerEmail"
    FROM public.legal_documents d
    LEFT JOIN LATERAL (
      SELECT id, signed_at, pdf_ref, signer_name, signer_email
      FROM public.legal_signatures g
      WHERE g.legal_document_id = d.id AND g.status <> 'rejected' AND g.revoked_at IS NULL
      ORDER BY g.created_at DESC LIMIT 1
    ) sig ON true
    WHERE d.origin = 'office' AND d.active = true
    ORDER BY d.updated_at DESC
  `);
  const rows = ((res as unknown as { rows?: unknown[] }).rows ?? (res as unknown[])) as Array<{
    id: string; title: string; createdAt: string; directToken: string | null; sendable: boolean;
    signatureId: string | null; signedAt: string | null; pdfRef: string | null;
    signerName: string | null; signerEmail: string | null;
  }>;

  const documents = rows.map((r) => {
    let sizeKb: number | null = null;
    let hasSignedPdf = false;
    if (r.pdfRef) {
      try {
        const resolved = path.resolve(r.pdfRef);
        if (resolved === LEGAL_ROOT || resolved.startsWith(LEGAL_ROOT + path.sep)) {
          sizeKb = Math.max(1, Math.round(statSync(resolved).size / 1024));
          hasSignedPdf = true;
        }
      } catch { /* file missing */ }
    }
    return {
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      sendable: r.sendable,
      shareUrl: r.directToken ? directLinkUrl(r.directToken) : null,
      signed: Boolean(r.signatureId),
      signatureId: r.signatureId,
      signedAt: r.signedAt,
      signerName: r.signerName,
      signerEmail: r.signerEmail,
      hasSignedPdf,
      sizeKb,
    };
  });

  return NextResponse.json({ ok: true, documents });
}

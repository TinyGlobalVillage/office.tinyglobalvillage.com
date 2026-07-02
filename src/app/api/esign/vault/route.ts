// /api/esign/vault — the signed-document vault: every signed PDF stored on disk
// (data/legal/signed/…), enriched from legal_signatures + legal_documents. Read-only, admin-only.
// Feeds the "Documents" gallery tile (a searchable GPG). Download reuses /api/esign/pdf/[sigId].
import { type NextRequest, NextResponse } from "next/server";
import { statSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEGAL_ROOT = "/srv/refusion-core/data/legal";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const res = await db.execute(sql`
    SELECT g.id::text            AS "signatureId",
           g.pdf_ref             AS "pdfRef",
           g.signer_name         AS "signerName",
           g.signer_email        AS "signerEmail",
           g.signed_at           AS "signedAt",
           g.created_at          AS "createdAt",
           COALESCE(d.title, g.doc_slug) AS "title"
    FROM public.legal_signatures g
    LEFT JOIN public.legal_documents d ON d.id = g.legal_document_id
    WHERE g.pdf_ref IS NOT NULL AND g.revoked_at IS NULL AND g.status <> 'rejected'
    ORDER BY g.signed_at DESC NULLS LAST, g.created_at DESC
  `);
  const rows = ((res as unknown as { rows?: unknown[] }).rows ?? (res as unknown[])) as Array<{
    signatureId: string; pdfRef: string; signerName: string | null; signerEmail: string | null;
    signedAt: string | null; createdAt: string; title: string;
  }>;

  const documents = rows.map((r) => {
    let sizeKb: number | null = null;
    let onDisk = false;
    try {
      const resolved = path.resolve(r.pdfRef);
      if (resolved === LEGAL_ROOT || resolved.startsWith(LEGAL_ROOT + path.sep)) {
        sizeKb = Math.max(1, Math.round(statSync(resolved).size / 1024));
        onDisk = true;
      }
    } catch { /* file missing on disk */ }
    return {
      signatureId: r.signatureId,
      title: r.title,
      signerName: r.signerName,
      signerEmail: r.signerEmail,
      signedAt: r.signedAt ?? r.createdAt,
      sizeKb,
      onDisk,
    };
  });

  return NextResponse.json({ ok: true, documents });
}

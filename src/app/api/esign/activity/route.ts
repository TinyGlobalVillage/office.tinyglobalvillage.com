// /api/esign/activity — the Office E-Sign "outbox": every document → recipient dispatch,
// LEFT-JOINed to its signature so each row shows sent → signed status (+ signed-PDF pointer).
// Admin-only.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";
import { listOfficeSends } from "@tgv/module-documenso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const sends = await listOfficeSends(db, 300);
  const rows = sends.map((s) => ({
    id: s.id,
    documentId: s.legalDocumentId,
    docTitle: s.docTitle,
    recipientEmail: s.recipientEmail,
    recipientName: s.recipientName,
    sentBy: s.sentBy,
    channel: s.channel,
    note: s.note,
    sentAt: s.createdAt,
    status: s.signatureStatus ?? "pending",
    signedAt: s.signedAt,
    signatureId: s.signatureId,
    hasSignedPdf: Boolean(s.signaturePdfRef),
  }));
  return NextResponse.json({ ok: true, sends: rows });
}

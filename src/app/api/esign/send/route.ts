// /api/esign/send — dispatch an Office document to one or more recipients for signature.
//
// Transport = "share the direct link" (option A): each recipient gets the Documenso direct-link
// URL (esign.tgv.com/d/{token}); anyone with it can sign with no account. We record one
// legal_sends row per (document → recipient) as the outbox, and (channel = 'email') email them
// the link from the operator's own mailbox. Signature completion still flows through tgv.com's
// existing /api/legal/webhook → legal_signatures; the Activity view LEFT-JOINs the two by email.
//
// Admin-only.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";
import { getAccounts, getAccount, sendEmail } from "@/lib/fastmail";
import {
  getLegalDocumentById,
  getMemberUserByEmail,
  insertLegalSend,
  directLinkUrl,
  type LegalSendChannel,
} from "@tgv/module-documenso";
import { getLegalDocumentKind } from "@tgv/module-documenso/db/multisig-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RecipientInput = { email?: string; name?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function emailHtml(opts: { docTitle: string; url: string; note: string; senderName: string }): string {
  const { docTitle, url, note, senderName } = opts;
  return `<!DOCTYPE html><html><body style="margin:0;background:#0b0b0f;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 28px;color:#e8e8ef">
    <h1 style="font-size:20px;margin:0 0 8px">Please sign: ${esc(docTitle)}</h1>
    <p style="color:rgba(232,232,239,0.7);font-size:14px;line-height:1.5">
      ${esc(senderName)} has sent you a document to sign electronically.
    </p>
    ${note ? `<p style="color:rgba(232,232,239,0.85);font-size:14px;line-height:1.5;border-left:2px solid rgba(120,200,255,0.5);padding-left:12px;margin:16px 0">${esc(note)}</p>` : ""}
    <div style="text-align:center;margin:28px 0">
      <a href="${esc(url)}" style="display:inline-block;background:#3aa0ff;color:#001;padding:12px 28px;border-radius:8px;font-weight:600;text-decoration:none">Review &amp; Sign</a>
    </div>
    <p style="color:rgba(232,232,239,0.4);font-size:12px;word-break:break-all">Or open this link: ${esc(url)}</p>
    <p style="color:rgba(232,232,239,0.25);font-size:11px;margin-top:32px;border-top:1px solid rgba(255,255,255,0.06);padding-top:16px">
      TGV Office · E-Sign · powered by Documenso (esign.tinyglobalvillage.com)
    </p>
  </div>
</body></html>`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const sentBy = auth.username;

  const body = (await req.json().catch(() => ({}))) as {
    documentId?: string;
    recipients?: RecipientInput[];
    note?: string;
    channel?: LegalSendChannel;
  };

  const documentId = String(body.documentId ?? "").trim();
  const channel: LegalSendChannel = body.channel === "link" ? "link" : "email";
  const note = String(body.note ?? "").trim();
  const recipients = Array.isArray(body.recipients) ? body.recipients : [];
  if (!documentId) return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
  if (recipients.length === 0) return NextResponse.json({ error: "No recipients" }, { status: 400 });

  const doc = await getLegalDocumentById(db, documentId);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  // Multisig docs have no shareable link — Documenso emailed each named signer their own
  // link at upload time. There is nothing to (re)send from here.
  const kindRow = await getLegalDocumentKind(db, doc.id);
  if (kindRow?.kind === "multisig") {
    return NextResponse.json(
      { error: "This is a multi-signature document — its named signers each received their own signing link when it was uploaded." },
      { status: 409 },
    );
  }
  if (!doc.documensoDirectToken) {
    return NextResponse.json({ error: "Document has no signing link yet" }, { status: 409 });
  }
  const url = directLinkUrl(doc.documensoDirectToken);

  // Send from the operator's own mailbox when they have one; else fall back to admin.
  const own = getAccounts().find((a) => a.ownerUsername === sentBy && a.token);
  const from = own ?? getAccount("admin");

  const results: Array<{ email: string; ok: boolean; emailed: boolean; error?: string }> = [];
  for (const r of recipients) {
    const email = String(r.email ?? "").trim().toLowerCase();
    const name = String(r.name ?? "").trim() || null;
    if (!EMAIL_RE.test(email)) {
      results.push({ email, ok: false, emailed: false, error: "invalid email" });
      continue;
    }
    // Link this recipient to a member account when one matches (for later attribution).
    const member = await getMemberUserByEmail(db, email).catch(() => null);
    await insertLegalSend(db, {
      legalDocumentId: doc.id,
      recipientEmail: email,
      recipientName: name,
      recipientMemberUserId: member?.id ?? null,
      sentBy,
      channel,
      note: note || null,
      directToken: doc.documensoDirectToken,
    });

    let emailed = false;
    if (channel === "email") {
      if (!from.token) {
        results.push({ email, ok: true, emailed: false, error: "no mailbox token — link recorded, email skipped" });
        continue;
      }
      try {
        await sendEmail(from.token, {
          from: { name: `${sentBy} · TGV Office`, email: from.email },
          to: [{ email, ...(name ? { name } : {}) }],
          subject: `Please sign: ${doc.title}`,
          htmlBody: emailHtml({ docTitle: doc.title, url, note, senderName: sentBy }),
          textBody: `${sentBy} has sent you "${doc.title}" to sign.\n\n${note ? note + "\n\n" : ""}Sign here: ${url}`,
        });
        emailed = true;
      } catch (err) {
        results.push({ email, ok: true, emailed: false, error: err instanceof Error ? err.message : "email failed" });
        continue;
      }
    }
    results.push({ email, ok: true, emailed });
  }

  return NextResponse.json({ ok: true, url, channel, results });
}

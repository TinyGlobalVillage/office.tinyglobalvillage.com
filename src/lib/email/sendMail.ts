// Office's SMTP sender — text + optional HTML, for mail Office originates itself.
//
// Distinct from src/lib/fastmail.ts, which sends THROUGH a staff member's own Fastmail
// account over JMAP (the inbox, a reply from Gio's address). This one is the house
// identity: it authenticates as the platform mailbox and is what an automated message —
// a signing invitation, a notice — goes out as. Same env as every other TGV sender
// (SMTP_HOST/PORT/SECURE/USER/PASS, SUPPORT_FROM_EMAIL for the visible From).
//
// Throws when SMTP isn't configured, so a caller can surface a clean failure instead of
// silently believing it sent something.
import "server-only";
import nodemailer from "nodemailer";

export interface OfficeMailInput {
  to: string | string[];
  subject: string;
  /** Always required — it is what a plain-text client, and most spam filters, read. */
  text: string;
  html?: string;
  /** Display name on the To address (e.g. the signer's own name). */
  toName?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}

function addr(email: string, name?: string): string {
  return name ? `"${name.replace(/"/g, "")}" <${email}>` : email;
}

export async function sendMail(msg: OfficeMailInput): Promise<void> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SUPPORT_FROM_EMAIL ?? process.env.SMTP_FROM ?? user;
  if (!host || !user || !pass || !from) throw new Error("SMTP not configured");
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: (process.env.SMTP_SECURE ?? "false") === "true",
    auth: { user, pass },
  });
  const to = Array.isArray(msg.to)
    ? msg.to.join(", ")
    : addr(msg.to, msg.toName);
  await transporter.sendMail({
    from: `"Tiny Global Village" <${from}>`,
    to,
    subject: msg.subject,
    text: msg.text,
    ...(msg.html ? { html: msg.html } : {}),
    ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
    ...(msg.attachments?.length ? { attachments: msg.attachments } : {}),
  });
}

// Email Campaigns wiring for the Office Modules tile (SYSTEM-scoped, admin-gated).
// Mounts the same @tgv/module-email-campaigns route factory the member Support tab uses —
// here with the shared Office pgPool, nodemailer SMTP, and a system context (tenant_id NULL).
import { NextResponse, type NextRequest } from "next/server";
import { createEmailCampaignsRoutes, type EmailCampaignsContext } from "@tgv/module-email-campaigns/server/routes";
import { pgPool } from "@/lib/pg-pool";
import { requireAdmin } from "@/lib/api-admin";
import nodemailer from "nodemailer";

async function sendMail(args: { to: string; subject: string; html: string }): Promise<void> {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? "465", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({ from: process.env.SMTP_FROM ?? process.env.SMTP_USER, to: args.to, subject: args.subject, html: args.html });
}

let _routes: ReturnType<typeof createEmailCampaignsRoutes> | null = null;
export function emailCampaigns() {
  if (!_routes) _routes = createEmailCampaignsRoutes({ pool: pgPool, sendMail });
  return _routes;
}

/** Operator gate → system-scoped context. Returns the context, or a NextResponse to return as-is
 *  when the caller isn't an admin. */
export async function adminCtx(req: NextRequest): Promise<EmailCampaignsContext | NextResponse> {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  return { scope: "system", tenantId: null, username: gate.username };
}

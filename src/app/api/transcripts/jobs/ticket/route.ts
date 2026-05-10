/**
 * GET /api/transcripts/jobs/ticket
 *
 * Mints a short-lived HMAC ticket the modal can use to POST audio directly
 * to the Cloudflare-bypass subdomain (direct.tinyglobalvillage.com). The
 * cookie auth on this hostname guarantees only the logged-in operator can
 * mint a ticket for their own username; the bypass endpoint then trusts
 * the ticket alone.
 *
 * Response:
 *   { ticket, uploadUrl, expiresAt }
 *
 * The modal uses `uploadUrl` directly — it embeds the ticket in the query
 * string + points at whatever DIRECT_UPLOAD_ORIGIN is configured (or a
 * relative path as fallback). Operators never see the ticket.
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { mintUploadTicket, uploadUrlFor } from "@/lib/upload-ticket";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticket, expiresAt } = mintUploadTicket(token.username);
  const uploadUrl = uploadUrlFor(ticket);
  return NextResponse.json({ ticket, uploadUrl, expiresAt });
}

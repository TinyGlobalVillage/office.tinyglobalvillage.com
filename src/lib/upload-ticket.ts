/**
 * Short-lived HMAC tickets for the Cloudflare-bypass upload subdomain.
 *
 * Why tickets instead of expanding the session cookie's Domain attribute:
 * the auth cookie is intentionally host-only (Domain unset) so it never
 * leaks to neighboring subdomains. Expanding it to `.tinyglobalvillage.com`
 * to make `direct.tinyglobalvillage.com` work would also send it to every
 * other tenant subdomain that shares the parent zone — too broad.
 *
 * Ticket model:
 *   1. Modal calls GET /api/transcripts/jobs/ticket on office.tinyglobalvillage.com
 *      (cookie-authed). Server mints `<base64url(payload)>.<base64url(sig)>`.
 *   2. Modal POSTs the audio to direct.tinyglobalvillage.com/api/transcripts/jobs/
 *      upload-with-ticket?ticket=<...>. Server verifies the HMAC + expiry,
 *      extracts the username, proceeds.
 *
 * Tickets are single-flight by expiry (~5 min) — not single-use. Replay
 * within the window IS possible but harmless: each upload creates a new
 * job entry; replaying just creates a duplicate the operator can dismiss.
 * If we ever need strict single-use we'd add a small server-side nonce
 * cache — punt to v2.
 */

import crypto from "crypto";
import type { TranscriptContext } from "@tgv/module-connect/transcriber/types";

const TICKET_TTL_SEC = 5 * 60;
const SECRET_ENV = "AUTH_SECRET";

export interface UploadTicketPayload {
  /** Operator who minted the ticket. The upload bucket is whatever they
   *  pass with the upload, gated by this username. */
  username: string;
  /** Issued-at, seconds since epoch. */
  iat: number;
  /** Expires-at, seconds since epoch. */
  exp: number;
  /** Random nonce so two tickets minted in the same second don't collide. */
  jti: string;
}

function getSecret(): Buffer {
  const s = process.env[SECRET_ENV];
  if (!s) throw new Error(`${SECRET_ENV} not set — cannot mint upload tickets.`);
  return Buffer.from(s, "utf8");
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function mintUploadTicket(username: string): { ticket: string; expiresAt: number } {
  const now = Math.floor(Date.now() / 1000);
  const payload: UploadTicketPayload = {
    username,
    iat: now,
    exp: now + TICKET_TTL_SEC,
    jti: crypto.randomBytes(8).toString("hex"),
  };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = crypto.createHmac("sha256", getSecret()).update(payloadB64).digest();
  const sigB64 = b64url(sig);
  return { ticket: `${payloadB64}.${sigB64}`, expiresAt: payload.exp * 1000 };
}

export function verifyUploadTicket(ticket: string): UploadTicketPayload {
  const parts = ticket.split(".");
  if (parts.length !== 2) throw new Error("Malformed ticket");
  const [payloadB64, sigB64] = parts;

  const expectedSig = crypto.createHmac("sha256", getSecret()).update(payloadB64).digest();
  const providedSig = b64urlDecode(sigB64);
  if (expectedSig.length !== providedSig.length || !crypto.timingSafeEqual(expectedSig, providedSig)) {
    throw new Error("Bad ticket signature");
  }

  let payload: UploadTicketPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8")) as UploadTicketPayload;
  } catch {
    throw new Error("Malformed ticket payload");
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) {
    throw new Error("Ticket expired");
  }
  if (typeof payload.username !== "string" || !payload.username) {
    throw new Error("Ticket missing username");
  }
  return payload;
}

/**
 * Compute the canonical upload URL for the modal. Picks the direct-bypass
 * subdomain when configured (`DIRECT_UPLOAD_ORIGIN`), else falls back to a
 * relative path so the request still works (going through Cloudflare with
 * the standard body limits).
 */
export function uploadUrlFor(ticket: string): string {
  const base = process.env.DIRECT_UPLOAD_ORIGIN ?? "";
  return `${base}/api/transcripts/jobs/upload-with-ticket?ticket=${encodeURIComponent(ticket)}`;
}

/** Server gate: did the request come in via the bypass subdomain? Set by
 *  the nginx server block on direct.tinyglobalvillage.com. */
export function isBypassRequest(req: Request): boolean {
  return !!req.headers.get("x-tgv-bypass-host");
}

/** Validation guard for the context payload sent alongside the upload. */
export function gateContextForTicket(
  ctx: TranscriptContext,
  ticketUsername: string,
): string | null {
  if (ctx.kind === "user" && ctx.username !== ticketUsername) {
    return "Ticket username does not match upload context.";
  }
  return null;
}

// Sealing for connected mailboxes' credentials (AES-256-GCM), Office side.
//
// Office and tinyglobalvillage.com share the `inbox_accounts` table, so they must
// share the key too: INBOX_CREDENTIALS_SECRET, the same value in both apps. Rows
// sealed with it are marked "v2". (tgv.com's older "v1" rows were sealed with a key
// derived from ITS OWN session secret, which Office does not hold — those read as
// "cannot be opened" here until tgv.com re-seals them, which it does on first read.)
// No shared secret set → Office connects no mailboxes and falls back to its env tokens.
import "server-only";
import crypto from "node:crypto";

function key(): Buffer | null {
  const own = (process.env.INBOX_CREDENTIALS_SECRET ?? "").trim();
  return own.length >= 16 ? crypto.createHash("sha256").update(own, "utf8").digest() : null;
}

export function canSealInbox(): boolean {
  return key() !== null;
}

export function sealInbox(plain: string): string {
  const k = key();
  if (!k) throw new Error("no key to seal mailbox credentials with");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v2", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(".");
}

/** The secret, or null when it cannot be opened (no key, another app's v1 seal, tampered). */
export function openInbox(sealed: string | null | undefined): string | null {
  const k = key();
  if (!k || !sealed) return null;
  const [version, iv, tag, body] = sealed.split(".");
  if (version !== "v2" || !iv || !tag || !body) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "frontdesk");

/**
 * Read a JSON file under `data/frontdesk/`, returning `fallback` when the file
 * is missing or unreadable. Keeps each domain lib's read/write logic tiny.
 */
export function readJson<T>(name: string, fallback: T): T {
  const file = path.join(DATA_DIR, name);
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(name: string, data: T): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(data, null, 2));
}

/**
 * Normalize a phone number / SMS sender identifier to a routable form.
 *
 * Accepts:
 *   - E.164: "+1 (555) 123-4567", "+1234567"
 *   - 10/11-digit US/CA: "5551234567" → "+15551234567"
 *   - 8+ digit international: returned as `+<digits>`
 *   - Short codes (3-6 digits, no leading "+"): returned as the literal
 *     digit string. SMS from Meta / Google / etc. arrives from short codes
 *     like "32665" or "262966" — those aren't real phone numbers, so we keep
 *     them verbatim instead of corrupting them with a +1 prefix.
 *
 * Returns null only if the input has no digits or is total garbage.
 */
export function toE164(raw: string, defaultCountry: "1" = "1"): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digitsOnly = trimmed.replace(/[^\d+]/g, "");
  if (!digitsOnly) return null;
  if (digitsOnly.startsWith("+")) {
    // Already in + form — keep digits, strip any stray +.
    const clean = "+" + digitsOnly.slice(1).replace(/\D/g, "");
    return clean.length >= 5 ? clean : null;
  }
  const digits = digitsOnly.replace(/\D/g, "");
  if (digits.length === 10) return `+${defaultCountry}${digits}`;
  if (digits.length === 11 && digits.startsWith(defaultCountry)) return `+${digits}`;
  if (digits.length >= 3 && digits.length <= 6) return digits; // short code (e.g. Meta 32665)
  if (digits.length >= 7) return `+${digits}`;
  return null;
}

export function isExec(username: string | null | undefined): boolean {
  return username === "admin" || username === "marmar";
}

export function shortId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

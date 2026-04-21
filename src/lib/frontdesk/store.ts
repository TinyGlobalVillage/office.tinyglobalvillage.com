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
 * Normalize a phone number to E.164. Accepts strings like "+1 (555) 123-4567",
 * "5551234567", or "555.123.4567". Defaults country code to `+1` (North America)
 * for 10-digit inputs. Returns null if the result can't be normalized.
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
    return clean.length >= 8 ? clean : null;
  }
  const digits = digitsOnly.replace(/\D/g, "");
  if (digits.length === 10) return `+${defaultCountry}${digits}`;
  if (digits.length === 11 && digits.startsWith(defaultCountry)) return `+${digits}`;
  if (digits.length >= 8) return `+${digits}`;
  return null;
}

export function isExec(username: string | null | undefined): boolean {
  return username === "admin" || username === "marmar";
}

export function shortId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

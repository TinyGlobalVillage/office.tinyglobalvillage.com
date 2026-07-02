/**
 * Phone display/input formatting engine for Front Desk surfaces.
 *
 * Share-ready: pure functions, no tenant identity, no storage. The default
 * region is a parameter (falls back to US/NANP) so a future @tgv/* lift can
 * serve tenants in any country without touching this file.
 *
 * Formatting contract (per operator spec 2026-07-02):
 *   - NANP national:        (555) 555-5555
 *   - NANP E.164:           +1 (555) 555-5555
 *   - Other countries:      auto-detected from the typed +CC prefix and
 *                           formatted to that country's national grouping
 *                           via libphonenumber's AsYouType engine.
 *   - Short internal codes: extensions (10xx, 8001, …) and SMS short codes
 *                           stay verbatim — never wrapped or hyphenated.
 *   - DTMF strings with * or # stay verbatim.
 *
 * The DIALABLE value is always the raw string (digits + leading '+', plus
 * * / # for DTMF); components keep raw state and render the formatted view.
 */

import { AsYouType, type CountryCode } from "libphonenumber-js";

export type PhoneFormatOptions = {
  /** ISO 3166-1 alpha-2 region used for numbers typed without a +CC. */
  defaultCountry?: CountryCode;
};

const DEFAULT_COUNTRY: CountryCode = "US";

/** Max raw length we accept from inputs (matches the dialer's legacy cap). */
export const RAW_PHONE_MAX = 24;

/** Strip a formatted display string back to its dialable raw form. */
export function stripPhoneFormatting(display: string): string {
  return (display ?? "").replace(/[^\d+*#]/g, "").slice(0, RAW_PHONE_MAX);
}

/** Progressive NANP national formatting: 555 → (555) 5 → (555) 555-5555. */
function formatNanpNational(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function isNanpCandidate(digitsAfterPlus: string): boolean {
  return digitsAfterPlus.startsWith("1");
}

/**
 * Format a raw dial string for display while typing. Accepts partial input
 * and always returns something stable to render. Raw = digits, optional
 * leading '+', optional * / # (DTMF).
 */
export function formatPhoneInput(raw: string, opts?: PhoneFormatOptions): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  // DTMF / feature codes — leave verbatim.
  if (/[*#]/.test(value)) return value;

  const defaultCountry = opts?.defaultCountry ?? DEFAULT_COUNTRY;

  if (value.startsWith("+")) {
    const digits = value.slice(1).replace(/\D/g, "");
    if (!digits) return "+";
    if (isNanpCandidate(digits)) {
      const national = digits.slice(1, 11);
      const overflow = digits.slice(11);
      const body = national ? ` ${formatNanpNational(national)}` : "";
      return `+1${body}${overflow ? ` ${overflow}` : ""}`;
    }
    // Non-NANP: let libphonenumber detect the country from the +CC prefix
    // and apply that country's national grouping.
    const formatted = new AsYouType(defaultCountry).input(`+${digits}`);
    return formatted || `+${digits}`;
  }

  const digits = value.replace(/\D/g, "");
  // Extensions (10xx) and short codes — verbatim.
  if (digits.length <= 6) return digits;
  if (digits.length <= 10) return formatNanpNational(digits);
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 ${formatNanpNational(digits.slice(1))}`;
  }
  // 11+ digits without a '+' — not a NANP shape; show the raw digits rather
  // than guessing a country.
  return digits;
}

/**
 * Format a stored value (usually E.164) for read-only display. Falls back to
 * the input verbatim when it isn't a recognizable number.
 */
export function formatPhoneDisplay(
  value: string | null | undefined,
  opts?: PhoneFormatOptions,
): string {
  if (!value) return "";
  return formatPhoneInput(stripPhoneFormatting(value), opts) || value;
}

/**
 * Compute the next RAW value after the user edits a formatted input.
 *
 * Handles the classic backspace trap: deleting a pure formatting character
 * (")", "-", space) leaves the digits unchanged, so reformatting would
 * instantly restore the deleted character. In that case we drop the last
 * digit instead, which is what the user meant.
 */
export function nextRawFromDisplayEdit(
  prevRaw: string,
  nextDisplay: string,
  opts?: PhoneFormatOptions,
): string {
  const nextRaw = stripPhoneFormatting(nextDisplay);
  const prevDisplay = formatPhoneInput(prevRaw, opts);
  if (
    nextRaw === prevRaw &&
    nextDisplay.length < prevDisplay.length &&
    prevRaw.length > 0
  ) {
    return prevRaw.slice(0, -1);
  }
  return nextRaw;
}

/**
 * Office username → Fastmail bearer token.
 *
 * Lives on its own (rather than inside inbox-setup) because callers outside the
 * inbox — the e-sign address picker, for one — need the mapping without pulling
 * @tgv/module-inbox and its boot-time adapter registration along with it.
 *
 * V1 is the static FASTMAIL_TOKEN_<USER> env pair; DB-backed inbox_accounts
 * replaces it when @tgv/module-registry/members is real.
 */
export function tokenForUser(username: string): string | null {
  if (username === "admin") return process.env.FASTMAIL_TOKEN_GIO ?? null;
  if (username === "marmar") return process.env.FASTMAIL_TOKEN_MARMAR ?? null;
  return null;
}

/**
 * Office username → Fastmail *app password* for the protocols a JMAP token can't reach:
 * CalDAV (Calendar), IMAP (Notes) and WebDAV (Files).
 *
 * Fastmail issues app passwords per access type, and "Files (WebDAV)" is a separate
 * type from "Mail, Contacts & Calendars" — so Files may carry its own password in
 * FASTMAIL_FILES_PASSWORD_<USER>; without one it falls back to the main app password.
 * No env var → null → the Calendar / Notes / Files screens show "not connected".
 */
export function appPasswordForUser(username: string, service: "caldav" | "webdav" | "imap" = "caldav"): string | null {
  const who = username === "admin" ? "GIO" : username === "marmar" ? "MARMAR" : null;
  if (!who) return null;
  const main = process.env[`FASTMAIL_APP_PASSWORD_${who}`]?.trim() || null;
  if (service === "webdav") return process.env[`FASTMAIL_FILES_PASSWORD_${who}`]?.trim() || main;
  return main;
}

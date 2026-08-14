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

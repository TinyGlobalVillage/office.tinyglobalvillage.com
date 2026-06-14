// The platform-wide admin_audit_log table requires an `actor_user_id` uuid that
// references the legacy TGV.com `users` table. This helper resolves an Office
// staff username → that users.id at write time, for honest attribution.
//
// Email comes from the CANONICAL office-staff roster (`rosterEmailForUsername`,
// data/office-staff.json) — NOT a hardcoded two-name map — so ANY staff member
// who passes requireAdmin resolves correctly, not just the original gio/marmar.
//
// We cache the lookup in-process per Node worker. If a staff member's row is
// missing or their email changes, the cache miss + re-query will catch up.
import "server-only";
import { pgPool } from "./pg-pool";
import { rosterEmailForUsername } from "./member-auth/bridge";

const cache = new Map<string, string>();

export async function resolveAdminActorId(
  officeUsername: string | null | undefined,
): Promise<string | null> {
  if (!officeUsername) return null;
  const cached = cache.get(officeUsername);
  if (cached) return cached;

  const email = rosterEmailForUsername(officeUsername); // lowercased, roster-backed
  if (!email) return null;

  const { rows } = await pgPool.query<{ id: string }>(
    "SELECT id FROM users WHERE lower(email) = $1 LIMIT 1",
    [email],
  );
  const id = rows[0]?.id;
  if (id) cache.set(officeUsername, id);
  return id ?? null;
}

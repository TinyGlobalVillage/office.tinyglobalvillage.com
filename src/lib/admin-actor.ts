// Office staff identify via NextAuth file-store (USERS array in src/auth.ts),
// but the platform-wide admin_audit_log table requires an `actor_user_id` uuid
// that references the legacy TGV.com `users` table. Both staff members (gio,
// marthe) have rows there with role='admin' — this helper resolves the
// NextAuth session.user.name to the corresponding users.id at write time.
//
// We cache the lookup in-process per Node worker. If a staff member's row is
// missing or their email changes, the cache miss + re-query will catch up.
import "server-only";
import { pgPool } from "./pg-pool";

// Office NextAuth username → legacy users.email. Hardcoded because Office's
// USERS array is itself hardcoded in src/auth.ts; adding staff requires
// touching both places. Username "admin" is the Gio account historically;
// "marmar" is Marthe.
const USERNAME_TO_EMAIL: Record<string, string> = {
  admin: "gio@tinyglobalvillage.com",
  marmar: "marthe@tinyglobalvillage.com",
};

const cache = new Map<string, string>();

export async function resolveAdminActorId(
  officeUsername: string | null | undefined,
): Promise<string | null> {
  if (!officeUsername) return null;
  const cached = cache.get(officeUsername);
  if (cached) return cached;

  const email = USERNAME_TO_EMAIL[officeUsername];
  if (!email) return null;

  const { rows } = await pgPool.query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1 LIMIT 1',
    [email],
  );
  const id = rows[0]?.id;
  if (id) cache.set(officeUsername, id);
  return id ?? null;
}

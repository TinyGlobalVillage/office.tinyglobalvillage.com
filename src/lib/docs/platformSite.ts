// The site Office's Doc Editor files documents under: the platform's own (HQ) site, so the library
// an operator opens here is the SAME one they see in TGV's Editor → Doc Editor while standing on
// HQ. TGV_PLATFORM_SITE_ID pins it outright; otherwise it resolves by domain — the same rule TGV's
// lib/billing/platform.ts uses. Cached for the process lifetime.
import "server-only";
import { pgPool } from "@/lib/pg-pool";

let cached: string | null = null;

export async function resolvePlatformSiteId(): Promise<string | null> {
  if (cached) return cached;
  const pinned = process.env.TGV_PLATFORM_SITE_ID?.trim();
  if (pinned) return (cached = pinned);
  const domain = (process.env.TGV_PLATFORM_SITE_DOMAIN ?? "tinyglobalvillage.com").trim().toLowerCase();
  try {
    const { rows } = await pgPool.query<{ id: string }>(
      "SELECT id FROM villager_sites WHERE lower(domain) = $1 OR lower(subdomain) = $1 LIMIT 1",
      [domain],
    );
    if (rows[0]?.id) cached = String(rows[0].id);
  } catch {
    /* unreachable registry → null → the docs route answers 401, never a wrong site */
  }
  return cached;
}

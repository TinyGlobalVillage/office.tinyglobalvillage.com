// GET /api/hardening/keycloak/status
//
// One-shot snapshot for the Keycloak HCM (E17): container health (loopback
// management port), realm settings (lifetimes + brute-force + SMTP posture),
// flow posture, the realm client list, and the Office-side runtime config.
// Read-only; requires view-realm + view-clients on office-admin-svc.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { kcAdmin, kcAdminConfigured, KC_ISSUER, KC_HEALTH_URL } from "@/lib/keycloak/admin";
import { readKeycloakConfig } from "@/lib/keycloak/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let health: { up: boolean; checks: { name: string; status: string }[] } = {
    up: false,
    checks: [],
  };
  try {
    const res = await fetch(KC_HEALTH_URL, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    const body = (await res.json()) as { status?: string; checks?: { name: string; status: string }[] };
    health = { up: res.ok && body.status === "UP", checks: body.checks ?? [] };
  } catch {
    // container down or management port unreachable — health.up stays false
  }

  if (!kcAdminConfigured || !kcAdmin) {
    return NextResponse.json({
      configured: false,
      issuer: KC_ISSUER,
      health,
      realm: null,
      clients: [],
      config: readKeycloakConfig(),
    });
  }

  const [realm, clients] = await Promise.all([
    kcAdmin.getRealmSettings().catch(() => null),
    kcAdmin.listClients().catch(() => []),
  ]);

  return NextResponse.json({
    configured: true,
    issuer: KC_ISSUER,
    realmName: kcAdmin.realm,
    health,
    realm,
    clients,
    config: readKeycloakConfig(),
  });
}

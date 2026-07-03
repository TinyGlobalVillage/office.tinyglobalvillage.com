// Office's Keycloak Admin REST mount (villager-identity-convergence E17/E18).
//
// Authenticates as `office-admin-svc` — a dedicated service-account client in
// realm tgv with realm-management roles view-realm / manage-realm /
// view-clients / manage-clients / view-users / manage-users (provisioned
// 2026-07-03; broader than tgv.com's `tgv-admin-svc`, which stays users-only).
// Secret lives in office .env.local (KC_ADMIN_CLIENT_ID / KC_ADMIN_CLIENT_SECRET).
//
// Consumers: /api/hardening/keycloak/* (E17 config modal) and the
// Villagers wire-a-client flow (E18). Every mutation is audit-logged by the
// calling route via logHardeningAction("keycloak.…").

import "server-only";
import { createKeycloakAdmin } from "@tgv/module-auth/auth/member-auth";

export const KC_ISSUER =
  process.env.KC_ISSUER ?? "https://id.tinyglobalvillage.com/realms/tgv";

/** Loopback management interface (rcs-stack/keycloak.md §Service) — health
 *  lives here, NOT on the public origin. Office runs on the same box. */
export const KC_HEALTH_URL = "http://127.0.0.1:3012/health/ready";

export const kcAdminConfigured = Boolean(
  process.env.KC_ADMIN_CLIENT_ID && process.env.KC_ADMIN_CLIENT_SECRET,
);

export const kcAdmin = kcAdminConfigured
  ? createKeycloakAdmin({
      issuer: KC_ISSUER,
      clientId: process.env.KC_ADMIN_CLIENT_ID!,
      clientSecret: process.env.KC_ADMIN_CLIENT_SECRET!,
    })
  : null;

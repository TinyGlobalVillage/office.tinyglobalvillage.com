// src/lib/member-auth/oidc.ts
//
// Keycloak OIDC relying-party mount for Office (villager-identity-convergence
// D11). The login CEREMONY lives at id.tinyglobalvillage.com (realm tgv,
// passkey-only, TGV amber theme); sessions stay LOCAL — the shared
// tgv_member_session parent-domain cookie + member_sessions row Office shares
// with tinyglobalvillage.com, so an OIDC login HERE signs the member into
// both apps (and vice versa).
//
// AUTH_IDP is the per-app cutover flag (D9):
//   keycloak → /login redirects to Keycloak; callback mints the local session.
//   local    → the legacy on-site WebAuthn ceremony (break-glass rollback).

import "server-only";
import { createMemberOidc } from "@tgv/module-auth/auth/member-auth";
import { db } from "@/lib/db-drizzle";
import { officeMemberAuth } from "./config";

export const AUTH_IDP: "keycloak" | "local" =
  process.env.AUTH_IDP === "keycloak" ? "keycloak" : "local";

const origin = process.env.WEBAUTHN_ORIGIN ?? "https://office.tinyglobalvillage.com";

export const memberOidc = createMemberOidc({
  db,
  memberAuth: officeMemberAuth,
  issuer: process.env.KC_ISSUER ?? "https://id.tinyglobalvillage.com/realms/tgv",
  clientId: process.env.KC_CLIENT_ID ?? "office.tinyglobalvillage.com",
  clientSecret: process.env.KC_CLIENT_SECRET ?? "",
  // Office has NO trailingSlash — the unslashed callback is canonical here.
  redirectUri: `${origin}/api/auth/oidc/callback`,
  postLogoutRedirectUri: `${origin}/`,
});

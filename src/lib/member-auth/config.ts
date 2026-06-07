// Office's member-auth instance — Office-specific config for the shared
// @tgv/module-auth factory. RP ID is office.tinyglobalvillage.com (Office keeps
// its own host-only session cookie, separate from tinyglobalvillage.com).
//
// Reuses Office's existing tgv_db Drizzle client (lib/db-drizzle) — the same
// shared member_* tables tinyglobalvillage.com uses. Office staff live in
// member_users (model A: one identity per human, role-scoped), so an operator
// who is also a customer (e.g. refusionist) is a single member_users row.
//
// This is mounted but NOT yet wired into the live auth flow — the central
// helpers (requireAuth/getAuthToken/requireAdmin/proxy) bridge to it in the
// session-swap step, keeping the NextAuth path as a fallback until verified.

import "server-only";
import { createMemberAuth } from "@tgv/module-auth/auth/member-auth";
import { db } from "@/lib/db-drizzle";

export const officeMemberAuth = createMemberAuth({
  db,
  // Shared session cookie with tinyglobalvillage.com for single-sign-on: same
  // name + a parent-domain Domain= so the browser sends it to BOTH office.<host>
  // and <host>. Both apps validate it against the same member_sessions row.
  cookieName: "tgv_member_session",
  cookieDomain: ".tinyglobalvillage.com",
  // RP-ID migration: the auth-options OFFER was flipped to the parent
  // tinyglobalvillage.com (2026-06-05) once both admins enrolled a parent-scoped
  // passkey, so login now surfaces passkeys that work on BOTH apps. LOGIN verify
  // still accepts office.tgv too (loginRpIds) as a safety net for any lingering
  // office-scoped passkey, but the offer no longer surfaces them. Registration
  // binds to the parent (see passkey-register-options/verify). office.tgv can be
  // dropped from loginRpIds once the old office-scoped passkeys are deleted.
  rpId: process.env.WEBAUTHN_RP_ID ?? "office.tinyglobalvillage.com",
  loginRpIds: ["office.tinyglobalvillage.com", "tinyglobalvillage.com"],
  rpName: "TGV Office",
  origin: process.env.WEBAUTHN_ORIGIN ?? "https://office.tinyglobalvillage.com",
  loginPath: "/login",
});

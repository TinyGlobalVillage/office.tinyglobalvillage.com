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
  cookieName: "tgv_office_session",
  rpId: process.env.WEBAUTHN_RP_ID ?? "office.tinyglobalvillage.com",
  rpName: "TGV Office",
  origin: process.env.WEBAUTHN_ORIGIN ?? "https://office.tinyglobalvillage.com",
  loginPath: "/login",
});

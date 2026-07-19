// src/lib/wallet-bridge.ts
// Office → TGV HQ business-wallet bridge (money-keystone, 2026-07-18).
//
// Office surfaces THE BUSINESS wallet (the TGV company money), not a staffer's personal one.
// Per money-keystone locked decision #2 the ledger stays single-writer on tinyglobalvillage.com,
// so Office mounts the shared wallet proxy and forwards every /api/wallet/* call to HQ with
// INTERNAL_API_SECRET + x-wallet-member-id = THE BUSINESS member. HQ's resolveWalletSession turns
// that into the business acting as itself, so every money gate (KYC, payouts_enabled, the
// withdrawal launch gate) applies unchanged — Office gets exactly HQ's money safety.
//
// This deliberately does NOT use HQ's ?ctx=hq seam: that one resolves the business behind the
// `hq.wallet` capability on an HQ browser session, which a server-to-server caller can't present.
// Naming the business member directly is the same destination through the door that's already open.
//
// Operator-gated: only an Office ADMIN gets a member id back. Everyone else (and every
// unauthenticated caller) gets null, which the proxy turns into a 401. Fails closed.
import "server-only";
import { pgPool } from "./pg-pool";
import { getBridgedMember } from "./member-auth/bridge";

// Configurable per build-for-sharing (mirrors HQ's src/lib/hq/business.ts): an explicit
// TGV_BUSINESS_MEMBER_ID wins, else resolve by TGV_BUSINESS_EMAIL. The business identity is
// stable for the process lifetime, so cache the resolved uuid.
let cachedBusinessId: string | null = null;

export async function getBusinessMemberId(): Promise<string | null> {
  if (cachedBusinessId) return cachedBusinessId;

  const envId = process.env.TGV_BUSINESS_MEMBER_ID?.trim();
  if (envId) {
    cachedBusinessId = envId;
    return cachedBusinessId;
  }

  const email = (process.env.TGV_BUSINESS_EMAIL ?? "admin@tinyglobalvillage.com")
    .trim()
    .toLowerCase();
  try {
    const { rows } = await pgPool.query<{ id: string }>(
      "SELECT id FROM members WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1",
      [email],
    );
    if (rows[0]?.id) cachedBusinessId = rows[0].id;
  } catch {
    // members unreachable → null; the proxy 401s rather than guessing at a wallet.
  }
  return cachedBusinessId;
}

/** The TGV business member IF the caller is an Office admin; else null (proxy → 401). */
export async function businessMemberIfOperator(): Promise<string | null> {
  const member = await getBridgedMember();
  if (!member || member.role !== "admin") return null;
  return getBusinessMemberId();
}

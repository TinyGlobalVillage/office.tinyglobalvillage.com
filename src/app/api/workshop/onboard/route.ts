// POST → (re)start onboarding THIS admin's Mac for the authenticated Workshop:
//        gated on an approved accounts.json row for auth.username, issues the
//        one-time token + copy-paste one-liner the wizard displays. Admin-only.
// GET  → wizard poll: registry row + live per-step bootstrap state.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { readAccount, readOnboard, startOnboarding, STEPS } from "@/lib/workshop-onboard";

const OFFICE_URL = process.env.NEXT_PUBLIC_OFFICE_URL ?? "https://office.tinyglobalvillage.com";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const acct = readAccount(auth.username);
  const state = readOnboard(auth.username);
  return NextResponse.json({
    ok: true,
    account: auth.username,
    registered: !!acct,
    approved: !!acct?.approved,
    bootstrappedAt: acct?.bootstrappedAt ?? null,
    webport: acct?.webport ?? null,
    steps: STEPS.map((id) => ({ id, ...(state?.steps[id] ?? { status: "pending" }) })),
    pubkeyInstalled: !!state?.pubkeyInstalled,
    aliasInstalled: !!state?.aliasInstalled,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const acct = readAccount(auth.username);
  if (!acct?.approved) {
    return NextResponse.json(
      { ok: false, error: `"${auth.username}" is not in the approved workshop registry — ask Gio to add you (data/workshop/accounts.json)` },
      { status: 403 },
    );
  }
  const { token } = startOnboarding(auth.username);
  logHardeningAction({ action: "workshop.onboard.start", target: auth.username, user: auth.username, success: true });
  return NextResponse.json({
    ok: true,
    account: auth.username,
    oneliner: `bash <(curl -fsSL "${OFFICE_URL}/api/workshop/onboard/script") --account ${auth.username} --token ${token}`,
  });
}

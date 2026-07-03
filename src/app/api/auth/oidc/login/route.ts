// GET /api/auth/oidc/login — start the Keycloak login (D11).
//
// Sets the signed transaction cookie (state/nonce/PKCE) and redirects to the
// realm's authorization endpoint. `returnTo` must be a same-origin path.
// 404s when the app is running AUTH_IDP=local (break-glass rollback) so the
// legacy ceremony is the only live path.
import { NextRequest, NextResponse } from "next/server";
import { AUTH_IDP, memberOidc } from "@/lib/member-auth/oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (AUTH_IDP !== "keycloak") return new NextResponse(null, { status: 404 });
  const sp = req.nextUrl.searchParams;
  const url = await memberOidc.startLogin({
    returnTo: sp.get("returnTo") ?? undefined,
    prompt: sp.get("prompt") === "login" ? "login" : undefined,
    kcAction: sp.get("kc_action") ?? undefined,
  });
  return NextResponse.redirect(url);
}

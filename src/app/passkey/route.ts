// GET /passkey — the branded direct door to the passkey ceremony (fleet
// affordance, Gio 2026-07-03: "user-domain.com/passkey … go there directly if
// they know they're signed out"). Redirects straight into the OIDC login
// (prompt=login — explicit login always runs the ceremony, fleet canon) and
// lands in the dashboard after. The ceremony itself still runs on the
// identity origin — that binding is what makes one passkey work on every
// site; this route is the memorable entry, not a mask. Office has no [lang]
// segment — this is a flat route.

import { NextResponse } from "next/server";
import { AUTH_IDP, memberOidc } from "@/lib/member-auth/oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (AUTH_IDP !== "keycloak") {
    // Break-glass local mode: the classic login page owns the ceremony.
    return NextResponse.redirect(new URL("/login", memberOidc.appOrigin));
  }
  const url = await memberOidc.startLogin({ returnTo: "/dashboard", prompt: "login" });
  return NextResponse.redirect(url);
}

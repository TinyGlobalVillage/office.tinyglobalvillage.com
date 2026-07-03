// src/app/login/page.tsx
//
// Server gate in front of the Office sign-in surface (Keycloak cutover, D11).
// AUTH_IDP=keycloak → the ceremony lives at id.tinyglobalvillage.com; this
// page forwards straight there (one Keycloak passkey signs the operator into
// Office AND tgv.com via the shared parent-domain session). AUTH_IDP=local
// (break-glass) → the legacy on-site passkey UI, moved unchanged to
// ./LoginClient.tsx.
//
// The ?error guard prevents a redirect loop: the OIDC callback bounces back
// here with an error param — auto-forwarding again against a live SSO cookie
// would loop forever, so the local surface renders the message instead.
import { redirect } from "next/navigation";
import { officeMemberAuth } from "@/lib/member-auth/config";
import { AUTH_IDP } from "@/lib/member-auth/oidc";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

type Search = Promise<{ from?: string; callbackUrl?: string; error?: string; recovery?: string }>;

function safeLocalPath(raw: string | undefined, fallback: string): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const cb = safeLocalPath(sp.callbackUrl ?? sp.from, "/");

  const session = await officeMemberAuth.getActiveSession();
  if (session) redirect(cb);

  // ?recovery=1 renders the LOCAL surface (recovery-code break-glass): the
  // Keycloak passkey page must stay the zero-click default, and Keycloak
  // renders a username form FIRST whenever a form-based alternative sits in
  // the flow (KC behavior, priorities can't override it) — so the recovery
  // path lives app-side until the conditional-LoA branch ships.
  if (AUTH_IDP === "keycloak" && !sp.error && !sp.recovery) {
    // prompt=login (Gio 2026-07-03): an EXPLICIT visit to a site's login —
    // cold landing, or right after a logout — always runs the passkey
    // ceremony, even when a live Keycloak SSO session could sign in
    // silently. Seamless silent SSO stays available on the bare
    // /api/auth/oidc/login endpoint (no prompt param) for dashboard-to-
    // dashboard switching surfaces.
    redirect(`/api/auth/oidc/login?returnTo=${encodeURIComponent(cb)}&prompt=login`);
  }

  return <LoginClient />;
}

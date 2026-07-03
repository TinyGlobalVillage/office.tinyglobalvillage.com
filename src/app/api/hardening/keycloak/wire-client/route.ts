// GET/POST /api/hardening/keycloak/wire-client — E18.
//
// The operator-shaped version of Group D's manual per-site kcadm steps:
// provision a tenant app as an OIDC relying-party in realm tgv.
//
//   GET  → candidate scan: every dir under /srv/refusion-core/clients/ with a
//          .env.local, cross-referenced against the realm's client list.
//   POST → wire one: create the confidential site client (Group D shape,
//          slashed + unslashed callback forms), mint the secret, FILE-DROP it
//          into the tenant's .env.local (KC_ISSUER / KC_CLIENT_ID /
//          KC_CLIENT_SECRET — the secret never travels to the browser), and
//          optionally flip AUTH_IDP=keycloak (default OFF — the cutover flag
//          stays an explicit operator decision, per D9).
//
// Idempotent by skip-and-report: existing KC client → reused; env keys
// already present → left untouched and reported. The operator still runs
// `pm2 reload <app> --update-env` — surfaced in the response's nextSteps.

import { type NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { kcAdmin, KC_ISSUER } from "@/lib/keycloak/admin";

export const dynamic = "force-dynamic";

const CLIENTS_ROOT = "/srv/refusion-core/clients";
const DOMAIN_RE = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/;

/** Deploy-recipe artifact dirs (isolated-worktree builds) look like domains
 *  but must never be offered as wire targets. */
function isDeployArtifact(name: string): boolean {
  return name.endsWith(".deploybuild");
}

function readEnvKeys(envPath: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {
    // unreadable env file → treated as empty
  }
  return out;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!kcAdmin) {
    return NextResponse.json({ error: "KC_ADMIN_* not configured" }, { status: 503 });
  }

  const clients = await kcAdmin.listClients().catch(() => []);
  const byClientId = new Map(clients.map(c => [c.clientId, c]));

  const candidates: {
    domain: string;
    authIdp: string | null;
    envHasKcClient: boolean;
    kcClientExists: boolean;
    redirectUris: string[];
  }[] = [];

  for (const entry of fs.readdirSync(CLIENTS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || !DOMAIN_RE.test(entry.name) || isDeployArtifact(entry.name)) continue;
    const envPath = path.join(CLIENTS_ROOT, entry.name, ".env.local");
    if (!fs.existsSync(envPath)) continue;
    const env = readEnvKeys(envPath);
    const kc = byClientId.get(entry.name);
    candidates.push({
      domain: entry.name,
      authIdp: env.AUTH_IDP ?? null,
      envHasKcClient: Boolean(env.KC_CLIENT_ID),
      kcClientExists: Boolean(kc),
      redirectUris: kc?.redirectUris ?? [],
    });
  }
  candidates.sort((a, b) => a.domain.localeCompare(b.domain));
  return NextResponse.json({ candidates });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!kcAdmin) {
    return NextResponse.json({ error: "KC_ADMIN_* not configured" }, { status: 503 });
  }

  let body: { domain?: string; includeLoginRedirect?: boolean; setAuthIdp?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const domain = body.domain?.trim().toLowerCase() ?? "";
  const includeLoginRedirect = body.includeLoginRedirect !== false;
  const setAuthIdp = body.setAuthIdp === true;

  // The domain doubles as the directory name — regex + a real-dir check keep
  // the env write inside CLIENTS_ROOT (no separators / traversal possible).
  if (!DOMAIN_RE.test(domain) || isDeployArtifact(domain)) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }
  const appDir = path.join(CLIENTS_ROOT, domain);
  const envPath = path.join(appDir, ".env.local");
  if (!fs.existsSync(envPath)) {
    return NextResponse.json(
      { error: `No ${domain}/.env.local under clients/ — deploy the app first` },
      { status: 404 },
    );
  }

  const origin = `https://${domain}`;
  const callback = `${origin}/api/auth/oidc/callback`;
  const redirectUris = [
    callback,
    `${callback}/`, // trailingSlash apps redeem the slashed form
    ...(includeLoginRedirect ? [`${origin}/login`, `${origin}/login/`] : []),
  ];

  // 1. KC client — reuse if present, else create in the Group D shape.
  let createdClient = false;
  let client = await kcAdmin.findClientByClientId(domain);
  if (!client) {
    const created = await kcAdmin.createSiteClient({
      clientId: domain,
      description: `Site RP wired from Office E18 by ${auth.username}`,
      redirectUris,
      webOrigins: [origin],
    });
    if (!created.ok) {
      logHardeningAction({
        action: "keycloak.client.wire",
        target: domain,
        user: auth.username,
        success: false,
        details: { step: "createSiteClient", error: created.error },
      });
      return NextResponse.json(
        { error: `Keycloak client create failed: ${created.error}` },
        { status: 502 },
      );
    }
    createdClient = true;
    client = await kcAdmin.findClientByClientId(domain);
  }
  if (!client) {
    return NextResponse.json({ error: "Client vanished after create" }, { status: 502 });
  }

  // 2. Secret — server-side only, straight into the tenant env file.
  const secret = await kcAdmin.getClientSecret(client.id);
  if (!secret) {
    logHardeningAction({
      action: "keycloak.client.wire",
      target: domain,
      user: auth.username,
      success: false,
      details: { step: "getClientSecret", createdClient },
    });
    return NextResponse.json({ error: "Could not obtain client secret" }, { status: 502 });
  }

  // 3. Env file-drop — append-only for missing keys; existing keys are never
  //    overwritten (skip-and-report), except AUTH_IDP when explicitly asked.
  const env = readEnvKeys(envPath);
  const wrote: string[] = [];
  const skipped: string[] = [];
  let appendix = "";
  const want: [string, string][] = [
    ["KC_ISSUER", KC_ISSUER],
    ["KC_CLIENT_ID", domain],
    ["KC_CLIENT_SECRET", secret],
  ];
  for (const [key, value] of want) {
    if (env[key] !== undefined) skipped.push(key);
    else {
      appendix += `${key}=${value}\n`;
      wrote.push(key);
    }
  }
  if (appendix) {
    appendix =
      `\n# Keycloak OIDC relying-party (wired from Office E18, ${new Date().toISOString().slice(0, 10)})\n` +
      appendix;
    fs.appendFileSync(envPath, appendix, "utf8");
  }

  let authIdpSet = false;
  if (setAuthIdp && env.AUTH_IDP !== "keycloak") {
    const raw = fs.readFileSync(envPath, "utf8");
    const updated = /^AUTH_IDP=.*$/m.test(raw)
      ? raw.replace(/^AUTH_IDP=.*$/m, "AUTH_IDP=keycloak")
      : raw + "AUTH_IDP=keycloak\n";
    fs.writeFileSync(envPath, updated, "utf8");
    authIdpSet = true;
  }

  logHardeningAction({
    action: "keycloak.client.wire",
    target: domain,
    user: auth.username,
    success: true,
    details: { createdClient, wroteEnv: wrote, skippedEnv: skipped, authIdpSet, redirectUris },
  });

  return NextResponse.json({
    ok: true,
    domain,
    createdClient,
    redirectUris: client.redirectUris.length ? client.redirectUris : redirectUris,
    wroteEnv: wrote,
    skippedEnv: skipped,
    authIdpSet,
    nextSteps: [
      ...(authIdpSet || env.AUTH_IDP === "keycloak"
        ? []
        : ["Flip AUTH_IDP=keycloak in the tenant .env.local when ready to cut over (D9 flag)"]),
      `pm2 reload ${domain} --update-env`,
    ],
  });
}

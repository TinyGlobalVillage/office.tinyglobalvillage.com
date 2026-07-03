// GET/PUT /api/hardening/keycloak/config
//
// Office-side runtime config for the Keycloak surface (kill-switch +
// enrollment-email return target). File-backed (data/keycloak/
// keycloak-config.json) so changes apply without a restart; PUT is
// audit-logged.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import {
  readKeycloakConfig,
  writeKeycloakConfig,
  type OfficeKeycloakConfig,
} from "@/lib/keycloak/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ config: readKeycloakConfig() });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let body: Partial<OfficeKeycloakConfig>;
  try {
    body = (await req.json()) as Partial<OfficeKeycloakConfig>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof writeKeycloakConfig>[0] = {};
  if (typeof body.realmMutationsEnabled === "boolean") {
    patch.realmMutationsEnabled = body.realmMutationsEnabled;
  }
  if (body.enrollmentEmail && typeof body.enrollmentEmail === "object") {
    const e = body.enrollmentEmail;
    if (
      typeof e.clientId !== "string" ||
      typeof e.redirectUri !== "string" ||
      !/^https:\/\//.test(e.redirectUri) ||
      typeof e.lifespanHours !== "number" ||
      !(e.lifespanHours >= 1 && e.lifespanHours <= 336)
    ) {
      return NextResponse.json({ error: "Invalid enrollmentEmail block" }, { status: 400 });
    }
    patch.enrollmentEmail = {
      clientId: e.clientId.trim(),
      redirectUri: e.redirectUri.trim(),
      lifespanHours: Math.floor(e.lifespanHours),
    };
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const config = writeKeycloakConfig(patch);
  logHardeningAction({
    action: "keycloak.config.update",
    target: "keycloak-config.json",
    user: auth.username,
    success: true,
    details: patch as Record<string, unknown>,
  });
  return NextResponse.json({ ok: true, config });
}

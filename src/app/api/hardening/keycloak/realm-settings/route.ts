// PUT /api/hardening/keycloak/realm-settings
//
// Sparse realm update — session/token lifetimes + brute-force posture ONLY
// (module-auth allowlists the fields; flows/themes/SMTP stay kcadm-only so a
// UI bug can't brick the login flow). Gated by the Office-side
// realmMutationsEnabled kill-switch and audit-logged with before→after values.

import { type NextRequest, NextResponse } from "next/server";
import {
  KC_REALM_MUTABLE_FIELDS,
  type KcRealmMutableField,
} from "@tgv/module-auth/auth/member-auth";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { kcAdmin } from "@/lib/keycloak/admin";
import { readKeycloakConfig } from "@/lib/keycloak/config";

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!kcAdmin) {
    return NextResponse.json({ error: "KC_ADMIN_* not configured" }, { status: 503 });
  }
  if (!readKeycloakConfig().realmMutationsEnabled) {
    return NextResponse.json(
      { error: "Realm mutations are disabled (Office-side kill-switch)" },
      { status: 423 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Partial<Record<KcRealmMutableField, number | boolean>> = {};
  for (const key of KC_REALM_MUTABLE_FIELDS) {
    const v = body[key];
    if (v === undefined) continue;
    if (typeof v === "boolean") {
      patch[key] = v;
    } else if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      patch[key] = Math.floor(v);
    } else {
      return NextResponse.json({ error: `Invalid value for ${key}` }, { status: 400 });
    }
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No mutable fields in body" }, { status: 400 });
  }

  const before = await kcAdmin.getRealmSettings();
  const result = await kcAdmin.updateRealmSettings(patch);
  const after = result.ok ? await kcAdmin.getRealmSettings() : before;

  logHardeningAction({
    action: "keycloak.realm.update",
    target: kcAdmin.realm,
    user: auth.username,
    success: result.ok,
    details: {
      changed: Object.fromEntries(
        result.applied.map(k => [
          k,
          `${(before as Record<string, unknown> | null)?.[k]} → ${(after as Record<string, unknown> | null)?.[k]}`,
        ]),
      ),
    },
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Keycloak rejected the update" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, applied: result.applied, realm: after });
}

// /api/admin/paypal/config — Office operator control for the @tgv/module-paypal faucet killswitch.
//
//   GET → the current config (global killswitch + per-tenant map: enabled + credentials).
//   PUT → toggle the global killswitch, toggle a tenant's enablement, OR upsert a tenant's
//         credentials (label / clientId / hostedButtonId / merchantEmail); write the shared file;
//         audit the change to admin_audit_log.
//
// PayPal enablement is operator/tenant config (an on/off + public credentials), NOT tenant-owned
// money — the money never touches TGV, it goes straight to the tenant's own PayPal. So Office owns
// the file directly (see lib/paypal-config.ts); each host reads the same file. Nothing here is a
// secret (the PayPal client-id is public), so the audit may store the full before/after config.
//
// Gated by requireAdmin; the change is attributed to the operator's legacy users.id.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { resolveAdminActorId } from "@/lib/admin-actor";
import { db, schema } from "@/lib/db-drizzle";
import {
  type PaypalEnablementConfig,
  type PaypalTenantConfig,
  SEED_CONFIG,
  isSafeTenantKey,
  readPaypalConfig,
  readPaypalConfigStrict,
  writePaypalConfig,
} from "@/lib/paypal-config";

export const runtime = "nodejs";

const CRED_FIELDS = ["label", "clientId", "hostedButtonId", "merchantEmail"] as const;

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json({ config: readPaypalConfig() });
}

type PutBody = {
  globalKillswitch?: boolean;
  tenant?: {
    tenantKey: string;
    enabled?: boolean;
    label?: string;
    clientId?: string;
    hostedButtonId?: string;
    merchantEmail?: string;
  };
};

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const actorUserId = await resolveAdminActorId(gate.username);
  if (!actorUserId) return NextResponse.json({ error: "no_actor_for_audit" }, { status: 500 });

  const body = (await req.json().catch(() => null)) as PutBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Read the WRITE baseline strictly: a CORRUPT file aborts (never clobber an unparseable config
  // with seed defaults + a fabricated audit `before`); a MISSING file mutates on the seed registry
  // with audit before=null (don't log the seed as if it were the prior live config).
  const strict = readPaypalConfigStrict();
  if (strict === "corrupt") {
    return NextResponse.json({ error: "config_corrupt" }, { status: 409 });
  }
  const fileExists = strict !== "missing";
  const current = strict === "missing" ? SEED_CONFIG : strict;
  const next: PaypalEnablementConfig = {
    globalKillswitch: current.globalKillswitch,
    perTenant: { ...current.perTenant },
  };

  let action: string | null = null;
  let targetId = "global";
  let note = "";

  if (typeof body.globalKillswitch === "boolean" && body.globalKillswitch !== current.globalKillswitch) {
    next.globalKillswitch = body.globalKillswitch;
    action = body.globalKillswitch ? "paypal.killswitch_on" : "paypal.killswitch_off";
    note = `Global PayPal killswitch ${body.globalKillswitch ? "ENGAGED — every PayPal faucet off" : "released"}`;
  } else if (body.tenant && typeof body.tenant.tenantKey === "string") {
    const key = body.tenant.tenantKey.trim();
    if (!isSafeTenantKey(key)) {
      return NextResponse.json({ error: "invalid_tenant_key" }, { status: 400 });
    }
    targetId = key;
    const cur = next.perTenant[key];

    // Collect any credential fields present in the body (a credentials save).
    const cred: Partial<PaypalTenantConfig> = {};
    for (const f of CRED_FIELDS) {
      const v = body.tenant[f];
      if (typeof v === "string") cred[f] = v.trim();
    }
    const enabledPresent = typeof body.tenant.enabled === "boolean";
    const enabled = body.tenant.enabled === true;

    if (!cur) {
      // New tenant entry (add).
      next.perTenant[key] = { enabled: enabledPresent ? enabled : false, ...cred };
      action = "paypal.tenant_added";
      note = `PayPal faucet added for ${cred.label ?? key}`;
    } else if (enabledPresent && enabled !== cur.enabled && Object.keys(cred).length === 0) {
      // Pure enable/disable toggle.
      next.perTenant[key] = { ...cur, enabled };
      action = enabled ? "paypal.tenant_enabled" : "paypal.tenant_disabled";
      note = `PayPal ${enabled ? "enabled" : "disabled"} for ${cur.label ?? key}`;
    } else if (Object.keys(cred).length > 0 || (enabledPresent && enabled !== cur.enabled)) {
      // Credentials upsert (optionally also flipping enabled in the same save).
      next.perTenant[key] = {
        ...cur,
        ...(enabledPresent ? { enabled } : {}),
        ...cred,
      };
      action = "paypal.tenant_config_updated";
      note = `PayPal config updated for ${cred.label ?? cur.label ?? key}`;
    }
  }

  if (!action) {
    // No recognised/effective change — return current state without writing or auditing.
    return NextResponse.json({ config: current, changed: false });
  }

  writePaypalConfig(next);

  await db.insert(schema.adminAuditLog).values({
    actorUserId,
    action,
    targetType: "paypal_config",
    targetId,
    before: fileExists ? (current as unknown as Record<string, unknown>) : null,
    after: next as unknown as Record<string, unknown>,
    note: `${note}${fileExists ? "" : " (initial config write)"} — by ${gate.username}`,
  });

  return NextResponse.json({ config: next, changed: true });
}

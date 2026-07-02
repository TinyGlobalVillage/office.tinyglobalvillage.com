// src/lib/paypal-config.ts
//
// Office-owned shared config for the @tgv/module-paypal faucet (Villagers → PayPal Faucet tile).
// Office WRITES this JSON; each host READS the same file (via @tgv/module-paypal's isPaypalEnabled,
// or a host-local reader) to honour the operator killswitch with no restart. Same box ⇒ no network
// seam needed. Mirrors lib/studio-config.ts — but PayPal has NO db tables (the money lives entirely
// in the tenant's own PayPal), so there's no `schema` field and no cross-schema GRANT wall.
//
// Keyed by an opaque TENANT KEY — a site slug ("resonantweaver.com") today, a site_id for a
// future TGV-platform tenant. resonantweaver has no `members` row, so the key is NOT a site_id.
import "server-only";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type PaypalTenantConfig = {
  enabled: boolean;
  label?: string;
  /** PayPal SDK client-id (public). */
  clientId?: string;
  /** PayPal hosted-button id. */
  hostedButtonId?: string;
  /** Merchant email — display / receipts only. */
  merchantEmail?: string;
};

export type PaypalEnablementConfig = {
  globalKillswitch: boolean;
  perTenant: Record<string, PaypalTenantConfig>; // keyed by tenant key (site slug or site_id)
};

export const PAYPAL_CONFIG_PATH =
  process.env.PAYPAL_CONFIG_PATH ?? "/srv/refusion-core/data/paypal/paypal-config.json";

// Seed registry — the one PayPal faucet tenant today: Marthe / resonantweaver.com. Seeded ENABLED
// because her PayPal buttons are ALREADY live on her public pages — this config exists so an
// operator can KILL them (or set credentials), not to turn them on. New tenants are added here or
// via the modal's "add tenant" action.
export const SEED_CONFIG: PaypalEnablementConfig = {
  globalKillswitch: false,
  perTenant: {
    "resonantweaver.com": {
      enabled: true,
      label: "resonantweaver.com",
    },
  },
};

export function readPaypalConfig(): PaypalEnablementConfig {
  try {
    const parsed = JSON.parse(readFileSync(PAYPAL_CONFIG_PATH, "utf8")) as Partial<PaypalEnablementConfig>;
    const perTenant =
      parsed.perTenant && typeof parsed.perTenant === "object" && !Array.isArray(parsed.perTenant)
        ? (parsed.perTenant as Record<string, PaypalTenantConfig>)
        : {};
    return { globalKillswitch: parsed.globalKillswitch === true, perTenant };
  } catch {
    // No file yet ⇒ hand back the seed so the console resolves on first open.
    return SEED_CONFIG;
  }
}

/** Strict read for the WRITE path: distinguishes a MISSING file (mutate on the seed, audit before=null)
 *  from a CORRUPT one (abort — never clobber an unparseable config with seed defaults + a fabricated
 *  audit `before`). Reads use readPaypalConfig (seed fallback); only the PUT handler needs this. */
export function readPaypalConfigStrict(): PaypalEnablementConfig | "missing" | "corrupt" {
  let raw: string;
  try {
    raw = readFileSync(PAYPAL_CONFIG_PATH, "utf8");
  } catch {
    return "missing";
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PaypalEnablementConfig>;
    const perTenant =
      parsed.perTenant && typeof parsed.perTenant === "object" && !Array.isArray(parsed.perTenant)
        ? (parsed.perTenant as Record<string, PaypalTenantConfig>)
        : {};
    return { globalKillswitch: parsed.globalKillswitch === true, perTenant };
  } catch {
    return "corrupt";
  }
}

export function writePaypalConfig(cfg: PaypalEnablementConfig): void {
  mkdirSync(dirname(PAYPAL_CONFIG_PATH), { recursive: true });
  writeFileSync(PAYPAL_CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

/** A stable tenant key: a site slug (lowercase host) or a site_id. Loose guard — printable,
 *  no whitespace, reasonable length — since it's a JSON object key, not interpolated into SQL. */
export function isSafeTenantKey(s: string): boolean {
  return typeof s === "string" && /^[A-Za-z0-9._:-]{2,80}$/.test(s);
}

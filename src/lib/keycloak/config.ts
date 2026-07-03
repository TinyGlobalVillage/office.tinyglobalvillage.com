// Office-side runtime config for the Keycloak hardening surface (E17).
//
// Per the Hardening-UTILS rule this is the `data/<feature>/<feature>-config.json`
// tunable file — UI changes take effect without a restart. It holds ONLY
// Office-side knobs; realm truth (lifetimes, brute-force, flows) lives in
// Keycloak itself and is read/written over admin REST.

import fs from "fs";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), "data", "keycloak", "keycloak-config.json");

export type OfficeKeycloakConfig = {
  /** Kill-switch for realm mutations from this surface. When false, the
   *  PUT realm-settings route refuses (read-only posture) — flip it here or
   *  in the UI if an operator should not be able to touch lifetimes. */
  realmMutationsEnabled: boolean;
  /** Where a re-sent enrollment email lands after the user completes the
   *  actions. Must be a redirect URI registered on `clientId` (tgv.com has
   *  /login registered for exactly this — the C8/D12 convention). */
  enrollmentEmail: {
    clientId: string;
    redirectUri: string;
    lifespanHours: number;
  };
  version: number;
  lastUpdated: string | null;
};

export const DEFAULT_KC_CONFIG: OfficeKeycloakConfig = {
  realmMutationsEnabled: true,
  enrollmentEmail: {
    clientId: "tinyglobalvillage.com",
    redirectUri: "https://tinyglobalvillage.com/login",
    lifespanHours: 48,
  },
  version: 1,
  lastUpdated: null,
};

export function readKeycloakConfig(): OfficeKeycloakConfig {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as Partial<OfficeKeycloakConfig>;
    return {
      ...DEFAULT_KC_CONFIG,
      ...raw,
      enrollmentEmail: { ...DEFAULT_KC_CONFIG.enrollmentEmail, ...(raw.enrollmentEmail ?? {}) },
    };
  } catch {
    return { ...DEFAULT_KC_CONFIG };
  }
}

export function writeKeycloakConfig(
  patch: Partial<Pick<OfficeKeycloakConfig, "realmMutationsEnabled" | "enrollmentEmail">>,
): OfficeKeycloakConfig {
  const next: OfficeKeycloakConfig = {
    ...readKeycloakConfig(),
    ...patch,
    ...(patch.enrollmentEmail
      ? { enrollmentEmail: { ...readKeycloakConfig().enrollmentEmail, ...patch.enrollmentEmail } }
      : {}),
    lastUpdated: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

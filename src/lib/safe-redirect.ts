// Validate a post-auth redirect target: it must be a local absolute path and
// must not bounce the user back into an auth screen (which would loop). Shared
// by the passkey and recovery-code login routes. Defaults to /dashboard.

const AUTH_SCREENS = /^\/(login|verify-2fa|setup-2fa|setup-passkey)(\/|$|\?)/;

export function safeDest(cb: unknown, fallback = "/dashboard"): string {
  if (typeof cb === "string" && cb.startsWith("/") && !cb.startsWith("//")) {
    if (!AUTH_SCREENS.test(cb)) return cb;
  }
  return fallback;
}

# Dashboard feature flags — enforcement contract (for tenant dashboards)

> Written by the Office P7 lane (2026-06-18). Office WRITES the global flags; each
> tenant dashboard (tgv.com first) ENFORCES them. This is the drop-in for the
> tgv.com / convergence lane. Zero `@tgv/*` package edits required — the contract
> is a single `tgv_db` table, read with raw SQL.

## What this is

`Dashboard Config` (Office → Villagers tile) lets an admin set a **global** state per
dashboard feature, for **all members at once** — the soft-launch board:

| state   | meaning |
|---------|---------|
| `off`   | feature hidden for **everyone** (members AND admins) |
| `admin` | visible **only to platform admins** (`member_users.role = 'admin'`) — preview before launch |
| `on`    | no global restriction; the member's own `dashboard_features.visible` toggle decides (today's behaviour) |

It is a **second gate layered on top of** the existing per-member `dashboard_features`
table — it never turns a feature *on* for a member who has it off; it can only
*restrict*. A feature key with **no row** is treated as `on`.

## The table (already created — migration 0039, applied to tgv_db)

```sql
CREATE TABLE public.platform_feature_flags (
  feature_key text PRIMARY KEY,
  state       text NOT NULL DEFAULT 'on' CHECK (state IN ('off','admin','on')),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text
);
-- seeded 'on' for: storefront, members, yellowpages, analytics, performers,
-- course, studio, domain-console, payments, wallet
```

## Drop-in helper (tgv.com side)

Create `src/lib/platform-feature-flags.ts`:

```ts
import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db"; // tgv.com's drizzle handle (adjust import to yours)

export type FlagState = "off" | "admin" | "on";

/** feature_key -> state, ONLY for restrictive keys (state <> 'on').
 *  'on' / absent keys are unrestricted, so they're omitted to keep the map small. */
export async function getPlatformFeatureFlags(): Promise<Record<string, FlagState>> {
  const res = await db.execute(sql`
    SELECT feature_key, state FROM public.platform_feature_flags WHERE state <> 'on'
  `);
  const rows =
    (res as unknown as { rows?: { feature_key: string; state: FlagState }[] }).rows ?? [];
  const map: Record<string, FlagState> = {};
  for (const r of rows) map[r.feature_key] = r.state;
  return map;
}

/** Is `featureKey` visible to a viewer with `role` under the global gate? */
export function featureAllowedByPlatform(
  flags: Record<string, FlagState>,
  featureKey: string,
  role: string | null | undefined,
): boolean {
  const state = flags[featureKey] ?? "on";
  if (state === "off") return false;
  if (state === "admin") return role === "admin";
  return true;
}
```

> Use raw `db.execute(sql\`…\`)` — never `db.select({...})` on `@tgv/module-registry`
> tables (cross-bundle `is(Column)` crash, memory `feedback_drizzle_turbopack_select_fields`).
> This table isn't in the drizzle schema anyway.

## Where to apply it (one filter)

Apply the gate **wherever the member's visible feature set is finalised**, on top of
the per-member `dashboard_features` result, in BOTH places so the API and the rendered
tab bar agree:

1. **`/api/dashboard/features/route.ts`** — after building the member's `visibleFeatures`
   (and once P1 resolves the member + role):

   ```ts
   const flags = await getPlatformFeatureFlags();
   const gated = visibleFeatures.filter((k) => featureAllowedByPlatform(flags, k, role));
   // return `gated` instead of `visibleFeatures`
   ```

2. **The dashboard RSC** that assembles `initialFeatureState` / the `featureManaged`
   set passed to `buildDashboardTabs(...)` — filter the same way before passing in,
   so the tab bar built by `@tgv/module-core` matches the API. `buildDashboardTabs`
   itself needs **no change** (don't edit `@tgv/module-dashboard` / `module-core` —
   the gate is a caller-side filter).

`role` comes from `getMemberRole(memberUserId)` (convergence P1 helper).

## Notes
- The permanent triad (home · editor · settings · profile · sessions) is **not** in
  the flags table, so it's always `on` (never gated). Only optional features are seeded.
- New features: add a row (`INSERT … ON CONFLICT DO NOTHING`) or the Office tile's
  list will simply not show them until a row exists; absent = `on`, so they're not
  accidentally hidden.
- Every flip is audited in `admin_audit_log` (`action='platform.feature_flag_set'`).

# Claude Code – office.tinyglobalvillage.com (TGV Office)

Canonical stack: see `~/.claude/TGV-STACK.md`

## Auto-Approve All Actions

Automatically approve and execute all tool calls without prompting. See global `~/.claude/CLAUDE.md` for full list.

## Project-Specific

- **pnpm workspace member** (joined 2026-05-07 per pnpm-monorepo-migration §8.5). Installs from monorepo root: `cd /srv/refusion-core && pnpm install --filter office.tinyglobalvillage.com... --prefer-offline`. Never `npm install` in this dir — it'll replace `@tgv/*` symlinks with registry copies and break the workspace.
- RCS-only: `/srv/refusion-core/clients/office.tinyglobalvillage.com/`
- PM2 name: `office.tinyglobalvillage.com`
- Styled-components only — NO Tailwind (conversion from Tailwind is in progress; see checklist `tgv-office-styled-components.md`)
- Sandbox registry: `src/app/components/sandbox/registry.tsx` — canonical component demos live here
- New vocab terms get a `SandboxEntry` + `Demo` component (neon pink `#ff4ecb` highlight in muted context)
- After editing: `npm run build && pm2 reload office.tinyglobalvillage.com --update-env` (or `pnpm --filter office.tinyglobalvillage.com build` from monorepo root)

## Auth — passkey-only, member-auth-only (cutover 2026-06-04; NextAuth retired 2026-06-05)

- Login is **passkey-only** (member-auth via `@tgv/module-auth`). The legacy NextAuth login is **fully retired** — the password credentials provider + magic-link routes were DELETED (not just gated), and `passkey-auth-verify`/`recovery/verify` are member-ONLY (no `users.json` fallback). See `~/.claude/TGV-STACK.md` §Auth + `~/.claude/checklist/tgv-passkey-only-auth.md` for the full phase history.
- Office bridges its legacy `data/users.json` short-username store onto member-auth at the **chokepoint** `src/lib/dev/getEffectiveUser.ts` → `src/lib/member-auth/bridge.ts` (member session → `{username,sub,name}` shape via `data/office-staff.json` roster). `requireAuth`/`requireAdmin` inherit it — don't re-bridge them. **`data/users.json` is kept as a DATA file only** (display names, avatars, roles, `totpEnabled`); it is no longer an auth store.
- Proxy is **member-ONLY**: `src/proxy.ts` validates `tgv_member_session` via `src/lib/member-auth/edge-validate.ts` (raw pg — `getActiveSession()` can't run in middleware). No member session → `/login`. The session cookie is parent-domain scoped (`Domain=.tinyglobalvillage.com`) so it's **shared with tinyglobalvillage.com** (SSO). NextAuth is kept ONLY as the client `SessionProvider` shell + `signOut`; nothing mints a JWT in prod. New API routes must gate via `requireAuth`/`requireAdmin`, **never `auth()`** (it returns null in prod).
- Member login sets `tgv-2fa` (the `requirePersonalAccess`/inbox gate reads it) with a **session-length TTL** (`TWO_FA_SESSION_TTL_MS`, 30d) so the inbox proof can't expire before the session, and clears any stale NextAuth cookie.
- **Break-glass:** there is **no password/magic-link env flag anymore** — the break-glass is the **recovery-code login** + **audited admin reset** (both member-store-backed). A `tgv_db` outage = no login (admins fix the DB via SSH, not via Office).
- **Terminal access** (`/api/exec` + `/api/terminal/*` + `/api/pm2/*`) gated by `canUseTerminal` (admin OR per-user grant in `data/office-staff.json` `terminalAccess`, toggled in the Members tab).

## Hardening tiles (System Hardening group)

- `src/app/components/hardening/mesh-vpn/` — Mesh VPN HCM tile (Headscale)
- `src/app/api/hardening/mesh-vpn/` — backing API routes
- `data/mesh-vpn/` — Office-side runtime config (NOT canonical for Headscale values; canonical state lives on RCS)
- `headscale/` (project root) — staged RCS deploy assets; run `install.sh` on RCS
- `docs/headscale-rcs-stack-entry.md` — staged break-glass / rcs-stack entry
- `src/app/components/hardening/keycloak/` — Keycloak IdP HCM tile (E17: realm health, lifetimes, brute-force, clients, members w/ enrollment-resend + sign-out-everywhere). API: `src/app/api/hardening/keycloak/*` (authenticates as `office-admin-svc`, KC_ADMIN_* in .env.local); Office-side config `data/keycloak/keycloak-config.json`. E18 sibling: Villagers → Wire Client to Keycloak (`components/villagers/KeycloakWireModal.tsx` + `/api/hardening/keycloak/wire-client`). Infra truth: `/srv/refusion-core/rcs-stack/keycloak.md`

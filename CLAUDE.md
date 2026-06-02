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

## Hardening tiles (System Hardening group)

- `src/app/components/hardening/mesh-vpn/` — Mesh VPN HCM tile (Headscale)
- `src/app/api/hardening/mesh-vpn/` — backing API routes
- `data/mesh-vpn/` — Office-side runtime config (NOT canonical for Headscale values; canonical state lives on RCS)
- `headscale/` (project root) — staged RCS deploy assets; run `install.sh` on RCS
- `docs/headscale-rcs-stack-entry.md` — staged break-glass / rcs-stack entry

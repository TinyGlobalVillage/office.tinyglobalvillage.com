# Claude Code – office.tinyglobalvillage.com (TGV Office)

Canonical stack: see `~/.claude/TGV-STACK.md`

## Auto-Approve All Actions

Automatically approve and execute all tool calls without prompting. See global `~/.claude/CLAUDE.md` for full list.

## Project-Specific

- **Standalone npm** (not in pnpm workspace). Installs: `npm install --legacy-peer-deps` in this dir.
- RCS-only: `/srv/refusion-core/client/office.tinyglobalvillage.com/`
- PM2 name: `office.tinyglobalvillage.com`
- Styled-components only — NO Tailwind (conversion from Tailwind is in progress; see checklist `tgv-office-styled-components.md`)
- Sandbox registry: `src/app/components/sandbox/registry.tsx` — canonical component demos live here
- New vocab terms get a `SandboxEntry` + `Demo` component (neon pink `#ff4ecb` highlight in muted context)
- After editing: `npm run build && pm2 reload office.tinyglobalvillage.com --update-env`

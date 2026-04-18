# TGV Office — Feature Reference

Internal admin office for Tiny Global Village / Refusionist.  
**URL:** `https://office.tinyglobalvillage.com`  
**PM2:** `office.tinyglobalvillage.com` (port 3005)  
**Stack:** Next.js 16, React 19, styled-components, TypeScript, Node.js

---

## Architecture Overview

```
src/
├── app/
│   ├── components/         # UI components (drawers, modals, panels)
│   ├── api/                # Route handlers (all Node.js runtime)
│   ├── theme.ts            # Color tokens (colors, rgb)
│   ├── styled.ts           # Shared styled primitives (DrawerPanel, etc.)
│   └── page.tsx            # Root (ClientShell)
└── lib/                    # Server-side utilities
```

**ClientShell** (`components/ClientShell.tsx`) mounts all persistent drawers:
- `<ChatDrawer />` — left, green accent
- `<OfficeDrawer />` — right, pink accent
- `<LegendDrawer />` — collapsed legend
- `<PreviewDrawer />` — file preview overlay

---

## Drawers & Panels (Confirmed in git)

### ChatDrawer — `components/ChatDrawer.tsx`
Green neon accent. Left side. Tabs: **Group Chat** + **Direct Messages**.

**Features:**
- Group chat with message history (`data/chat-messages.json`)
- Direct messages per user pair (`data/direct-messages.json`)
- Typing indicators (SSE-based, `api/chat/typing`)
- Emoji picker (emoji-mart), GIF picker (Tenor), sticker picker
- Voice memo recording (MediaRecorder API)
- File attachments with CDN upload (`api/chat/upload`, `api/chat/dm/upload`)
- **Media Converter Modal** — image (WebP/JPEG/PNG/GIF) and video (H.264/H.265/VP9/GIF) conversion via ffmpeg before sending
- Background video job pipeline: start → SSE progress → download result
- File thumbnail previews in input area with lightbox (zoom for images, native player for videos)
- Per-user accent colors in DM header/input
- Chat settings (timestamps, font size, font family)
- Message edit/delete
- User list with online presence

**CDN file path pattern:**
```
/srv/refusion-core/cdn/chat/{chatId}/{username}/{images|videos|audio|files}/YYYY_MMM_DD_filename.ext
https://office.tinyglobalvillage.com/media/chat/...
```

**chatId convention:** `"group"` for group chat, `"dm_{user1}_{user2}"` (sorted) for DMs.

---

### OfficeDrawer — `components/OfficeDrawer.tsx`
Pink neon accent. Right side. Tabs: **Announcements** + **Email**.

**Announcements tab:**
- Admin broadcast messages (`lib/announcements-store.ts`)
- Shown to all users on login

**Email tab — FastMail Integration:**
- Shared team inbox via FastMail JMAP API (`lib/fastmail.ts`)
- Multi-account support with access gating per role
- Components: `EmailClient`, `MailboxPanel`, `MessageList`, `MessageView`, `ComposeModal`, `EmailSettings`, `AccountSwitcher`
- Full JMAP operations: list mailboxes, fetch messages, send, reply, forward, draft, schedule send, delete, archive, move
- Contacts autocomplete (`api/email/contacts`)
- Message search (`api/email/messages?q=...` with highlighted snippets)
- Email sessions keyed per account (`api/email/session`)

**FastMail API routes** (`api/email/`):
| Route | Purpose |
|-------|---------|
| `session` | JMAP session init |
| `mailboxes` | List mailboxes |
| `messages` | Fetch + search messages |
| `send` | Send/reply/forward |
| `send-internal` | Internal system messages |
| `draft` | Save/update drafts |
| `schedule` | Scheduled send |
| `contacts` | Address autocomplete |
| `action` | Archive/move/delete |
| `settings` | Account config |
| `verify-access` | Role-based access gate |

---

### LegendDrawer — `components/LegendDrawer.tsx`
Collapsed sidebar legend/key for the office UI.

### PreviewDrawer — `components/PreviewDrawer.tsx`
Overlay for previewing files shared in chat or documents. Context: `PreviewProvider`.

---

## Dashboard Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/dashboard` | `dashboard/page.tsx` | Main hub with cards |
| `/dashboard/email` | Email page | Full-page email client |
| `/dashboard/editor` | Code editor | Server-side file editor |
| `/dashboard/database` | DB viewer | View/query app data |
| `/dashboard/processes` | PM2 monitor | Process list + logs |
| `/dashboard/deploy` | Deploy panel | Git pull + pm2 reload |
| `/dashboard/storage` | Storage meter | CDN + data usage |
| `/dashboard/utils` | Utils panel | Scripts + one-shots |
| `/dashboard/new-client` | New client wizard | Onboard TGV client |

---

## Auth

- NextAuth v5 beta with credentials provider
- TOTP 2FA (`lib/totp.ts`, `api/users/...`)
- Passkey support (WebAuthn)
- Role-based: `admin` vs standard user
- Pages: `/login`, `/setup-2fa`, `/setup-passkey`, `/verify-2fa`

---

## Chat Media Conversion API

All routes: `api/chat/convert/`

| Route | Method | Purpose |
|-------|--------|---------|
| `image` | POST | Sync image conversion (ffmpeg) |
| `video` | POST | Sync video conversion (for small files) |
| `video/start` | POST | Start async video job, returns `jobId` |
| `video/progress` | GET | SSE stream: `{percent, done, error}` |
| `video/result` | GET | Download completed video, cleans up |

**Job store:** `lib/video-jobs.ts` — `globalThis.__videoJobs` Map, 30-min TTL prune.

**nginx body size overrides** (`/etc/nginx/sites-available/office.tinyglobalvillage.com`):
- `/api/chat/convert` → `client_max_body_size 500m`, `proxy_read_timeout 600s`
- `/api/chat/upload` → `client_max_body_size 100m`
- `/api/cdn/upload` → `client_max_body_size 100m`

**Next.js body config** (`next.config.ts`):
```typescript
experimental: {
  serverActions: { bodySizeLimit: "500mb" },
  serverBodySizeLimit: "500mb",
}
```

---

## CDN

- **Root on disk:** `/srv/refusion-core/cdn/`
- **nginx serves:** `/media/` → `/srv/refusion-core/cdn/` (static)
- **Upload route:** `api/cdn/upload` (general), `api/chat/upload` (chat files)
- **Chat file path:** `cdn/chat/{chatId}/{username}/{type}/YYYY_MMM_DD_filename.ext`

---

## Other API Routes

| Area | Routes |
|------|--------|
| Presence | `api/presence/ping`, `api/users/ping` |
| Users | `api/users/me`, `api/users/profile`, `api/users/avatar`, `api/users/role` |
| AI | `api/claude/*` |
| Terminal | `api/terminal/shell`, `api/terminal/stream`, `api/terminal/claude` |
| Announcements | `api/announcements/*` |
| Sandbox | `api/sandbox/*` |
| Logs | `api/logs/*` |
| PM2 | `api/pm2/*` |
| Exec | `api/exec/*` |
| Editor | `api/editor/*` |

---

## Sandbox (Component Library)

Live component browser at `/dashboard` → Sandbox modal.

- Registry: `components/sandbox/registry.tsx`
- Vocab-driven: each TGV vocabulary term (Lightswitch, DDM, QMBM, etc.) has a sandbox entry
- Edit mode: live style tweaks synced back to source files
- See `~/.claude/VOCABULARY.md` for the full term index

---

## Design System

**Theme:** `app/theme.ts` — `colors` (hex) + `rgb` (string triples for rgba())

Key accents:
| Drawer | Accent | Usage |
|--------|--------|-------|
| Chat | `green` | Borders, glows, buttons |
| Office/Email | `pink` / `violet` | Headers, accents |
| Sessions (planned) | `pink` | Drawer pill |

**Styled primitives** (`app/styled.ts`): `DrawerPanel`, `DrawerHeader`, `DrawerTab`, `DrawerBackdrop`, `DrawerResizeHandle`, `PanelIconBtn`, `Input`, etc.

**Light mode:** All components have `[data-theme="light"] &` overrides.

---

## ⚠️ Lost Features (sessions that ran out of context without committing)

These were built in Claude sessions that were never committed to git. They need to be rebuilt:

### 1. WhatsApp Integration (ChatDrawer)
- Was wired into the ChatDrawer alongside group/DM tabs
- Likely used a WhatsApp Business API (WABA) or Twilio integration
- Showed incoming WhatsApp messages, allowed replies from the office chat UI
- **Status: Lost. Needs full rebuild.**

### 2. SessionsDrawer
- Planned as a separate drawer (pink accent) for LiveKit team video sessions
- Was a placeholder at time of last commit — may have been partially fleshed out
- Should use `@tgv/module-sessions` (same LiveKit module as `refusionist.com` client sessions)
- Features needed: start/join room, device selection, participant list
- **Status: Placeholder only in memory. Needs implementation.**

### 3. ChatRichInput + ChatUserList extraction
- In the most recent session, ChatDrawer was being refactored to extract an inline rich text input (`ChatRichInput.tsx`) and user list (`ChatUserList.tsx`) into separate files
- The rebuilt version (commit `1c306d8`) may not match the original extracted version exactly
- **Status: Partially rebuilt, verify feature parity.**

---

## Session Continuity Notes

- **Memory dir:** `~/.claude/projects/-srv-refusion-core-client-refusionist-com/memory/`
- **Key memory files:** `project_sessions_drawer.md`, `project_livekit_e2ee.md`
- **TGV Stack:** `~/.claude/TGV-STACK.md`
- **Commit regularly** — this project has lost multiple sessions' worth of work to context expiry without commits

---

## Local Dev

```bash
# On RCS (no local Mac copy — RCS-only project)
cd /srv/refusion-core/client/office.tinyglobalvillage.com

# Install (pnpm workspace — run from monorepo root)
cd /srv/refusion-core && pnpm install --filter office.tinyglobalvillage.com...

# Build
npm run build

# PM2
pm2 reload office.tinyglobalvillage.com --update-env
pm2 logs office.tinyglobalvillage.com --lines 50
```

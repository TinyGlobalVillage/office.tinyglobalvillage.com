# SessionsDrawer — Outline

Pointer index for `SessionsDrawer.README.md`. Load this first, jump to a section by anchor.

**Source:** [SessionsDrawer.tsx](SessionsDrawer.tsx)
**Sectioned reference:** [SessionsDrawer.README.md](SessionsDrawer.README.md)
**Shared call stack:** [call/README.md](call/README.md)

---

## 1. sessions-drawer (major)

- 1.1 [Panel + Backdrop + SideTab](SessionsDrawer.README.md#sd-panel)
- 1.2 [Drawer state & open/close wiring](SessionsDrawer.README.md#sd-state)
- 1.3 [Resize handle](SessionsDrawer.README.md#sd-resize)

## 2. sessions-drawer-header-row

- 2.1 [Title cluster (DrawerTitle)](SessionsDrawer.README.md#hdr-title)
- 2.2 [DrawerMenu icon bar (popout + close)](SessionsDrawer.README.md#hdr-menu)

## 3. sessions-drawer-body-row

### 3.1 menu column (sidebar)

- 3.1.1 [Sidebar header (search + settings)](SessionsDrawer.README.md#mm-header)
- 3.1.2 [Category list (Lounge / Study / Pair / User-created)](SessionsDrawer.README.md#mm-list)
- 3.1.3 [Row hover DDM (rename / settings / end / leave)](SessionsDrawer.README.md#mm-rowmenu)
- 3.1.4 [DaB (+Add New Session)](SessionsDrawer.README.md#mm-dab)
- 3.1.5 [Sidebar DTog (resize/collapse)](SessionsDrawer.README.md#mm-dtog)

### 3.2 session-room column

- 3.2.1 [Room header (name, presence chips, controls)](SessionsDrawer.README.md#sr-header)
- 3.2.2 [CallSurface (video tiles + audio + screenshare)](SessionsDrawer.README.md#sr-surface)
- 3.2.3 [Lounge side-chat strip (TGV Chat embed + "return to browser" button)](SessionsDrawer.README.md#sr-chat)
- 3.2.4 [Empty placeholder ("Pick a session to join")](SessionsDrawer.README.md#sr-empty)

## 4. Selection state

- 4.1 [`SessionSelection` type (none / lounge / study / pair / user)](SessionsDrawer.README.md#sel-type)
- 4.2 [Observer mode (join with mic+cam off, can unmute)](SessionsDrawer.README.md#sel-observer)
- 4.3 [Multi-room incoming-call options (reject / accept-switch / accept-notify)](SessionsDrawer.README.md#sel-multiroom)

## 5. Modals (children, rendered outside `<Panel>`)

- 5.1 [SessionSettingsModal (per-room settings + Admin Controls)](SessionsDrawer.README.md#mod-settings)
- 5.2 [CreateSessionModal (generator for custom user-created rooms)](SessionsDrawer.README.md#mod-create)
- 5.3 [InviteSessionModal (invite + ring existing members)](SessionsDrawer.README.md#mod-invite)

## 6. Data & persistence

- 6.1 [Sessions registry (`data/sessions.json` + `lib/sessions.ts`)](SessionsDrawer.README.md#data-sessions)
- 6.2 [Session endpoints (`/api/sessions/*`)](SessionsDrawer.README.md#data-endpoints)
- 6.3 [Ring signalling (`data/ring-calls.json` + `/api/chat/ring`)](SessionsDrawer.README.md#data-ring)
- 6.4 [LiveKit token hardening (`/api/livekit/token` per-room ACL)](SessionsDrawer.README.md#data-token)
- 6.5 [Auto-delete: last-member-leaves sweep for user-created rooms](SessionsDrawer.README.md#data-autodelete)

## 7. Mobile adaptations

- 7.1 [Mobile compact list/room view (mirrors ChatDrawer pattern)](SessionsDrawer.README.md#mob-layout)
- 7.2 [Mobile back button + view state](SessionsDrawer.README.md#mob-back)

## 8. Admin Controls (inside SessionSettingsModal)

- 8.1 [Invisible-member add](SessionsDrawer.README.md#admin-invisible)
- 8.2 [Ban list](SessionsDrawer.README.md#admin-ban)
- 8.3 [Force-end session](SessionsDrawer.README.md#admin-forceend)
- 8.4 [Pair-cap admin override (5th-slot monitoring)](SessionsDrawer.README.md#admin-paircap)

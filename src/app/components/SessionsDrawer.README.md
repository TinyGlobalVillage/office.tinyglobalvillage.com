# SessionsDrawer — Reference

Sectioned reference. Outline: [SessionsDrawer.OUTLINE.md](SessionsDrawer.OUTLINE.md). Source: [SessionsDrawer.tsx](SessionsDrawer.tsx). Shared call primitives: [call/README.md](call/README.md).

Each `<a id="..."></a>` anchor below matches a link in the outline. When you need to edit a region, Grep for the anchor ID to jump straight to the section, then Read the section.

**Accent:** pink (`#ff4ecb`). **Side:** left. **Glyph:** video-camera (unlocked).

---

<a id="sd-panel"></a>
## 1.1 Panel + Backdrop + SideTab

Same three-layer stack as ChatDrawer, mirrored to the right side with pink accent:

- **`Backdrop`** (z-index 69, `inset: 0`, transparent dark / faint tint light) — click-to-close wired at JSX site.
- **`Panel`** (z-index 70, right-anchored, `max-width: 85vw`, pink left border) — slides in/out via `transform: translateX(...)`.
- **`SideTab`** (z-index 71, pull tab, drag-to-reposition).

Primitives in [src/app/styled.ts](../styled.ts). SessionsDrawer wraps them with pink-tinted locals near the top of `SessionsDrawer.tsx`.

<a id="sd-state"></a>
## 1.2 Drawer state & open/close wiring

- `open` boolean — toggled by SideTab / Backdrop / Esc / `DRAWER_EVENT` (mutex across the four drawers).
- `tgv-drawer-open` window event with `detail: "sessions"` — used by dashboard TileButton launchers (see `tgv-office-drawer-ux.md` checklist).
- `DRAWER_EVENT` listener closes this drawer when any other drawer opens.

<a id="sd-resize"></a>
## 1.3 Resize handle

Left edge of the panel (mirror of ChatDrawer's right-edge handle). Persists to `sessionStorage["sessions-drawer-width"]`. Capped at `getMaxDrawerWidth()`.

---

<a id="hdr-title"></a>
## 2.1 Title cluster

`DrawerTitle` (see vocab entry) with `"Sessions"` text in pink. No dynamic switching — this drawer's identity doesn't change based on selection (contrast with ChatDrawer §2.1).

<a id="hdr-menu"></a>
## 2.2 DrawerMenu icon bar

Right end of the header. `DrawerMenuButton` cluster (pink accent):

- **Popout** — detaches the current room into a second browser window via `POP` pattern (see `vocabulary/POP.md`). Heartbeat + "currently in pop-out" placeholder in origin window.
- **Close** — pink `NeonX` closing the entire drawer.

No clear/settings on the drawer-level header (those live per-room in §3.2.1 + §5.1).

---

<a id="mm-header"></a>
## 3.1.1 Sidebar header

`SidebarHeader`:

- `SidebarMobileCollapse` (back arrow on mobile, see §7.1)
- Search input (filters rooms in the list below, orange AccentText like ChatDrawer's search)
- Gear button → global `SessionSettingsModal` scoped to the currently selected room

<a id="mm-list"></a>
## 3.1.2 Category list

`SidebarList` (flex:1, overflow-y auto). Content order, each under an `ADL` group header:

1. **🟢 LOUNGE** — always-on `TGV Lounge` room (pinned first, undeletable).
2. **📘 STUDY** — two seed rooms (`Study 1`, `Study 2`).
3. **🧑‍🤝‍🧑 PAIR** — two seed rooms (`Pair 1`, `Pair 2`). Each has a hard **4-member cap** (admin exempt — see §8.4).
4. **⭐ CUSTOM** — user-created rooms (appears only once ≥1 exists).
5. **`DaB`** row — "+Add New Session" (see §3.1.4).

Each row: `SidebarRowWrap` (active-state outline) + `SidebarRow` (click → `setSelection(...)`) + occupant count pill on the right.

The emoji glyphs above are placeholders in this doc — the actual rows use the shared `DrawerSessionsIcon` tinted per category accent (lounge=pink, study=cyan, pair=green, custom=violet).

<a id="mm-rowmenu"></a>
## 3.1.3 Row hover DDM

Same hover/long-press pattern as ChatDrawer §3.1.3. Items vary by row type:

- **Seed rooms (Lounge/Study/Pair):** Rename (admin only), Settings, End-for-all (admin only).
- **User-created:** Rename, Settings, Leave (non-admins), End-for-all (creator/admin).
- **All rooms:** Copy invite link, Mute notifications (local only).

<a id="mm-dab"></a>
## 3.1.4 DaB (+Add New Session)

Dashed-border tile at the bottom of the list (see `vocabulary/DaB.md`). Resting state shows pink uppercase "+ADD NEW SESSION". Click → inline form (name + privacy toggle + Create/Cancel). On create, a new row appears in the Custom category and the tile collapses back.

User-created rooms auto-delete once the last member leaves (not on creator logout) — see §6.5.

<a id="mm-dtog"></a>
## 3.1.5 Sidebar DTog

Drag-to-resize / click-to-collapse bar between sidebar and session-room columns. Same pattern as ChatDrawer §3.1.6 — when collapsed, a `DTogTab` with `DTogExpandIcon` on the room column re-expands.

---

<a id="sr-header"></a>
## 3.2.1 Room header (session-room column)

`RoomHeaderRow` (pink-tinted). Left: category icon + `RoomHeaderName` + `RoomHeaderSub` (occupancy + status). Right: `RoomHeaderActions`:

- Mute-mic toggle (`CallButton`, see `call/README.md`)
- Mute-cam toggle (`CallButton`)
- Screenshare toggle
- Reactions / raise-hand DDM
- Observer-mode toggle (joined with mic+cam forced off — see §4.2)
- Gear button → `SessionSettingsModal` for this room
- **Leave NeonX (red exception)** — leaves the room without closing the drawer. Red instead of pink because "leave call" is destructive-ish and red reads unambiguously across accents.

<a id="sr-surface"></a>
## 3.2.2 CallSurface

Renders `<CallSurface room={selection.room} mode={observer ? "observer" : "active"} />` from `components/call/CallSurface.tsx`. CallSurface owns:

- `LiveKitRoom` provider wrapping `@livekit/components-react`'s `VideoConference`
- Token fetch via `useCallToken()`
- Lifecycle: connect → subscribe → disconnect on unmount

Shared with ChatDrawer's inline call strip (§6 Phase 6). One call stack, two surfaces.

<a id="sr-chat"></a>
## 3.2.3 Lounge side-chat strip

TGV Lounge only. A narrow chat column docked to the right of the video tiles, pointing at the main TGV Chat channel. Two states:

- **Embedded:** renders inline in the drawer, shares state with ChatDrawer's TGV selection.
- **Popped-out:** if ChatDrawer's POP is active (chat detached to another window), this column shows a "Return chat to browser" button that calls back the POP window. Same button appears on the ChatDrawer side when Sessions has the chat.

Non-lounge rooms (Study / Pair / Custom) do not show this strip.

<a id="sr-empty"></a>
## 3.2.4 Empty placeholder

When `selection.type === "none"`, shows `EmptyRoom` with pink video glyph and "Pick a session to join". Header/surface/chat-strip gated off.

---

<a id="sel-type"></a>
## 4.1 Selection type

```ts
type SessionSelection =
  | { type: "none" }
  | { type: "lounge" }
  | { type: "study"; n: 1 | 2 }
  | { type: "pair"; n: 1 | 2 }
  | { type: "user"; sessionId: string };
```

Default on mount: `{ type: "none" }`. A prior session auto-restores if the user was mid-call during last unload (sessionStorage flag).

<a id="sel-observer"></a>
## 4.2 Observer mode

Joined with mic + cam forced off. Can unmute at any time. Surfaced as:

- Default state when joining a full pair room as admin (§8.4)
- User toggle in the room header (§3.2.1)
- Auto-selected when accepting an incoming call via "accept-notify" (§4.3)

<a id="sel-multiroom"></a>
## 4.3 Multi-room incoming-call options

User is allowed to be in multiple rooms simultaneously, but an incoming call while already in a call prompts the `IncomingCallToast` (see `call/README.md`) with three actions:

- **Reject** — decline; caller sees "declined".
- **Accept-switch** — leave current call, join new one.
- **Accept-notify** — join the new room in observer mode and send an auto-message to the new room: "be right there" (auto-confirmed so caller knows).

---

<a id="mod-settings"></a>
## 5.1 SessionSettingsModal

Owned via `showSettingsFor: string | null`. Sections (all `ADL` style):

- General — rename (admin only), privacy toggle
- Audio/Video — default mic/cam state on join, noise suppression preset
- Notifications — ring on join toggle, mute session
- **Admin Controls** — only rendered for room admins (see §8). Contains invisible-member add, ban list, force-end.

<a id="mod-create"></a>
## 5.2 CreateSessionModal

Generator modal for user-created rooms. Owned via `showCreate`. POSTs to `/api/sessions` — on success, refreshes the custom category and selects the new room.

Note: the DaB's inline form (§3.1.4) is the primary creation path. This modal is reserved for "+Add New Session" from outside the drawer (e.g., dashboard TileButton deep link).

<a id="mod-invite"></a>
## 5.3 InviteSessionModal

Owned via `showInviteFor: string | null`. Lets the admin/creator add members and optionally ring them (same ring path used by ChatDrawer call buttons — see §6.3).

---

<a id="data-sessions"></a>
## 6.1 Sessions registry

- Server: [lib/sessions.ts](../../../lib/sessions.ts)
- Storage: `data/sessions.json`
- Shape:

```ts
type Session = {
  id: string;              // "lounge" | "study-1" | "pair-1" | "user-<uuid>"
  kind: "lounge" | "study" | "pair" | "user";
  name: string;
  createdBy: string | null;   // null for seeded rooms
  createdAt: string;
  cap: number | null;         // 4 for pair, null for open rooms
  memberIds: string[];        // current live occupants (updated via presence)
  admins: string[];           // explicit admins; execs are always admin
  banned: string[];
  invisible: string[];        // admin-added phantom members (shown only to admins)
};
```

Seeded on first read: `lounge`, `study-1`, `study-2`, `pair-1`, `pair-2`.

<a id="data-endpoints"></a>
## 6.2 Session endpoints

- `GET /api/sessions` — list all sessions visible to user (respects `invisible`, `banned`)
- `POST /api/sessions` — create user-created room (body: `{ name, cap? }`)
- `PATCH /api/sessions/[id]` — admin ops: rename, add/remove member, ban, add invisible, force-end
- `POST /api/sessions/[id]/presence` — heartbeat; updates `memberIds`; triggers auto-delete sweep

<a id="data-ring"></a>
## 6.3 Ring signalling

- Server: [lib/ring-calls.ts](../../../lib/ring-calls.ts)
- Storage: `data/ring-calls.json`
- Poll pattern mirrors typing indicator (2s). Lightweight — no websockets.
- Endpoints: `/api/chat/ring` (POST start / DELETE cancel / GET poll-per-user)
- Channel keys: `dm:<sorted_pair>`, `group:<id>`, `session:<sessionId>`

<a id="data-token"></a>
## 6.4 LiveKit token hardening

[api/livekit/token/route.ts](../api/livekit/token/route.ts) — must enforce per-room access:

- Look up the session by `roomName`
- Reject if requester is in `banned` or not in `memberIds`/`invisible` for private rooms
- Reject if `kind === "pair"` and `memberIds.length >= cap` AND requester is not admin
- Otherwise grant roomJoin + canSubscribe + canPublish + canPublishData

Currently (pre-Phase-2) grants any authed user any room — hardening is Phase 2.3.

<a id="data-autodelete"></a>
## 6.5 Auto-delete sweep

On every presence heartbeat, `lib/sessions.ts` checks user-created rooms. If `memberIds.length === 0` and `kind === "user"`, delete the session row. Seeded rooms (lounge/study/pair) are never auto-deleted.

Important: this is **last-member-leaves**, not **creator-disconnects**. The creator can log out while others stay in the room.

---

<a id="mob-layout"></a>
## 7.1 Mobile compact layout

When `window.innerWidth <= 768`, mirrors ChatDrawer §7.1:

- Panel becomes 100vw, sidebar becomes `position:absolute` overlay.
- Split into two views via `mobileView: "list" | "room"`.
- Category list on mobile flattens the ADL headers into simple section dividers — users just scroll one list of rooms.

<a id="mob-back"></a>
## 7.2 Mobile back button

`MobileBackBtn` in the room header (visible only on mobile compact). Click → `mobileView = "list"`. The room-leave NeonX also transitions to list view in addition to leaving the call.

---

<a id="admin-invisible"></a>
## 8.1 Invisible-member add

Admin can add a user to `invisible[]`. That user joins the room without showing in the public member list — used for supervising without altering group dynamic.

<a id="admin-ban"></a>
## 8.2 Ban list

Add/remove from `banned[]`. Banned users get a rejection at the token endpoint (§6.4).

<a id="admin-forceend"></a>
## 8.3 Force-end session

PATCH with `{ op: "forceEnd" }`. Kicks all members and, for user-created rooms, deletes the record. For seed rooms, just kicks everyone out (room persists).

<a id="admin-paircap"></a>
## 8.4 Pair-cap admin override

`cap = 4` hard limit on pair rooms applies to non-admins. Admins can join as a 5th occupant for monitoring. The pair UI shows "4/4 — admin observing" when this is the case.

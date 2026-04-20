# ChatDrawer — Reference

Sectioned reference. Outline: [ChatDrawer.OUTLINE.md](ChatDrawer.OUTLINE.md). Source: [ChatDrawer.tsx](ChatDrawer.tsx).

Each `<a id="..."></a>` anchor below matches a link in the outline. When you need to edit a region, Grep for the anchor ID to jump straight to the section, then Read the section.

---

<a id="cd-panel"></a>
## 1.1 Panel + Backdrop + SideTab

The drawer surface. Three styled-components stacked:

- **`Backdrop`** (z-index 69, `inset: 0`, transparent in dark / faint tint in light) — click-to-close is wired at the JSX site, not in the styled component.
- **`Panel`** (z-index 70, left-anchored, `max-width: 85vw`, green right border) — slides in/out via `transform: translateX(...)`.
- **`SideTab`** (z-index 71, the always-visible pull tab with unread badge + drag-to-reposition).

Primitives live in [src/app/styled.ts](../styled.ts) (`DrawerBackdrop`, `DrawerPanel`, `DrawerTab`). ChatDrawer wraps them with its own styled-components near the top of `ChatDrawer.tsx`.

<a id="cd-state"></a>
## 1.2 Drawer state & open/close wiring

- `open` — boolean, toggled by SideTab click, Backdrop click, Esc, and the `DRAWER_EVENT` custom event (mutual-exclusion across drawers).
- `tgv-drawer-open` window event — other parts of the app can dispatch this with `detail: "chat"` to open the drawer.
- `DRAWER_EVENT` listener — when any other drawer opens, closes this one.

<a id="cd-resize"></a>
## 1.3 Resize handle

Right edge of the panel. `Resize` styled-component (extends `DrawerResizeHandle` primitive). Persists width to `sessionStorage["chat-drawer-width"]`. Capped at `getMaxDrawerWidth()` on resize.

---

<a id="hdr-title"></a>
## 2.1 Title cluster

Rendered inside the `Header` styled-component (extends `DrawerHeader`). Switches on `selection.type`:

- `tgv` → `TitleChatIcon` + `"TGV Chat"` text (green).
- `dm` → peer `UserAvatar` + peer display name tinted with `peer.accentColor` + `DmTag` "DM".
- `group` → group name in violet + `GroupManageBtn` (member count, opens `GroupAdminModal`).

<a id="hdr-presence"></a>
## 2.2 Online presence chips

Only visible when `selection.type === "tgv"`. Renders `AvatarChips` (up to N online users) and an `OnlineOverflowBtn` that reveals `OnlineOverflowMenu` DDM with the full list.

<a id="hdr-controls"></a>
## 2.3 Control cluster

Right end of the header. Contains clear-chat button, settings button, and a `NeonX` (green accent) that closes the entire drawer. Distinct from the chatroom-close NeonX in §3.2.1.

---

<a id="mm-header"></a>
## 3.1.1 Sidebar header

`SidebarHeader` containing:

- `SidebarMobileCollapse` (back/collapse button on mobile)
- `SidebarTabSwitch` with two `SidebarTabBtn`s: Users / Groups
- `SidebarPlusBtn` — opens `CreateGroupModal` when Groups tab is active
- Search input (filters the list below)

<a id="mm-list"></a>
## 3.1.2 Sidebar list

`SidebarList` (flex:1, overflow-y auto). Content order:

1. **TGV row** — always first, pinned, `SidebarRow` with `SidebarRowName` "TGV Chat".
2. **User rows** (when `sidebarTab === "users"`) — sorted by pin > online > name.
3. **Group rows** (when `sidebarTab === "groups"`) — sorted similarly.
4. **Archived toggle** at the bottom.

Each row has `SidebarRowWrap` (active-state outline) and `SidebarRow` (click → `setSelection(...)`).

<a id="mm-rowmenu"></a>
## 3.1.3 Row hover DDM

`RowHoverMenu` popover shown on hover/long-press. Items:

- Pin / Unpin (round-trips to `/api/chat/pin`)
- Archive / Unarchive (local)
- Mute / Unmute (local)
- Mark unread (local)
- Block / Unblock (DM only, local)
- Delete (hides row; creator can't delete TGV)
- Manage group (groups only → `GroupAdminModal`)

<a id="mm-archived"></a>
## 3.1.4 Archived toggle

`ArchivedToggle` at the bottom of the list. Flips `showArchived` state which filters `rowMeta.archived` rows into the list.

<a id="mm-deselect"></a>
## 3.1.5 Click-below-list deselect

`SidebarList` has an `onMouseDown` that checks `e.target === e.currentTarget`. If true (i.e., the click landed on empty space below the rows, not on a row), `setSelection({ type: "none" })` — closes the chatroom column and shows the empty placeholder.

<a id="mm-dtog"></a>
## 3.1.6 Sidebar DTog

The drag-to-resize / click-to-collapse bar between sidebar and chatroom columns. When collapsed, a `DTogTab` with `DTogExpandIcon` shows on the chatroom edge to re-expand.

---

<a id="cr-header"></a>
## 3.2.1 Chat header (chatroom column)

`ChatHeaderRow` (accent-tinted). Left: avatar/icon + `ChatHeaderName` + `ChatHeaderSub`. Right: `ChatHeaderActions` with:

- Video-call `ChatHeaderIconBtn` (placeholder — shows "coming soon" alert)
- Voice-call `ChatHeaderIconBtn` (placeholder)
- **Chatroom-close `NeonX` (pink, sm)** — calls `setSelection({ type: "none" })` (and `setMobileView("list")` if `mobileCompact`). Distinct from the drawer-close NeonX in §2.3.

Only renders when `selection.type` is `tgv`, `dm`, or `group`. For `none`, the empty placeholder (§4.2) takes over.

For groups, the header doubles as the entry point for the `ChatHeaderMemberDropdown` DDM (member search).

<a id="cr-messages"></a>
## 3.2.2 Message list

`ScrollableMessages` / `MsgScroll` / `MsgScrollWrap`. Each message → `MessageBubble`. Empty state → `EmptyChat` with `EmptyIcon` 💬 and `EmptyText`. `ScrollToBottomBtn` overlay when scrolled up.

Day-divider rows (`DayDivider` / `DayDividerLabel`) inserted on date transitions, formatted per `settings.timezone`.

<a id="cr-bubble"></a>
## 3.2.3 Message bubble

`MessageBubble` (defined inline in ChatDrawer.tsx, ~line 2800). Sub-parts:

- `BubbleRow` / `BubbleCol` / `BubbleCard` — layout
- `BubbleName` / `BubbleTime` / `BubbleMeta` — meta strip
- `BubbleActions` / `BubbleActionBtn` — inline hover actions
- `BubbleChevron` → `BubbleMenuPopup` DDM (edit/delete/reply/copy)
- `ReactEmojiBtn` → `ReactionTray` DDM
- `ReactionChip` row (existing reactions with count)
- `QuotedReply` (inline reply card)

<a id="cr-composer"></a>
## 3.2.4 Composer

`InputArea` wraps `InputRow`:

- `AttachBtn` → `AttachMenuPopup` DDM (photos, files, convert image/video, contact, poll, event)
- `ChatTextarea` — autosizing
- `PickerBtn` → emoji / GIF / sticker picker (separate component)
- `ComposerMoreBtn` → `ComposerMorePopup` DDM (narrow-composer fallback)
- `SendBtn` (accent-tinted by context)

`FilePreview` + `ThumbPreview` appear above the input when a file is staged.

<a id="cr-reply"></a>
## 3.2.5 Reply chip strip

`ReplyChipRow` above the composer when replying. `ReplyChipFrom` + `ReplyChipExcerpt` + `ReplyChipClose`.

<a id="cr-typing"></a>
## 3.2.6 Typing indicator

`TypingRow` / `TypingBubble` / `TypingDot` / `TypingText`. Shown above messages list when peer is typing.

<a id="cr-preview"></a>
## 3.2.7 File preview + lightbox

`FilePreview` / `ThumbPreview` in composer. Click thumbnail → `FileLightbox` (modal overlay, zoom/close).

---

<a id="sel-type"></a>
## 4.1 Selection type

```ts
type Selection =
  | { type: "none" }
  | { type: "tgv" }
  | { type: "dm"; peer: Profile }
  | { type: "group"; groupId: string };
```

Default state on mount: `{ type: "tgv" }`. `"none"` is only reached by user action (close NeonX or click-below-list).

<a id="sel-empty"></a>
## 4.2 Empty placeholder

When `selection.type === "none"`, the chatroom column renders an `EmptyChat` with 💬 icon and "Select a chat to begin". Header/messages/composer are all gated off.

---

<a id="mod-settings"></a>
## 5.1 ChatSettingsModal

[ChatSettingsModal.tsx](ChatSettingsModal.tsx). Owned by ChatDrawer via `showSettingsModal` state. Controls timestamps, timezone, notifications, storage percent.

<a id="mod-creategroup"></a>
## 5.2 CreateGroupModal (generator)

[CreateGroupModal.tsx](CreateGroupModal.tsx). Owned via `showCreateGroup`. POSTs to `/api/chat/group`. On success, refreshes groups and selects the new group.

<a id="mod-groupadmin"></a>
## 5.3 GroupAdminModal

[GroupAdminModal.tsx](GroupAdminModal.tsx). Owned via `groupAdminId`. PATCH ops to `/api/chat/group/admin`: rename, setVisibility, add/remove members, promote/demote, setBlockedFromSelfAdd, truncateMessages, deleteGroup.

<a id="mod-converter"></a>
## 5.4 MediaConverterModal (generator)

[MediaConverterModal.tsx](MediaConverterModal.tsx). Owned via `converterType`. Converts images or videos, returns a File to stage as `uploadFile`.

<a id="mod-lightbox"></a>
## 5.5 FileLightbox

Inline component (~line 665 of ChatDrawer.tsx). Owned via `previewOpen` + `uploadFile`. Image/video zoom view.

<a id="mod-clearconfirm"></a>
## 5.6 Clear-chat confirm overlay

Inline (`ClearConfirmOverlay` / `ClearConfirmCard`). Owned via `showClearConfirm`. Scope: "clear for me" vs (exec-only) "wipe for everyone" on TGV.

<a id="mod-contactinfo"></a>
## 5.7 ContactInfo

Rendered via `contactInfoFor` state. Shows peer profile card; opened by clicking a DM header or a bubble avatar.

---

<a id="data-pins"></a>
## 6.1 Pins subsystem

- Server: [lib/chat-pins.ts](../../../lib/chat-pins.ts) + [api/chat/pin/route.ts](../api/chat/pin/route.ts)
- Storage: `data/chat-pins.json`
- Model: `{ chatId, userId: string|null, menu: "users"|"groups"|"both", pinnedAt }`
- TGV global pin is seeded + undeletable (`chatId:"tgv"`, `userId:null`, `menu:"both"`)
- Client maps `rowKey` (`tgv:all` / `u:<user>` / `g:<id>`) ↔ server pin and overlays `rowMeta.pinned` on mount.

<a id="data-rowmeta"></a>
## 6.2 Row meta

localStorage key: `tgv_chat_row_meta`. Shape:

```ts
Record<rowKey, { pinned?: boolean; archived?: boolean; muted?: boolean; markedUnread?: boolean; blocked?: boolean; deleted?: boolean }>
```

All fields local-only except `pinned`, which round-trips to the server via `/api/chat/pin`.

<a id="data-messages"></a>
## 6.3 Messages storage

- TGV: `data/chat-messages.json` via `/api/chat`
- DMs: `data/dm-messages.json` via `/api/chat/dm`
- Groups: `data/group-chats.json` (same file as group metadata) via `/api/chat/group/messages`

<a id="data-groups"></a>
## 6.4 Group data model

```ts
type GroupChat = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  memberIds: string[];
  admins: string[];
  visibility?: "open" | "restricted" | "invisible";
  blockedFromSelfAdd?: string[];
};
```

Endpoints: [api/chat/group/route.ts](../api/chat/group/route.ts) (GET/POST), [api/chat/group/admin/route.ts](../api/chat/group/admin/route.ts) (PATCH), [api/chat/group/join/route.ts](../api/chat/group/join/route.ts) (POST/DELETE).

---

<a id="mob-layout"></a>
## 7.1 Mobile compact layout

When `window.innerWidth <= 768`, `mobileCompact = true`. Panel becomes 100vw, sidebar becomes a `position:absolute` overlay. The drawer splits into two views via `mobileView`:

- `"list"` — `MobileList` (WhatsApp-style list, rows are `MobileRow`s)
- `"chat"` — the chatroom column

<a id="mob-back"></a>
## 7.2 Mobile back button + view state

`MobileBackBtn` in the chatroom header (visible only when `mobileCompact`). Clicking it sets `mobileView = "list"`. The chatroom close NeonX (§3.2.1) also performs this transition in addition to clearing selection.

# ChatDrawer — Outline

Pointer index for `ChatDrawer.README.md`. Load this first, jump to a section by anchor.

**Source:** [ChatDrawer.tsx](ChatDrawer.tsx) (~5900 lines)
**Sectioned reference:** [ChatDrawer.README.md](ChatDrawer.README.md)

---

## 1. chat-drawer (major)

- 1.1 [Panel + Backdrop + SideTab](ChatDrawer.README.md#cd-panel)
- 1.2 [Drawer state & open/close wiring](ChatDrawer.README.md#cd-state)
- 1.3 [Resize handle](ChatDrawer.README.md#cd-resize)

## 2. chat-drawer-header-row

- 2.1 [Title cluster (TGV / DM / group)](ChatDrawer.README.md#hdr-title)
- 2.2 [Online presence chips + overflow DDM](ChatDrawer.README.md#hdr-presence)
- 2.3 [Control cluster (clear, settings, NeonX)](ChatDrawer.README.md#hdr-controls)

## 3. chat-drawer-body-row

### 3.1 members-menu column (sidebar)

- 3.1.1 [Sidebar header (tabs + search + plus)](ChatDrawer.README.md#mm-header)
- 3.1.2 [Sidebar list (TGV row + user/group rows)](ChatDrawer.README.md#mm-list)
- 3.1.3 [Row hover DDM (pin/archive/mute/block/delete)](ChatDrawer.README.md#mm-rowmenu)
- 3.1.4 [Archived toggle](ChatDrawer.README.md#mm-archived)
- 3.1.5 [Click-below-list deselect](ChatDrawer.README.md#mm-deselect)
- 3.1.6 [Sidebar DTog (resize/collapse)](ChatDrawer.README.md#mm-dtog)

### 3.2 chatroom column

- 3.2.1 [Chat header (avatar, name, call buttons, close NeonX)](ChatDrawer.README.md#cr-header)
- 3.2.2 [Message list + empty state](ChatDrawer.README.md#cr-messages)
- 3.2.3 [Message bubble + reactions + bubble DDM](ChatDrawer.README.md#cr-bubble)
- 3.2.4 [Composer (textarea, attach DDM, send, emoji/gif pickers)](ChatDrawer.README.md#cr-composer)
- 3.2.5 [Reply chip strip](ChatDrawer.README.md#cr-reply)
- 3.2.6 [Typing indicator](ChatDrawer.README.md#cr-typing)
- 3.2.7 [File preview + lightbox](ChatDrawer.README.md#cr-preview)

## 4. Selection state

- 4.1 [`Selection` type (none / tgv / dm / group)](ChatDrawer.README.md#sel-type)
- 4.2 [Deselect → empty "Select a chat to begin" placeholder](ChatDrawer.README.md#sel-empty)

## 5. Modals (children, rendered outside `<Panel>`)

- 5.1 [ChatSettingsModal](ChatDrawer.README.md#mod-settings)
- 5.2 [CreateGroupModal (generator)](ChatDrawer.README.md#mod-creategroup)
- 5.3 [GroupAdminModal](ChatDrawer.README.md#mod-groupadmin)
- 5.4 [MediaConverterModal (generator)](ChatDrawer.README.md#mod-converter)
- 5.5 [FileLightbox](ChatDrawer.README.md#mod-lightbox)
- 5.6 [Clear-chat confirm overlay](ChatDrawer.README.md#mod-clearconfirm)
- 5.7 [ContactInfo modal (profile peek)](ChatDrawer.README.md#mod-contactinfo)

## 6. Data & persistence

- 6.1 [Pins subsystem (`/api/chat/pin` + `lib/chat-pins.ts`)](ChatDrawer.README.md#data-pins)
- 6.2 [Row meta (localStorage: pinned/archived/muted/markedUnread/blocked/deleted)](ChatDrawer.README.md#data-rowmeta)
- 6.3 [Messages storage (TGV / DM / group JSON files)](ChatDrawer.README.md#data-messages)
- 6.4 [Group data model](ChatDrawer.README.md#data-groups)

## 7. Mobile adaptations

- 7.1 [Mobile compact WhatsApp-style list/chat view](ChatDrawer.README.md#mob-layout)
- 7.2 [Mobile back button + view state](ChatDrawer.README.md#mob-back)

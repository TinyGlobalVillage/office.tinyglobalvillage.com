# ChatDrawer

Right-side WhatsApp-adjacent chat drawer. Houses TGV Chat (broadcast room), per-user DMs, and groups in a single two-column layout.

## Source

- File: [../ChatDrawer.tsx](../ChatDrawer.tsx)

## Structure

- **Header** — title (varies by selection) + online-users chips / overflow DDM + Clear Chat (admin-only, TGV only) + Settings + Popout + Close
- **Body** — `Sidebar` (collapsible via DTog) + `RSD` drag handle + `ConvPane` (messages + composer)
  - `Sidebar` has Users / Groups tab switch, a neon-green "+" button, a pinned TGV Chat row, then a list (users: profiles filtered to exclude self; groups: group chats + dashed "create group" card)
  - Each user / group row gets a hover dropdown (`RowHoverMenu`) with actions like "Open DM" / "Continue in WhatsApp" (users) or "Open group" (groups)

## Shared UI patterns

- **Online users chip + overflow DDM** — mirrors [TopNav](TopNav.md). ≤2 online → avatar chips; >2 → collapses into a single `N` pill with MembersIcon that opens a DDM of all online users
- **Trash icon** — uses the canonical [TrashIcon](TrashIcon.md), not an inline SVG
- **DTog / RSD** — standard drawer primitives (see VOCABULARY)
- **ADL sections** — used in the settings modal, see [ChatSettingsModal](ChatSettingsModal.md)

## Related APIs

- `/api/chat` — TGV Chat messages
- `/api/chat/dm` — direct messages
- `/api/chat/group` + `/api/chat/group/messages` — group chats (schema + CRUD)
- `/api/chat/giphy` — Giphy proxy used by [ChatPicker](ChatPicker.md)
- `/api/chat/upload`, `/api/chat/typing`, `/api/chat/clear` — supporting endpoints

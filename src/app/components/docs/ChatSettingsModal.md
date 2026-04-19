# ChatSettingsModal

Unified user-settings modal opened from the chat drawer header gear. Every section renders as an **ADL** (Accordion + Lightswitch): click the whole row to toggle both the mini switch and the body expand/collapse.

## Source

- File: [../ChatSettingsModal.tsx](../ChatSettingsModal.tsx)

## Sections

- **Identity** — display name, email, title, bio
- **Timestamps** — relative / time / full, font size
- **Appearance** — two-column accent palette (dark / light) with two mini preview columns below; auto-saves on click; persists `darkAccent` and `lightAccent` via `PATCH /api/users/profile`; also writes `accentColor` when picking the palette matching the current theme
- **Chat Storage** (admin-only) — storage percent bar + "Clear All Chat & Files" button, which uses the canonical [TrashIcon](TrashIcon.md)

## Props

- `settings` / `onSettingsChange` — chat-level UI prefs
- `profiles` / `currentUser` — drives Identity form
- `storagePercent` / `onClearChat` — admin-only Chat Storage section
- `onProfileRefresh` — called after profile saves so the parent can refetch

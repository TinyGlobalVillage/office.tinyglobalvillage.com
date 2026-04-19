# TopNav

Primary top navigation bar rendered on every dashboard page.

## Source

- File: [../TopNav.tsx](../TopNav.tsx)

## Right-side behavior

- **Logged-in users only** — chips appear only for users currently online (60s presence threshold)
- **Collapse-to-DDM when >2** — if more than two users are online, every online user collapses into a single [MembersIcon](MembersIcon.md) pill `N` that opens an overflow DDM listing all online users
- **≤2 online** — online users render as individual clickable avatar chips
- Click a chip or DDM row → opens that user's ProfileModal

## Mirrored pattern

The chat drawer's header also uses this exact chip / `N` pill / DDM pattern — see [ChatDrawer](ChatDrawer.md). Keep both in sync; if you change one, update the other.

## Navigation

- Left: logo + route links
- Right: chips / overflow DDM, LightswitchDarkMode, Sign out

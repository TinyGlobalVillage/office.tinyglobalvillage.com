# Component Library — TGV Office

Pointer index. Each entry is a one-liner that links to its own README under `docs/`. Add a new entry here every time you document a component.

## Icons (shared SVGs — global across the app)

- [TrashIcon](docs/TrashIcon.md) — canonical "tgv trash icon", ported from `@tgv/core/IconTrash`
- [ChatIcon](docs/ChatIcon.md) — speech bubble SVG used for TGV Chat titles/headers
- [MembersIcon](docs/MembersIcon.md) — multi-person silhouette used for member lists and overflow DDMs
- [FileIcon](docs/AttachIcons.md) — document outline used in the attach menu
- [PhotosIcon](docs/AttachIcons.md) — picture-with-mountain icon used in the attach menu
- [ContactIcon](docs/AttachIcons.md) — user badge icon used in the attach menu
- [PollIcon](docs/AttachIcons.md) — bar-chart icon used in the attach menu
- [EventIcon](docs/AttachIcons.md) — calendar icon used in the attach menu
- [ConvertImageIcon](docs/AttachIcons.md) — image + arrow used to trigger the MediaConverter (image mode)
- [ConvertVideoIcon](docs/AttachIcons.md) — video + arrow used to trigger the MediaConverter (video mode)

## Chat

- [ChatDrawer](docs/ChatDrawer.md) — right-side WhatsApp-adjacent chat drawer (TGV Chat + DMs + Groups)
- [ChatPicker](docs/ChatPicker.md) — emoji / GIFs / stickers picker (Giphy-backed, endless scroll)
- [ChatSettingsModal](docs/ChatSettingsModal.md) — unified user settings modal with ADL sections + accent-color palette

## Layout

- [TopNav](docs/TopNav.md) — top navbar with logged-in-user chips + collapse-to-DDM when >2 online

## Convention

- Keep the docs concise: what the component is, where it's used, and any non-obvious props or behavior.
- If an icon is "global" (re-used across drawers/modals), say so explicitly in its doc and import it from `components/icons`.
- If a component shares a UX pattern with another (e.g. the chat drawer's online-users DDM mirrors TopNav), link both ways.

### Drawer icon rule (applies to ChatDrawer and any future drawer)

**All drawer button/menu affordances use SVG icons imported from `components/icons/`.** Never Unicode emoji (`📄🖼️👤📊📅✦`) and never inline `<svg>` paths pasted into the component file. Rationale:

- emoji render inconsistently across OS/browser and don't inherit the drawer's neon theme color
- inline `<svg>` paths drift out of sync with other usages and can't be re-used
- one icon = one file under `components/icons/` + one export in `icons/index.ts`

**Theming:** wrap the icon in a styled `<span>` that sets `color: ${colors.<theme>}` (e.g. `colors.green` for chat, `colors.violet` for sandbox) — the SVG inherits via `stroke="currentColor"`/`fill="currentColor"`. Keep icon sizes consistent within a single menu (16 px for inline menu rows, 14 px for header control buttons).

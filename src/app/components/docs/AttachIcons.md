# Attach-menu icons

Seven neon-green SVG icons used by the [ChatDrawer](ChatDrawer.md) attach menu. Each is a thin-stroke glyph drawn on a 24×24 viewBox using `currentColor`, sized to 16 px inside the menu and tinted via `color: ${colors.green}` on the wrapping span.

## Sources

- [../icons/FileIcon.tsx](../icons/FileIcon.tsx) — document with a folded corner + two text lines
- [../icons/PhotosIcon.tsx](../icons/PhotosIcon.tsx) — framed picture with a dot "sun" and mountain line
- [../icons/ContactIcon.tsx](../icons/ContactIcon.tsx) — framed head + shoulders badge
- [../icons/PollIcon.tsx](../icons/PollIcon.tsx) — three vertical bars on a baseline
- [../icons/EventIcon.tsx](../icons/EventIcon.tsx) — calendar grid with two hangers and a date dot
- [../icons/ConvertImageIcon.tsx](../icons/ConvertImageIcon.tsx) — picture frame + right-arrow
- [../icons/ConvertVideoIcon.tsx](../icons/ConvertVideoIcon.tsx) — video rectangle with play-flag + right-arrow

## Import

```tsx
import {
  FileIcon, PhotosIcon, ContactIcon,
  PollIcon, EventIcon,
  ConvertImageIcon, ConvertVideoIcon,
} from "./icons";
```

## Props

- `size?: number` — width + height in px (default 16)
- All standard `SVGProps<SVGSVGElement>`

## Usage

In the chat drawer's attach popup, each icon is rendered inside an `AttachMenuIcon` span that sets `color: ${colors.green}` — the icon picks up the neon tint automatically:

```tsx
<AttachMenuItem onClick={...}>
  <AttachMenuIcon><FileIcon size={16} /></AttachMenuIcon> File
</AttachMenuItem>
```

## Convention

See the **Drawer icon rule** in [../README.md](../README.md) — all drawer affordances must use SVGs from `components/icons/`, never emoji.

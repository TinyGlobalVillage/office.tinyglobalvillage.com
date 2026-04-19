# TrashIcon — the "tgv trash icon"

Canonical trash/delete SVG. Use this anywhere a delete/clear/trash action needs a visual affordance. **Do not re-draw the trash SVG inline** — import this icon instead.

## Source

- File: [../icons/TrashIcon.tsx](../icons/TrashIcon.tsx)
- Ported from: `/srv/refusion-core/packages/@tgv/core/src/components/icons/IconTrash.tsx`

## Import

```tsx
import { TrashIcon } from "./icons";
// or, from outside components/:
import { TrashIcon } from "@/app/components/icons";
```

## Props

- `size?: number` — width + height in px (default `16`)
- All standard `SVGProps<SVGSVGElement>` (e.g. `style`, `className`)

Color is inherited via `currentColor` — set `color` on a parent or pass `style={{ color: ... }}`.

## Current usages

- [ChatDrawer](ChatDrawer.md) — "Clear all messages" header control (TGV Chat only)
- [ChatSettingsModal](ChatSettingsModal.md) — "Clear All Chat & Files" admin row in the storage ADL

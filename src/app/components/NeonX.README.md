# NeonX — Reference

Sectioned reference. Outline: [NeonX.OUTLINE.md](NeonX.OUTLINE.md). Source: [NeonX.tsx](NeonX.tsx).

---

<a id="nx-purpose"></a>
## 1.1 Purpose

Glowing accent-tinted close button. Default glyph is `✕`. Used anywhere in the app that needs a "dismiss" affordance with the TGV glow aesthetic: modal corners, drawer headers, chat-header close actions.

<a id="nx-props"></a>
## 1.2 Props

```ts
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  accent?: GlowColor;        // default "pink" — uses the rgb/colors palette
  color?: string;            // raw CSS color override — beats accent when set
  size?: "sm" | "md" | "lg" | "row"; // default "md"
  children?: ReactNode;      // override the glyph (rare)
};
```

---

<a id="nx-sizes"></a>
## 2.1 Size presets

| Size  | Box      | Font       | Radius    | Typical use                               |
|-------|----------|------------|-----------|-------------------------------------------|
| `sm`  | 1.5rem   | 0.8125rem  | 0.375rem  | Inline cancel chips (reply chip, etc.)    |
| `md`  | 2.125rem | 1.0625rem  | 0.5rem    | Drawer / modal headers (default)          |
| `lg`  | 2.75rem  | 1.25rem    | 0.625rem  | Large modal corner close                   |
| `row` | 2rem     | 0.9375rem  | 0.5rem    | Inside a chat-header-style icon-button row |

<a id="nx-mobile"></a>
## 2.2 Mobile size bump

At `max-width: 768px`, size `md` bumps up to 2.75rem box / 1.1875rem font / 0.625rem radius so finger tap targets stay comfortable. Other sizes are unchanged.

---

<a id="nx-accent"></a>
## 3.1 Accent mode (default)

When only `accent` is set, NeonX uses the tinted-rgba glow treatment:
- `background: rgba(<accent>, 0.14)` → 0.28 on hover
- `border: 1px solid rgba(<accent>, 0.45)`
- `color: colors[accent]`
- `text-shadow: 0 0 6px rgba(<accent>, 0.7)` (suppressed in light mode)
- Hover `box-shadow: 0 0 10px rgba(<accent>, 0.5)`

Accepts any `GlowColor`: `green`, `cyan`, `pink`, `violet`, `orange`, `yellow`, `red`, etc. Palette: [theme.ts](../theme.ts).

<a id="nx-color"></a>
## 3.2 `color` override (raw CSS)

When `color` is passed (any CSS color string — hex, rgb, var, whatever), NeonX switches to `color-mix(in srgb, ...)` so arbitrary colors work:

- `background: color-mix(in srgb, <color> 14%, transparent)` → 28% on hover
- `border: 1px solid color-mix(in srgb, <color> 45%, transparent)`
- `color: <color>`
- Hover `box-shadow: 0 0 10px color-mix(in srgb, <color> 50%, transparent)`

No `text-shadow` in this mode — raw colors don't assume a glow palette.

**Use this when the NeonX must match a dynamic accent** (e.g. a DM peer's `accentColor` hex) that isn't in the GlowColor palette.

---

<a id="nx-row-rule"></a>
## 4.1 Row-embedded NeonX rule

> When a NeonX is placed inside a row of icon buttons (e.g. a chat-header-row with video/voice/close controls), it **must match the height and color of the other controls on that row**.

**Pattern:**

```jsx
<NeonX
  color={rowAccent}  // same accent var the neighboring buttons use
  size="row"         // 2rem box — matches ChatHeaderIconBtn dims
  onClick={...}
/>
```

Reference implementation: chatroom-close NeonX in [ChatDrawer.tsx](ChatDrawer.tsx) §3.2.1 of [ChatDrawer.README.md](ChatDrawer.README.md#cr-header) — passes `color={accent}` where `accent` is the chatroom's dynamic accent (green for TGV/group, peer's accent for DMs).

Don't use `accent="pink"` on a row-embedded close if the rest of the row is green or violet — it breaks visual cohesion.

<a id="nx-corner-rule"></a>
## 4.2 Modal / drawer corner NeonX

Standalone close buttons at the corner of a modal or drawer header have free rein on accent — pick whatever fits the surface's theme (pink is the default, green for chat-adjacent drawers, violet for group-related surfaces, etc.). Use `size="md"` unless the surface is oversized, in which case `size="lg"`.

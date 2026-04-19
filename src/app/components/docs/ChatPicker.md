# ChatPicker

Emoji / GIFs / Stickers picker. Opens from the green smiley button in the chat composer (both TGV Chat and DM).

## Source

- File: [../ChatPicker.tsx](../ChatPicker.tsx)

## Tabs

- **Emoji** — static built-in list, 8-column grid, click inserts character into input
- **GIFs** — Giphy `gifs` endpoint (trending or search)
- **Stickers** — Giphy `stickers` endpoint (trending or search)

## Behavior

- Endless scroll via `IntersectionObserver` on an end-sentinel; page size 24; `hasMore` drives the loader
- Thumbnails sized ~200×100 (Giphy `fixed_height_small` ~100px tall, cover-fit into 2-col grid cells)
- Lazy-loading: native `loading="lazy"` on each `<img>`
- Click on a GIF/sticker inserts its `original` URL into the composer input — the user still presses Send

## Backing API

- [/api/chat/giphy](../../api/chat/giphy/route.ts) — server-side proxy that keeps `GIPHY_API_KEY` out of the client
- Query params: `kind=gifs|stickers`, `q`, `offset`, `limit`

## Props

- `onEmoji(char)` — called when an emoji is picked
- `onGif(url)` / `onSticker(url)` — called with the full-quality URL
- `onClose()` — called on backdrop click, Esc, or after any pick

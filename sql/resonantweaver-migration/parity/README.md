# parity/ — the two harnesses that decide whether a migrated surface matches

Both compare **the same URL rendered two ways** — the app route that serves a
surface today against the `page_models` row meant to replace it. The way to
produce the pair is to comment the surface out of `SITE_SURFACES`
(`clients/tinyglobalvillage.com/src/lib/tenants/siteSurfaces.ts`), which makes
the row answer instead of the route, and to restore it afterwards. Same
viewport, same auth, same moment.

| | what it answers | what it cannot see |
|---|---|---|
| `token-parity.mjs` | Same words, same elements — the multiset of visible text and of tag names. | Layout. Everything Marthe listed on 2026-08-07 except the menu. |
| `pixel-diff.mjs` | Same page. Every pixel, plus a bounding box on the first that isn't. | Why. It says where, and you go look. |

Run the tokens first — a text difference is a content bug and names itself.
Run the pixels second, because that is the one that catches a correct page in
the wrong box.

```bash
curl -s -H "Host: resonantweaver.com" http://127.0.0.1:3111/galactic-field-guide/ > /tmp/route.html
# ... comment the grant out, restart, re-fetch as /tmp/row.html ...
node parity/token-parity.mjs /tmp/route.html /tmp/row.html "galactic field guide"
node parity/pixel-diff.mjs shots/route.png shots/row.png
```

Both exit non-zero on a difference, so either can gate a wave the way
`generate.mjs --check` gates the SQL.

## Why neither is a byte diff

styled-components mints a new class hash whenever the CSS it hashes changes, so
a byte compare of two renders of one component reports a difference on every
unrelated restyle and is worth nothing. A DOM-path compare fails for a
different reason: React streams, so the same subtree arrives inline in one
render and inside a hidden fixup `<div>` in the other — 489 of 528 paths
"differed" on the first attempt at this, and every one of them was mechanism.

## Why they have no dependencies

The first copy of `token-parity.mjs` was written into a session scratchpad and
lost with it. This Mac has no Pillow and the worktree has no `playwright`
package, so a harness that needs an install is a harness that is not there on
the day it is needed. `pixel-diff.mjs` decodes PNG itself — zlib plus the five
filter cases from the spec — for that reason alone.

## What they have caught

- **2026-09-05, W8.** Tokens: 0 text differences on both starseed surfaces,
  one extra `<div>`. That div looked like harmless mechanism and was not — the
  pixels showed her nav pill painted on top of the Galactic Field Guide, which
  the route hides behind it. The section-stack wrapper's `position: relative`
  plus a paint z-index opened a stacking context and trapped the guide's own
  `z-index: 100000` under the nav. Fixed by `takesViewport` (mono `a500cd63`,
  client `e23d2d4a`); both surfaces then measured 0 differing pixels — Sun Walk
  1440×4536, field guide 1440×900.

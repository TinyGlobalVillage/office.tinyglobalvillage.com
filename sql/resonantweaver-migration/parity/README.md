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
| `capture-sunwalk.mjs` | Produces the pair, for a surface whose words are behind a click. | Nothing on its own — it shoots, it does not compare. |
| `capture-fieldguide.mjs` | The same, for the guide: page, registry, a dossier and a star card, plus the rendered text of all 42 dossiers and all 62 star cards. | Same — it shoots. |

### …and why the Sun Walk needed a third one

A page screenshot would have passed W9 with every popup rendering blank. All
twenty-four of the currents' strings and both reference essays are behind a
click, so `capture-sunwalk.mjs` opens each of the four dialogs in turn and
writes a PNG *and* the dialog's `innerText` — five captures per mode, in a fixed
order, which is not a thing to do twice by hand and get right.

It earned its keep immediately: the page matched to the pixel and all four
popups came out in the wrong typeface, because they portal to `<body>` and a
section's host supplies the fonts by inherited custom property.

```bash
node parity/capture-sunwalk.mjs route            # grant in place: the route answers
# ... comment the grant out, restart ...
node parity/capture-sunwalk.mjs row              # the row answers
for n in page current anchor weektypes dossier; do
  diff shots/route-$n.txt shots/row-$n.txt        # words (popups only)
  node parity/pixel-diff.mjs shots/route-$n.png shots/row-$n.png
done
```

Playwright is resolved from wherever a copy already exists on this machine,
npx's cache included, and each is tried until one launches — the newest in that
cache wants a chromium build nobody downloaded. It is never installed into this
worktree: two client `package.json` files live here and a bare install rewrites
the lockfile for the whole fleet.

### …and why the field guide needed a fourth

Same problem, twenty times the size. W10 moved ~170 KB of writing — 42 system
dossiers and 62 star cards — out of `@tgv/module-starseed` and into her row, and
every word of it is behind a registry click and a 1400 ms flight. A page shot
proves the chart draws and nothing whatever about seven hundred paragraphs.

So `capture-fieldguide.mjs` walks the whole registry: opens each system, reads
the dossier's `innerText`, opens each of that system's star cards, reads those
too, and writes one text file per mode. **Two of those files diffing empty is
the parity result for the words**; the four PNGs are for the layout.

It drives the registry list rather than the chart, because a star on the field
is a moving target under a pan/zoom transform while a registry row is a stable
DOM node calling the same `onSelect`. Each step waits for the dossier to carry
`.open` rather than for a timer.

```bash
node parity/capture-fieldguide.mjs route-fieldguide   # grant in place: the route answers
# ... comment the grant out, wait for the dev server to recompile ...
node parity/capture-fieldguide.mjs row-fieldguide     # the row answers
diff shots/route-fieldguide-dossiers.txt shots/row-fieldguide-dossiers.txt
for n in page registry dossier starcard; do
  node parity/pixel-diff.mjs shots/route-fieldguide-$n.png shots/row-fieldguide-$n.png
done
```

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

- **2026-09-05, W10.** The field guide's ~170 KB of writing moved out of
  `@tgv/module-starseed` and into her row. Text: `route` vs `row`
  **byte-identical** — all 42 dossiers and all 62 star cards, 192,165 bytes each
  — both before the seed (the resolver falling through to the shipped words) and
  after it (the row's own copy). Pixels, page / registry / dossier / star card:
  0.003% / 1.44% / 6.92% / 3.81% before the seed, 0.003% / 2.06% / 11.55% /
  11.70% after it.

  Those pixel numbers are not the finding. **The control is**: capturing the
  SAME route twice, with no code change between the two runs, measures 0.003% /
  1.46% / 11.65% / 11.20% — a bigger difference than route-vs-row on every
  panel. The chart is an animated starfield under a pan/zoom transform and it is
  never in the same place twice, so on this surface a pixel diff has a noise
  floor of about twelve percent and can only ever say "nothing moved that the
  starfield doesn't move anyway." **Always shoot the control before reading a
  number off this surface** — without it, 6.92% reads like a regression.

# What resonantweaver.com looked like before it was pooled

The thing pixel parity is measured AGAINST. Captured from **her own Next app on
:3003**, which is serving again after the 2026-08-07 rollback.

## What is here

`her-app-2026-08-07-v2.tgz` — **23 routes × {1440, 768, 390} = 69 captures.**
Per capture: a computed-style fingerprint (`.fp.txt`), and a `.json` carrying
the page height, the font histogram, and the **band rectangles** the differ
crops. `manifest.json` records the base URL, the route list, the viewports and
the masks, and `tenant-pixel-parity.mjs` replays it — so both sides of a
comparison are captured the same way by construction rather than by care.
`her-app-2026-08-07-v2.report.txt` is the capture log.

`her-app-2026-08-07.fingerprints.tgz` — the first freeze, kept. 18 routes,
fingerprints only, no bands. Superseded but not deleted: it is the capture the
rollback was verified against.

`her-app-2026-08-10b.tgz` — **THE CURRENT RULER**, 25 routes x 3 = 75 captures,
re-frozen 2026-08-10 because the browser started honouring `scrollbar-gutter:
stable` and BOTH sides began laying out 15px narrower. Nothing in her app moved
(same commit since 2026-08-08) and nothing in the pooled render did either — the
control run is what proved it. Read `tenant-pixel-parity.mjs`'s `OUT OF PHASE`
block before believing any regression; it has now caught this twice.

`her-app-2026-08-09.tgz` — the previous ruler, superseded. Kept: it is what
every number written into PIXEL-PARITY-PLAN before 2026-08-10 was measured
against.

`routes.txt` — the work list, and the input to both scripts.

## Why this is committed and why it was urgent

Until 2026-08-07 this existed only inside a pm2 process. That process was stopped
at the cutover, and when it was needed back the documented command to restart it
**did not work** — `pm2 start resonantweaver.com` read the name as a file path
and failed, then created a second, errored app. It came back by numeric id. A
reference that one command can destroy, restored only by a command nobody has
run, is not a reference.

## Three things the v2 capture found

**The first freeze was missing five pages.** It captured 18 routes; her app
serves 23 — exactly the "23 hand-coded pages" the cutover plan counted. Absent
were `/open-your-journey/`, `/landing-star-preview/course/` and the three
`/experience/` pages. **A baseline that is missing a page cannot fail on it.**

**Her app hides the default locale.** `/en/starseed/` 307s to `/starseed/`.
PIXEL-PARITY-PLAN Phase 2 lists her nav hrefs with the `/en/` prefix; authored
that way, every nav click would cost the visitor a redirect hop.

**Two captures of the same page differed by 2.11%.** The Pearl Chamber's mandala
rotates and its title glows, so the page failed a gate it was being compared to
itself against. The fix is to FREEZE animations, not to mask them — a masked
band is a band nobody is checking, and the day that mandala fails to render in
the pooled version a mask would report PASS. Every keyframe animation is driven
to its end state, deterministically, on both sides. Residual after that: 0.11%
on `/journey/`, well under the 0.5% gate.

## Regenerating, and comparing against the pooled render

Both scripts live in `clients/tinyglobalvillage.com/scripts/`. Captures land in
`.baselines/`, which is gitignored — **the PNGs are 100MB per capture and stay
device-local**, same convention as the bug registry's screenshots. Only the text
half is committed, as the tarball above.

    ssh -f -N -L 3003:localhost:3003 rcs-direct        # her app
    node scripts/tenant-baseline.mjs \
      --base http://127.0.0.1:3003 --out .baselines/rw-her-app \
      --routes-file ../office.tinyglobalvillage.com/sql/resonantweaver-migration/baseline/routes.txt

    ssh -f -N -L 3101:localhost:3001 rcs               # the LIVE renderer
    node scripts/host-proxy.mjs 8105 3101 resonantweaver.com
    node scripts/tenant-pixel-parity.mjs \
      --baseline .baselines/rw-her-app --candidate http://127.0.0.1:8105 \
      --out .baselines/rw-diff

The differ prints every page ranked worst-first, every band over the gate with
its before/after size, and a computed-style delta beside it — because a pixel
diff says THAT something differs and a style diff says WHAT, and the second is
the difference between a red rectangle and a bug report.

**Prove the tooling before trusting a result**: capture twice from the same
source and diff the two. That is how the mandala was found, and a run that
cannot return PASS on a page against itself cannot be believed when it returns
FAIL on anything else.

## Do not stop pm2 id 5 without replacing this

Her app is `resonantweaver.com`, pm2 id **5**, port 3003, cwd
`/srv/refusion-core/clients/resonantweaver.com`. Start it by **id**, not by name.

## The 2026-08-09 re-freeze — why a PNG baseline expires

`rw-her-app-2026-08-09` replaces `rw-her-app-2026-08-08` as the measuring stick.
Her app did not change: same commit, same `pm2` process on :3003, and
`/landing-star-preview/develop/` is 4077px tall in both freezes.

What changed is the BROWSER. Her `GlobalStyles` carries
`html { scrollbar-gutter: stable }`, so her body lays out 15px narrower than the
viewport — 1425 at 1440. The 08-08 capture was taken with that gutter NOT
reserved (body 1440), and captures taken on 08-09 reserve it. Every centred
element is therefore ~7px apart between the two: her own live page, re-shot
today, needs a −7px shift to align with her own stored baseline (7.45% changed
at shift 0, 2.33% at −7).

**It surfaced as a regression caused by a fix.** The pooled renderer learned to
reserve the same gutter (`siteBackground.scrollbarGutter`), which made the pages
geometrically identical to hers — `develop`'s h1 at x 24.5, w 688.2 on both —
and the whole board moved ~1.5–4.4 points the WRONG way, because the old
baseline was the only thing still laid out at 1440.

Two guards so this cannot be silent again: `measurePage` records
`layoutWidth` (`document.body.clientWidth`, not the ICB), both captures store
it, and `tenant-pixel-parity.mjs` collects an `outOfPhase` list and prints it
above the findings — *the ruler is wrong, not the pages; re-freeze before
reading a number.*

The lesson generalises past this tenant: **a PNG baseline is only valid against
the browser that shot it.** Re-freeze whenever the harness's Chromium changes,
and trust the fingerprints (`.fp.txt`, `.tx.txt`) across versions in a way the
pixels cannot be.

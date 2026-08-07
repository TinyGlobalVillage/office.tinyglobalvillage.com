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

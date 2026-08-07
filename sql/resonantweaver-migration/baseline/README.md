# What resonantweaver.com looked like before it was pooled

`her-app-2026-08-07.fingerprints.tgz` — 54 computed-style fingerprints, one per
route per viewport, captured from **her own Next app on :3003** on 2026-08-07,
hours after the cutover was rolled back. 18 routes × {1440, 768, 390}, all 200.
`her-app-2026-08-07.report.txt` is the capture log with each page's scroll
height and element count.

## Why this is committed and why it was urgent

This is the thing pixel parity is measured AGAINST, and until now it existed
only inside a pm2 process. That process was stopped at the cutover, and when it
was needed back the documented command to restart it **did not work** — `pm2
start resonantweaver.com` read the name as a file path and failed. It came back
by numeric id. A reference that can be destroyed by one command, and restored
only by a command nobody had tested, is not a reference.

Her repo still holds the source, so in principle the app is rebuildable. In
practice, rebuilding a stale checkout to recover a screenshot is not a plan, and
the rebuild would not be the same bytes that served her traffic.

## What is in a fingerprint

One line per visible element, keyed by a DOM path (`section:2>div:1>h2:1`) —
never by class name, because styled-components hashes change whenever the CSS
does, which makes them exactly the wrong key for a before/after comparison.
Each line carries the nine things that explain almost every visual difference:

    path | font-family | font-size | font-weight | line-height |
    color | background-color | text-align | width x height

That is deliberately not a screenshot. A pixel diff tells you THAT something
moved; this tells you WHAT changed, which is the difference between a finding
and a bug report. Both are wanted — see PIXEL-PARITY-PLAN.md Phase 0 — and the
PNGs stay device-local per the bug-registry convention (58 MB of them).

## Regenerating or comparing

`scratchpad/freeze-baseline.mjs` captured these and takes a `BASE` override, so
the same script produces the pooled side:

    ssh -f -N -L 3003:localhost:3003 rcs-direct     # her app
    node freeze-baseline.mjs her-app

    node ../../scripts/host-proxy.mjs 8106 3011 resonantweaver.com
    BASE=http://127.0.0.1:8106 node freeze-baseline.mjs pooled

That script is scratch today and belongs in
`clients/tinyglobalvillage.com/scripts/` beside `host-proxy.mjs` and
`tenant-parity.mjs` — Phase 0 of the plan promotes it, along with the pixel
differ it needs to sit next to.

## Do not stop pm2 id 5 without replacing this

Her app is `resonantweaver.com`, pm2 id **5**, port 3003, cwd
`/srv/refusion-core/clients/resonantweaver.com`. Start it by **id**, not by
name.

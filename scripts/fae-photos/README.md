# fae-photos — the template gallery's photo pool

Free-licence photos (CC0 / public domain only) for the fae template gallery, kept in the **house
gallery** — the same storage rows Office's gallery and the TGV dashboard gallery read — inside the
collection **"Fae Template Photos"**. One store, same links, two doors.

| file | runs on | does |
|---|---|---|
| `pool.mjs` | Mac | search Openverse, contact sheet, resize, ship to RCS, keep the ledger |
| `rcs-upload.mjs` | RCS (copied to `/tmp/fae-photos`, deleted after) | `storeFile` public → collection → title/tags → share token |
| `../../docs/template-gallery/photo-ledger.json` | — | every photo: link, licence, creator, source page, and which templates use it |

```sh
export FAE_SCRATCH=/some/scratch/dir           # contact sheets + downloads (default: $TMPDIR/fae-photos)
node pool.mjs search "bakery" --min 1300       # → sheet.jpg, numbered; already-pooled photos are hidden
node pool.mjs import 3,7,11 --tags bakery,bread
node pool.mjs free bakery                      # photos with uses left
node pool.mjs use p-8a5e52b1 <templateId>      # record a use — refuses a 6th site
```

Rules:
- **Licence:** `cc0,pdm` only. Openverse is queried with that filter; the licence is also written into
  the file's tags (`license:cc0`) and the ledger.
- **Reuse cap:** a photo goes on at most **5** templates (`maxUses`). Aim for unique.
- **Size:** Openverse's link isn't always the full photo — stocksnap 960px, flickr 1024px,
  rawpixel 1300px (rewritten from `editor_1024`), wikimedia full size. Heroes want `--min 1300`
  (or `--source wikimedia`); cards and galleries are fine at 960.
- **Links:** `https://tinyglobalvillage.com/api/storage/shared/<token>/` — stable, public,
  noindex, no expiry. Keep the trailing slash (TGV runs `trailingSlash`).
- RCS work is network + DB only — no builds. Needs Office's `.env.local` (R2_* + DATABASE_URL).

Config: `FAE_RCS_HOST` (ssh alias, `rcs`), `FAE_RCS_OFFICE` (Office checkout on RCS),
`FAE_HOUSE_DOMAIN` (`tinyglobalvillage.com`), `FAE_SHARE_ORIGIN`, `FAE_COLLECTION`, `FAE_FONT`.

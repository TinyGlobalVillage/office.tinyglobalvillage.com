# Fae characters: the plan

Our own elves, gnomes and faeries, rendered on the Mac, replace the drawn avatars and add character scenes to all 120 gallery templates. Engine: `scripts/fae-art/characters/` (README there).

**Status (2026-11-19):** generating, in waves by site number (Gio's go). The live tally is `~/.local/share/tgv-fae-art/SITES.txt`. The cast is 610 pictures in all: 370 portraits (one per face a template shows, each a named character) and 120 scenes (1 per site, 1024×576; Gio 2026-11-20). Four sites already have a second take, kept.

## Settled with Gio (2026-11-19)

1. **Engine:** free and local. FLUX.1-schnell (Apache-2.0, so commercial use is fine) runs 4-bit on MLX via mflux 0.24.0 on the Mac.
2. **Two kinds:**
   - **portraits** replace the drawn avatar heads in team, review and testimonial spots;
   - **scenes** put full-body characters into heroes and feature photos.
3. **Volume:** everything at once, in stages. The engine came first; generating and replacing happen only on Gio's cue.

## The look

Every prompt is built from these parts in `look.mts`; `cast.mts` assembles them per character:

| Axis | Values |
|---|---|
| Species | elf (long pointed ears, luminous eyes) · gnome (tall floppy knitted hat, rosy cheeks; men have braided beards) · faerie (iridescent dragonfly or moth wings) |
| Gender | female · male, half each |
| Style, realistic to puppet | `photo` cinematic photograph · `felt` posable needle-felted doll · `clay` stop-motion plasticine · `toon` 3D animated film |
| Costume, never streetwear | `space`: iridescent flight suits, star-voyager armour, holographic cloaks · `myth`: velvet knotwork tunics, moss cloaks, druid robes, bark armour |
| Palette, always | TGV Office neon: magenta pink `#ff4ecb`, cyan `#00bfff`, violet `#a78bfa`, a little gold; glowing energy threads spiralling through the air (the Refusionist / Resonant Weaver thread motif) |
| Backdrop / set | portraits: nebula, bioluminescent forest, cosmic loom, aurora glade, crystal cavern · scenes: the template's trade in fae terms (bakery means a star-dusted loaf from a mushroom-cap oven, and so on) |

**Originality:** Gio's references (a posable felt elf doll; a photoreal gnome with a hammer) set the style only. Prompts never name a product, brand or character.

## Volume

| Kind | Jobs | Renders (2 seeds each) | Size | Feeds |
|---|---|---|---|---|
| Portrait | 120: 3 species × 2 genders × 20, every style × both eras | 240 | 768² | `avatarsFor()`: team, reviews, testimonials |
| Scene | 120: one per template, with **that template's own species** (from `createFaeSite`) at its own trade; 16 collectives get an elf + gnome + faerie trio | 240 | 1344×768 | the hero photo or the first feature photo |

**Time:** about 40 s per render on the M3 Pro, so roughly 2.7 h per stage and about 5.5 h in all. The first chunk measures the real figure.

**Disk:** about 1.2 GB of PNGs outside the repo (`~/.local/share/tgv-fae-art/out`). The engine itself is 10.4 GB. Free disk is now 30 GB against the 25 GB floor.

## Stages

1. **Portraits:** `run.sh portrait`.
   - Works in chunks of 45 minutes or less, each holding the Mac build lock. Between chunks a deploy can slot in.
   - A preflight refusal stops the run. It is never retried and never "fixed" by freeing disk.
2. **Scenes:** `run.sh scene`, same guards.
3. **Review:** contact sheets in `out/sheets/`.
   - Pick the keeper of each pair into `out/picks.json` (`null` = reject).
   - Re-roll rejects with a new seed: `--only id,…` after bumping that job's seeds.
   - Gio gets the sheets as an artifact before anything goes live.
4. **Into the pool:**
   - Copy each keeper to `<id>.png`.
   - Run `pool.mjs add <files> --tags <job tags>`. That gives keys `a-elf-f-03` and `a-scene-542052b1`, with `source: original`, which makes them exempt from the 5-site cap.
   - Then `rcs-upload.mjs` on RCS, the existing Fae Template Photos flow.
   - **Filing and naming (Gio 2026-11-19):**
     - On TGV, every picture goes into a top folder called **"Template Sites"**, with one sub-folder per template site it's attached to.
     - Each elf, gnome and faerie gets its own name.
     - Filenames, titles and alt text follow SEO conventions: lowercase, hyphenated, with name, species, trade and site, e.g. `bramble-thistlewick-gnome-baker-moonloaf-bakery.png`.
     - Characters are unique per site, and the names on the template pages are the characters' names.
     - **Locally first:** every picture is filed into `Template Sites/<NNN Brand>/` as it renders, with that site's prompt doc (index + every prompt and seed). The registry `cast-registry.json` records it all; at the end the whole tree moves to TGV.
     - **At move time:** add nesting to gallery collections (`storage_collections` has no parent today) for Template Sites › site; upload each picture with its SEO filename, title and alt; turn each prompt doc into a Doc Editor doc in a matching nested `docs_folders` folder (needs a Markdown → document import). After that, `cast.mts remix` uploads its result and appends to the TGV doc as well.
5. **Kit wiring** (`kit.ts`, `build.mts`):
   - `avatarsFor(site, offset)` picks from the ledger's `portrait` + `character` entries for the site's species. The order is deterministic per template, alternating female/male, offset as today.
     - `build.mts` hands the kit the pool once it has loaded the ledger.
     - Collectives draw from all three species.
     - The old `a-<species>-<n>` drawn avatars stay in the ledger as a fallback.
   - A new ask, `'@cast'`, resolves to the template's own `a-scene-<key>`.
     - `hero()` uses it in place of its photo ask when the scene exists. That covers the 76 photo-hero specs.
     - The 44 art-only heroes take it on their first `@…` photo ask instead.
     - A spec can opt out with `cast: false`.
   - **As built (2026-11-20):** `move.mts` files sites 001–073 (faery sites wait for the wings). The kit maps each drawn face the template used (`a-elf-2`) to the portrait made for it (ledger `cast.face`), so `avatarsFor` is unchanged; `team` / `reviews` / `listPanel` print the character's name (and role, unless "Customer"); every picture takes its alt from the ledger. The scene takes the template's first `@…` ask (its hero on every spec) or an explicit `'@cast'`; `build.mts --record` hands the displaced pool photo's use back.
6. **Rebuild and ship:**
   - `build.mts` all 120, then `--record`, `push.sh`.
   - Phone + desktop UAT shots of every template.
   - Gallery thumbnails are live, so they update by themselves.
   - Lane push, then wait for "deploy".

## Not doing

- No paid API and no cloud GPU. If schnell's quality falls short, the fallback is FLUX.1-dev, which is non-commercial and so needs Gio's call. Nothing is switched silently.
- No streetwear and no real people's likenesses.
- No generated text inside the pictures (FLUX spells badly). Headlines stay in the page.

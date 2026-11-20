# Fae character engine

Renders our own elves, gnomes and faeries locally on the Mac. It runs FLUX.1-schnell (Apache-2.0, so the pictures are ours) 4-bit on MLX through mflux. The renders replace the drawn avatars and add character scenes to the 120 gallery templates.

The why, the volume and the stages are in `docs/template-gallery/CHARACTERS-PLAN.md`.

Everything is organised **per template site**: each of the 120 sites has its own named characters (the people on its pages, plus extra reviewers) and two scenes. Each picture has a number, an SEO filename, alt text, a prompt and a seed. The source of truth is `docs/template-gallery/cast-registry.json` (append-only; never reshuffled).

On disk (`~/.local/share/tgv-fae-art/`):
- `SITES.txt` — every site, how many of its pictures are rendered, and its status (not started · in progress · FINISHED · reviewed · ON TGV).
- `Template Sites/<NNN Brand>/` — the site's pictures, plus `<brand>-image-prompts.md`: an index (number, title, SEO filename), then every number's full prompt and seed. It is plain Markdown, ready for the TGV Doc Editor.
- `Spares/`, `Rejects/` — renders that belong to no character.

| File | Does |
|---|---|
| `install.sh` | Creates a venv plus the 4-bit model in `~/.local/share/tgv-fae-art/` (about 11 GB). It refuses if that would leave less than 25 GB of free disk, and it never generates. |
| `look.mts` | The look in words: palette, styles, species bodies, costumes, backdrops, trades. |
| `cast.mts` | The registry. `init` (once), `jobs [--sites 1-10]`, `docs` (rewrites SITES.txt and every prompt doc), `remix <site#> <pic#> [--seed N] [--add "words"]` (re-uses a prompt as a new numbered picture in the same folder and doc), `stage <sites> reviewed\|on-tgv`. |
| `generate.py` | Renders the missing pictures in `<out>/jobs.json` straight into their site folders. It is resumable; `--refresh` rewrites the docs after each picture; `--dry-run` loads nothing. |
| `run.sh` | **The way to run it.** `run.sh --sites 1-10` renders one wave. It works in chunks of 45 minutes or less, each holding the Mac build lock (`build-preflight.sh`). If preflight refuses, it stops; it never retries. |

```bash
scripts/fae-art/characters/install.sh                       # once
scripts/fae-art/characters/run.sh --sites 1-10              # a wave of sites (by SITES.txt number)
node_modules/.bin/tsx …/cast.mts remix 12 3 --add "profile view, looking left"   # a new angle
scripts/fae-art/characters/run.sh --sites 12                # renders it and updates the doc
```

How the output gets into the templates (`pool.mjs add`, the kit wiring, the rebuild) is covered in the plan, §Stages 4–6.

Gotchas:
- schnell ignores negative prompts. To keep modern clothing out, say exactly what the costume is.
- Put no brand or character names in prompts. The felt-doll look is a style, not someone's character.
- Generation holds about 8 GB. That is why it takes the build lock and not the dev slot: it is build-sized.

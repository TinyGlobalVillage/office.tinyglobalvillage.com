# Fae character engine

Renders our own elves, gnomes and faeries locally on the Mac. It runs FLUX.1-schnell (Apache-2.0, so the pictures are ours) 4-bit on MLX through mflux. The renders replace the drawn avatars and add character scenes to the 120 gallery templates.

The why, the volume and the stages are in `docs/template-gallery/CHARACTERS-PLAN.md`.

| File | Does |
|---|---|
| `install.sh` | Creates a venv plus the 4-bit model in `~/.local/share/tgv-fae-art/` (about 11 GB). It refuses if that would leave less than 25 GB of free disk, and it never generates. |
| `prompts.mts` | Writes `<out>/jobs.json`: 120 portraits and 120 scenes (one scene per template, with that template's own species and trade), 2 seeds each. The output is deterministic. |
| `generate.py` | Renders the missing PNGs from `jobs.json`. It is resumable and writes a `.json` sidecar per render. `--dry-run` loads nothing. |
| `run.sh` | **The way to run it.** Works in chunks of 45 minutes or less, each one holding the Mac build lock (`build-preflight.sh`). If preflight refuses, it stops; it never retries. When finished it makes contact sheets. |
| `contact.mjs` | Writes contact sheets to `<out>/sheets/` for picking the keeper of each pair into `<out>/picks.json`. |

```bash
scripts/fae-art/characters/install.sh                 # once
scripts/fae-art/characters/run.sh portrait            # stage 1 (~2.5 h)
scripts/fae-art/characters/run.sh scene               # stage 2 (~3 h)
<venv>/bin/python generate.py --out … --model … --dry-run   # what's left, loads nothing
```

How the output gets into the templates (`pool.mjs add`, the kit wiring, the rebuild) is covered in the plan, §Stages 4–6.

Gotchas:
- schnell ignores negative prompts. To keep modern clothing out, say exactly what the costume is.
- Put no brand or character names in prompts. The felt-doll look is a style, not someone's character.
- Generation holds about 8 GB. That is why it takes the build lock and not the dev slot: it is build-sized.

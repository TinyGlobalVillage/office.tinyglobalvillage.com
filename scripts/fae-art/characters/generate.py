"""Renders the fae character jobs (jobs.json from prompts.mts) with FLUX.1-schnell on MLX.

Resumable: a render whose PNG already exists is skipped, so a stopped run picks up where it left
off. Run it through run.sh, which holds the Mac's build lock and stops in chunks so the lock never
goes stale and deploys can slot in between chunks; calling it bare skips those guards.

  <venv>/bin/python generate.py --out DIR --model DIR [--kind portrait|scene] [--only ID,ID]
                                [--limit N] [--minutes M] [--dry-run]
"""

import argparse
import json
import sys
import time
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--kind", choices=["portrait", "scene"])
    ap.add_argument("--only", help="comma-separated job ids")
    ap.add_argument("--limit", type=int, default=0, help="stop after N renders (0 = no cap)")
    ap.add_argument("--minutes", type=float, default=0, help="stop starting new renders after M minutes")
    ap.add_argument("--steps", type=int, default=4)
    ap.add_argument("--dry-run", action="store_true", help="list what would render; load nothing")
    a = ap.parse_args()

    out = Path(a.out)
    jobs = json.loads((out / "jobs.json").read_text())["jobs"]
    if a.kind:
        jobs = [j for j in jobs if j["kind"] == a.kind]
    if a.only:
        want = set(a.only.split(","))
        jobs = [j for j in jobs if j["id"] in want]

    todo = []
    for j in jobs:
        for v, seed in enumerate(j["seeds"]):
            png = out / j["kind"] / f"{j['id']}-v{v}.png"
            if not png.exists():
                todo.append((j, v, seed, png))
    total = sum(len(j["seeds"]) for j in jobs)
    print(f"{total - len(todo)}/{total} rendered, {len(todo)} to go", flush=True)
    if a.limit:
        todo = todo[: a.limit]
    if a.dry_run or not todo:
        for j, v, _, png in todo[:10]:
            print(f"  would render {png.name}: {j['prompt'][:110]}…")
        return 0

    from mflux.models.common.config.model_config import ModelConfig
    from mflux.models.flux.variants.txt2img.flux import Flux1

    t0 = time.time()
    # the model is pre-quantized (4-bit); mflux reads that from the weights, so quantize stays None
    flux = Flux1(model_config=ModelConfig.schnell(), model_path=a.model, quantize=None)
    print(f"model loaded in {time.time() - t0:.0f}s", flush=True)

    done = 0
    for j, v, seed, png in todo:
        if a.minutes and time.time() - t0 > a.minutes * 60:
            print("time box reached — stopping between renders", flush=True)
            break
        png.parent.mkdir(parents=True, exist_ok=True)
        t = time.time()
        img = flux.generate_image(seed=seed, prompt=j["prompt"], num_inference_steps=a.steps, width=j["width"], height=j["height"])
        tmp = png.with_suffix(".part.png")
        img.save(path=tmp, overwrite=True)
        tmp.rename(png)  # a killed run never leaves a half-written PNG that would count as done
        (png.with_suffix(".json")).write_text(json.dumps({"id": j["id"], "variant": v, "seed": seed, "prompt": j["prompt"], "tags": j["tags"], "meta": j["meta"]}, indent=1))
        done += 1
        print(f"✓ {png.name} {time.time() - t:.0f}s", flush=True)
    print(f"rendered {done} this run", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

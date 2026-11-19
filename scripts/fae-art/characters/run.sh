#!/usr/bin/env bash
# Runs the fae character engine safely on a shared Mac: renders in chunks, each one holding the
# Mac's build lock (build-preflight.sh — disk floor, memory pressure, one heavy job per Mac).
# A chunk is time-boxed under the lock's 90-minute stale window; between chunks the lock is
# released so a deploy can take its turn. A refusal stops the run — never retried, never "fixed"
# by freeing disk; read the refusal and tell Gio.
#
#   run.sh portrait|scene|all [--chunk-min 45] [--limit N]
#
#   FAE_ART_HOME  (default ~/.local/share/tgv-fae-art)   FAE_ART_OUT (default $FAE_ART_HOME/out)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MONO="${MAC_RCS_ROOT:-$(cd "$HERE/../../../../.." && pwd)}"
HOME_DIR="${FAE_ART_HOME:-$HOME/.local/share/tgv-fae-art}"
OUT="${FAE_ART_OUT:-$HOME_DIR/out}"
MODEL="${FAE_ART_MODEL_DIR:-$HOME_DIR/models/FLUX.1-schnell-mflux-4bit}"
PREFLIGHT="$MONO/utils/scripts/build-pipeline/build-preflight.sh"

KIND="${1:-}"; shift || true
CHUNK=45; LIMIT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --chunk-min) CHUNK="$2"; shift 2 ;;
    --limit) LIMIT="--limit $2"; shift 2 ;;
    *) echo "unknown arg $1"; exit 2 ;;
  esac
done
case "$KIND" in portrait|scene) KARG="--kind $KIND" ;; all) KARG="" ;; *) echo "usage: run.sh portrait|scene|all [--chunk-min 45] [--limit N]"; exit 2 ;; esac

[ -f "$MODEL/.complete" ] || { echo "STOP: engine not installed — run install.sh"; exit 1; }
[ -f "$OUT/jobs.json" ] || (cd "$MONO" && node_modules/.bin/tsx "$HERE/prompts.mts" --out "$OUT")

LOCK=""
trap '[ -n "$LOCK" ] && bash "$PREFLIGHT" --release "$LOCK" >/dev/null 2>&1 || true' EXIT
while :; do
  left=$("$HOME_DIR/venv/bin/python" "$HERE/generate.py" --out "$OUT" --model "$MODEL" $KARG --dry-run | head -1 | awk '{print $3}')
  [ "$left" = "0" ] && { echo "DONE: every $KIND render exists in $OUT"; break; }
  LOCK=$(bash "$PREFLIGHT" --acquire "fae-art $KIND" --owner-pid $$) || { echo "STOP: build-preflight refused (above). Not retrying."; exit 1; }
  "$HOME_DIR/venv/bin/python" "$HERE/generate.py" --out "$OUT" --model "$MODEL" $KARG --minutes "$CHUNK" $LIMIT
  bash "$PREFLIGHT" --release "$LOCK" >/dev/null; LOCK=""
  [ -n "$LIMIT" ] && break
done
node "$HERE/contact.mjs" "$OUT"

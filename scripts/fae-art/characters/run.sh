#!/usr/bin/env bash
# Renders the fae cast — every picture in docs/template-gallery/cast-registry.json not on disk yet —
# into its site folder (~/.local/share/tgv-fae-art/Template Sites/<NNN Brand>/), in waves by site
# number, safely on a shared Mac: chunks each hold the Mac's build lock (build-preflight.sh — disk
# floor, memory pressure, one heavy job per Mac), time-boxed under the lock's 90-minute stale
# window, released between chunks so a deploy can take its turn. A refusal stops the run — never
# retried, never "fixed" by freeing disk; read it and tell Gio. After every picture SITES.txt and
# that site's prompt doc are rewritten.
#
#   run.sh [--sites 1-10|7|3,9,12] [--kind portrait|scene] [--chunk-min 45] [--limit N]
#
#   FAE_ART_HOME  (default ~/.local/share/tgv-fae-art)   FAE_ART_OUT (default $FAE_ART_HOME/out)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MONO="${MAC_RCS_ROOT:-$(cd "$HERE/../../../../.." && pwd)}"
HOME_DIR="${FAE_ART_HOME:-$HOME/.local/share/tgv-fae-art}"
OUT="${FAE_ART_OUT:-$HOME_DIR/out}"
MODEL="${FAE_ART_MODEL_DIR:-$HOME_DIR/models/FLUX.1-schnell-mflux-4bit}"
PREFLIGHT="$MONO/utils/scripts/build-pipeline/build-preflight.sh"
CAST=(node_modules/.bin/tsx "$HERE/cast.mts")

CHUNK=45; LIMIT=""; SITES=""; KARG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --sites) SITES="$2"; shift 2 ;;
    --kind) KARG="--kind $2"; shift 2 ;;
    --chunk-min) CHUNK="$2"; shift 2 ;;
    --limit) LIMIT="--limit $2"; shift 2 ;;
    *) echo "usage: run.sh [--sites 1-10] [--kind portrait|scene] [--chunk-min 45] [--limit N]"; exit 2 ;;
  esac
done

[ -f "$MODEL/.complete" ] || { echo "STOP: engine not installed — run install.sh"; exit 1; }
(cd "$MONO" && "${CAST[@]}" jobs ${SITES:+--sites "$SITES"})
REFRESH="cd '$MONO' && node_modules/.bin/tsx '$HERE/cast.mts' docs"

LOCK=""
trap '[ -n "$LOCK" ] && bash "$PREFLIGHT" --release "$LOCK" >/dev/null 2>&1 || true' EXIT
while :; do
  left=$("$HOME_DIR/venv/bin/python" "$HERE/generate.py" --out "$OUT" --model "$MODEL" $KARG --dry-run | head -1 | awk '{print $3}')
  [ "$left" = "0" ] && { echo "DONE: every picture${SITES:+ in sites $SITES} is rendered"; break; }
  LOCK=$(bash "$PREFLIGHT" --acquire "fae-art ${SITES:-all}" --owner-pid $$) || { echo "STOP: build-preflight refused (above). Not retrying."; exit 1; }
  "$HOME_DIR/venv/bin/python" "$HERE/generate.py" --out "$OUT" --model "$MODEL" $KARG --minutes "$CHUNK" $LIMIT --refresh "$REFRESH"
  bash "$PREFLIGHT" --release "$LOCK" >/dev/null; LOCK=""
  [ -n "$LIMIT" ] && break
done
(cd "$MONO" && "${CAST[@]}" docs)

#!/usr/bin/env bash
# Installs the fae character engine on a Mac (Apple Silicon): mflux (FLUX on MLX) in its own
# venv + a 4-bit FLUX.1-schnell (Apache-2.0 — its pictures are ours to use commercially).
# Installs only; it never generates. Idempotent: re-running skips what is already there.
#
#   FAE_ART_HOME   where the venv + model live (default ~/.local/share/tgv-fae-art)
#   FAE_ART_MODEL  the Hugging Face repo of the pre-quantized model
#                  (default dhairyashil/FLUX.1-schnell-mflux-4bit, ~9.6 GB)
#   FAE_ART_DISK_FLOOR_GB  refuse when the download would leave less free disk (default 25 — the
#                  same floor build-preflight.sh keeps; a full disk panics this Mac)
set -euo pipefail

HOME_DIR="${FAE_ART_HOME:-$HOME/.local/share/tgv-fae-art}"
REPO="${FAE_ART_MODEL:-dhairyashil/FLUX.1-schnell-mflux-4bit}"
FLOOR="${FAE_ART_DISK_FLOOR_GB:-25}"
MODEL_DIR="$HOME_DIR/models/$(basename "$REPO")"
VENV="$HOME_DIR/venv"
NEED_GB=11 # model + venv, rounded up

[ "$(uname -s)" = Darwin ] && [ "$(uname -m)" = arm64 ] || { echo "STOP: needs an Apple Silicon Mac"; exit 1; }
PY="${FAE_ART_PYTHON:-python3}"
"$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' || { echo "STOP: needs Python 3.11+"; exit 1; }

mkdir -p "$HOME_DIR/models"
free_gb=$(df -g "$HOME_DIR" | awk 'NR==2 {print $4}')
if [ ! -f "$MODEL_DIR/.complete" ] && [ $((free_gb - NEED_GB)) -lt "$FLOOR" ]; then
  echo "STOP: ${free_gb}GB free; the install needs ~${NEED_GB}GB and must leave ${FLOOR}GB. Nothing changed."
  exit 1
fi

if [ ! -x "$VENV/bin/python" ]; then
  echo "· venv → $VENV"
  "$PY" -m venv "$VENV"
fi
if ! "$VENV/bin/python" -c 'import mflux' 2>/dev/null; then
  echo "· pip install mflux"
  "$VENV/bin/pip" install --quiet --upgrade pip
  "$VENV/bin/pip" install --quiet "mflux==0.24.0"
fi

if [ ! -f "$MODEL_DIR/.complete" ]; then
  echo "· model $REPO → $MODEL_DIR"
  HF_HUB_DISABLE_TELEMETRY=1 "$VENV/bin/python" - "$REPO" "$MODEL_DIR" <<'PY'
import sys
from huggingface_hub import snapshot_download
snapshot_download(repo_id=sys.argv[1], local_dir=sys.argv[2])
PY
  touch "$MODEL_DIR/.complete"
fi

du -sh "$VENV" "$MODEL_DIR" | sed 's/^/· /'
echo "READY: engine installed (nothing generated). venv=$VENV model=$MODEL_DIR"

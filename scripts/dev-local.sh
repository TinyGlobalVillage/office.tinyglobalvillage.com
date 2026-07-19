#!/usr/bin/env bash
# Run TGV Office locally on the Mac, fetching DB/Redis live from RCS via SSH tunnel.
#   ./scripts/dev-local.sh
#   then open  http://localhost:3005/api/dev/login  (one-click login, bookmark it)
#
# NOTE: this is a LOCAL-DEV setup. Postgres writes hit PRODUCTION tgv_db (tunneled);
# the data/*.json stores are the Mac's local copy. See scripts/dev-local.README.
set -euo pipefail
cd "$(dirname "$0")/.."

# 1) SSH tunnel: RCS pg -> localhost:15432 (Mac already runs a pg on 5432), redis -> 6379
if ! lsof -iTCP:15432 -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  echo "→ opening SSH tunnel to RCS (pg:15432, redis:6379)…"
  ssh -f -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
      -L 15432:localhost:5432 -L 6379:localhost:6379 rcs
else
  echo "→ tunnel already up on :15432"
fi

# 2) dev server (hot reload). .env.local's DATABASE_URL points at 127.0.0.1:15432.
echo "→ starting next dev on http://localhost:3005"
echo "→ LOG IN:  http://localhost:3005/api/dev/login"
PORT=3005 pnpm dev

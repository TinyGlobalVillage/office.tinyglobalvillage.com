#!/usr/bin/env bash
# Run build.mts's upsert.sql against tgv_db on RCS (network + DB only — no build on RCS).
#   bash push.sh [path/to/upsert.sql]
set -euo pipefail
SQL="${1:-${FAE_OUT:-${TMPDIR:-/tmp}/fae-templates}/upsert.sql}"
HOST="${FAE_RCS_HOST:-rcs}"
OFFICE="${FAE_RCS_OFFICE:-/srv/refusion-core/clients/office.tinyglobalvillage.com}"
REMOTE="/tmp/fae-upsert-$$.sql"
scp -q "$SQL" "$HOST:$REMOTE"
ssh "$HOST" "cd '$OFFICE' && DATABASE_URL=\$(grep -E '^DATABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d '\"') && psql \"\$DATABASE_URL\" -v ON_ERROR_STOP=1 -q -f '$REMOTE'; rc=\$?; rm -f '$REMOTE'; exit \$rc"
echo "pushed $(grep -c '^INSERT' "$SQL") template(s)"

#!/usr/bin/env bash
# =========================================================================
# Rehearse the Refusionist migration (plan 47).
#
# Drops and rebuilds `refusionist_rehearsal` as a full copy of tgv_db, runs
# 00 -> 03 against it, and diffs public row counts before and after. Touches
# tgv_db exactly once, to read it.
#
# Run ON RCS (the database is loopback-only):
#     bash rehearse.sh
#
# tgv_db itself is never written. To apply for real see README.md — the same
# three files, run against tgv_db, with 03-verify.sql first inside a
# rolled-back transaction.
# =========================================================================
set -euo pipefail

SRC_DB="${SRC_DB:-tgv_db}"
REH_DB="${REH_DB:-refusionist_rehearsal}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PSQL=(sudo -n -u postgres psql -v ON_ERROR_STOP=1)
OUT="$(mktemp -d)"

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

counts() {  # $1 = database, $2 = outfile
  "${PSQL[@]}" -q "$1" -F'|' -A -t -c "
    select c.relname,
           (xpath('/row/c/text()', query_to_xml(
              format('select count(*) as c from public.%I', c.relname), false, true, '')))[1]::text::bigint
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'" | LC_ALL=C sort > "$2"
}

say "rebuilding $REH_DB from $SRC_DB"
sudo -n -u postgres psql -q -Atc "drop database if exists ${REH_DB}" >/dev/null
sudo -n -u postgres createdb "$REH_DB" -O tgv_app
sudo -n -u postgres pg_dump --no-owner --no-privileges -d "$SRC_DB" \
  | sudo -n -u postgres psql -q "$REH_DB" >/dev/null

counts "$REH_DB" "$OUT/before.txt"
echo "public tables: $(wc -l < "$OUT/before.txt")"

for step in 00-preflight 01-id-map 02-copy; do
  say "$step"
  "${PSQL[@]}" -q "$REH_DB" -f "$HERE/${step}.sql"
done

# The dump is restored --no-privileges, so the app roles come back with no
# grants and an app pointed at this database gets "permission denied for table
# villager_sites" before it renders a thing. Hand them back, so the rehearsal is
# something you can RUN the renderer against — which is how the cospro half of
# plan 44 was verified, and how the browser pass of plan 38 can be done without
# touching production. Throwaway database; the grants are as broad as that.
say "grants (this is a throwaway database — the app must be able to read it)"
"${PSQL[@]}" -q "$REH_DB" -c "
do \$\$ declare r record; begin
  for r in select rolname from pg_roles where rolname in ('tgv_app','tgv_tenant_app') loop
    execute format('grant usage on schema public to %I', r.rolname);
    execute format('grant select, insert, update, delete on all tables in schema public to %I', r.rolname);
    execute format('grant usage, select on all sequences in schema public to %I', r.rolname);
  end loop;
end \$\$;"

say "03-verify"
"${PSQL[@]}" "$REH_DB" -f "$HERE/03-verify.sql"

counts "$REH_DB" "$OUT/after.txt"

say "what moved (public row counts, before -> after)"
awk -F'|' '
  NR == FNR { b[$1] = $2; next }
  !($1 in b)   { printf "  %-38s %6s -> %-6s  NEW TABLE\n", $1, "-", $2; next }
  b[$1] != $2  { printf "  %-38s %6s -> %-6s  (%+d)\n",    $1, b[$1], $2, $2 - b[$1] }
' "$OUT/before.txt" "$OUT/after.txt"

say "OK — rehearsal green. Nothing in $SRC_DB was written."
rm -rf "$OUT"

// GET  /api/admin/migration-snapshots — overview: policy, snapshots, scratch databases, mapped databases, build releases
// POST /api/admin/migration-snapshots — { action, … } every control in the Rollbacks panel:
//   restore-scratch {path}                  → new restore_* database (safe)
//   restore-in-place {path, confirm=db}     → put the snapshot's tables back (data written since is lost)
//   copy-back {scratch, table, confirm=table} → insert rows missing from the live table (never overwrites)
//   drop-scratch {scratch}
//   snapshot-now {client, db, table?}
//   delete {path, confirm="delete"} · purge
//   policy {destructive?, keepDays?}
//   build-rollback {client, confirm=client} → rcs-promote.sh --rollback (.next ⇄ .next.prev; never the DB)
// Postgres/root work runs in mono utils/scripts/build-pipeline/migration-snapshots.sh (see src/lib/migration-snapshots/state.ts).
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import {
  cli, findSnapshot, installed, listScratch, listSnapshots, mappedDatabases, readPolicy, scratchName, writePolicy,
  CliError, SCRATCH_RE, TABLE_RE, DB_RE, type SnapshotPolicy,
} from "@/lib/migration-snapshots/state";
import { readReleases, releaseTargets, startRollback, SITE_RE } from "@/lib/workshop-deploy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const [snapshots, scratch] = await Promise.all([
    listSnapshots().catch((e) => ({ error: (e as Error).message })),
    listScratch().catch((e) => ({ error: (e as Error).message })),
  ]);
  return NextResponse.json({
    installed: installed(),
    policy: readPolicy(),
    databases: mappedDatabases(),
    snapshots: Array.isArray(snapshots) ? snapshots : [],
    scratch: Array.isArray(scratch) ? scratch : [],
    errors: [snapshots, scratch].filter((x) => !Array.isArray(x)).map((x) => (x as { error: string }).error),
    releases: readReleases().map((r) => ({ client: r.client, follows: r.follows, state: r.state, live: r.live, prev: r.prev, lastRollback: r.lastRollback })),
  });
}

type Body = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const body = (await req.json().catch(() => ({}))) as Body;
  const action = str(body.action);
  const user = gate.username;
  const log = (success: boolean, target: string | null, details?: Record<string, unknown> | string) =>
    logHardeningAction({ action: `migration-snapshots.${action}`, target, user, success, details: details ?? null });

  try {
    switch (action) {
      case "restore-scratch": {
        const s = await findSnapshot(body.path);
        const name = scratchName(s.db);
        const out = await cli(["restore", s.path, "--into", name], 900_000);
        log(true, name, { snapshot: s.path, db: s.db });
        return NextResponse.json({ ok: true, scratch: name, message: out.trim() });
      }
      case "restore-in-place": {
        const s = await findSnapshot(body.path);
        if (str(body.confirm) !== s.db) return NextResponse.json({ error: `type ${s.db} to confirm` }, { status: 400 });
        const out = await cli(["restore", s.path, "--in-place", s.db, "--yes"], 900_000);
        log(true, s.db, { snapshot: s.path, tables: s.tables });
        return NextResponse.json({ ok: true, message: out.trim() });
      }
      case "copy-back": {
        const scratch = str(body.scratch), table = str(body.table);
        if (!SCRATCH_RE.test(scratch) || !TABLE_RE.test(table)) return NextResponse.json({ error: "bad scratch database or table" }, { status: 400 });
        if (str(body.confirm) !== table) return NextResponse.json({ error: `type ${table} to confirm` }, { status: 400 });
        const out = JSON.parse((await cli(["copy-back", scratch, table, "--yes"], 900_000)).trim());
        log(true, `${out.db}.${table}`, { scratch, inserted: out.inserted });
        return NextResponse.json({ ok: true, result: out });
      }
      case "drop-scratch": {
        const scratch = str(body.scratch);
        if (!SCRATCH_RE.test(scratch)) return NextResponse.json({ error: "scratch databases are named restore_*" }, { status: 400 });
        await cli(["drop-scratch", scratch]);
        log(true, scratch);
        return NextResponse.json({ ok: true });
      }
      case "snapshot-now": {
        const client = str(body.client), db = str(body.db), table = str(body.table);
        if (!SITE_RE.test(client) || !DB_RE.test(db) || !(mappedDatabases()[client] ?? []).includes(db)) {
          return NextResponse.json({ error: "not a mapped database" }, { status: 400 });
        }
        if (table && !TABLE_RE.test(table)) return NextResponse.json({ error: "table must be schema.table" }, { status: 400 });
        const args = ["snapshot", "--client", client, "--db", db, "--by", user];
        if (table) args.push("--table", table);
        const out = JSON.parse((await cli(args, 1_800_000)).trim());
        log(true, `${db}${table ? `.${table}` : ""}`, { client, path: out.path, bytes: out.bytes });
        return NextResponse.json({ ok: true, snapshot: out });
      }
      case "delete": {
        const s = await findSnapshot(body.path);
        if (str(body.confirm) !== "delete") return NextResponse.json({ error: "type delete to confirm" }, { status: 400 });
        await cli(["delete", s.path, "--yes"]);
        log(true, s.path, { db: s.db, file: s.file });
        return NextResponse.json({ ok: true });
      }
      case "purge": {
        const out = await cli(["purge"]);
        log(true, null, out.trim());
        return NextResponse.json({ ok: true, message: out.trim() });
      }
      case "policy": {
        const patch: Partial<SnapshotPolicy> = {};
        if ("destructive" in body) patch.destructive = body.destructive as SnapshotPolicy["destructive"];
        if ("keepDays" in body) patch.keepDays = Number(body.keepDays);
        const before = readPolicy();
        const next = writePolicy(patch);
        const changed = (Object.keys(next) as (keyof SnapshotPolicy)[]).filter((k) => before[k] !== next[k]);
        if (changed.length) log(true, null, Object.fromEntries(changed.map((k) => [k, `${before[k]} → ${next[k]}`])));
        return NextResponse.json({ ok: true, policy: next });
      }
      case "build-rollback": {
        const client = str(body.client);
        if (!SITE_RE.test(client) || !releaseTargets().some((t) => t.client === client)) {
          return NextResponse.json({ error: "not a release target" }, { status: 400 });
        }
        if (str(body.confirm) !== client) return NextResponse.json({ error: `type ${client} to confirm` }, { status: 400 });
        startRollback(client, user);
        // Same audit action as Releases → Rollback, so both surfaces read as one history.
        logHardeningAction({ action: "deploy.rollback", target: client, user, success: true, details: { from: "rollbacks-panel" } });
        return NextResponse.json({ ok: true, starting: true });
      }
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e) {
    const msg = (e as Error).message;
    log(false, null, msg);
    return NextResponse.json({ error: msg }, { status: e instanceof CliError ? 409 : 500 });
  }
}

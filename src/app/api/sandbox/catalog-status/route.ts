// /api/sandbox/catalog-status — component-library canon, P3 (the ratification surface).
//
// Gio 2026-08-02: a new atom group is a PROPOSAL until he and Marthe have gone
// over it and ratified it. This route is where that ruling is recorded.
//
// Storage: `catalog_entries` in tgv_db (migration 0136, tinyglobalvillage.com).
// The row holds the DECISION only — status plus who/when. The tuned DEFAULTS keep
// living in `content_overrides` under `block-default:<catalogId>`, written by the
// sibling /api/sandbox/block-default route. Ratifying is therefore two calls the
// UI makes in order: deploy the defaults, then flip the status. Props have one
// home, the verdict has another.
//
// Raw parameterized SQL via pgPool, for the same reasons block-default gives:
// Office has no injected drizzle schema for this table. The module-side accessor
// (@tgv/module-page-editor editor/component-library/ratification.ts) is the same
// semantics for drizzle consumers; keep the two in step.
//
// STORED ROWS ONLY. A catalog entry with no row is not missing — it takes its
// birth state from code (`ComponentEntry.proposed`), which is how the pre-gate
// catalog stays grandfathered as canon with no backfill. The client already holds
// the registry, so it unions the two halves; keeping the registry out of this
// route keeps a server bundle from importing every component in the library.
//
//   GET  ?id=<catalogId>  → { rows: [row] | [] }   one entry
//   GET                   → { rows: [...] }        every stored ruling
//   POST {id, action, note?} → propose | ratify | send-back
//
// WHO ratified (decision 3 — any TGV admin may, and the row records who): Office
// authenticates a staff USERNAME, while the audit columns are members.id uuids
// per house style. `resolveAdminActorId` is the house resolver for exactly that
// hop (roster email → members.id, same one admin_audit_log uses). An office-only
// staffer with no member account stores NULL there and still stamps the timestamp;
// the people who actually hold this call are members.

import { type NextRequest, NextResponse } from "next/server";
import { resolveAdminActorId } from "@/lib/admin-actor";
import { requireAdmin } from "@/lib/api-admin";
import { pgPool } from "@/lib/pg-pool";

export const runtime = "nodejs";

const ID_RE = /^[a-z0-9][a-z0-9-]{0,80}$/i; // catalog ids are kebab-case
const MAX_NOTE = 2000;

type Action = "propose" | "ratify" | "send-back";

function validId(id: unknown): id is string {
  return typeof id === "string" && ID_RE.test(id);
}

const SELECT_COLS = `catalog_id AS "catalogId", status,
  proposed_by AS "proposedBy", proposed_at AS "proposedAt",
  ratified_by AS "ratifiedBy", ratified_at AS "ratifiedAt",
  sent_back_by AS "sentBackBy", sent_back_at AS "sentBackAt",
  note, updated_at AS "updatedAt"`;


export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const id = new URL(req.url).searchParams.get("id");
  if (id !== null && !validId(id))
    return NextResponse.json({ error: "bad id" }, { status: 400 });

  try {
    const r = id
      ? await pgPool.query(
          `SELECT ${SELECT_COLS} FROM catalog_entries WHERE catalog_id = $1`,
          [id],
        )
      : await pgPool.query(
          `SELECT ${SELECT_COLS} FROM catalog_entries ORDER BY catalog_id`,
        );
    return NextResponse.json({ rows: r.rows });
  } catch {
    // Migration 0136 not applied here yet — an empty ruling set is the truthful
    // answer, and the client's code-derived half still fills the lane.
    return NextResponse.json({ rows: [] });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => null)) as
    | { id?: string; action?: string; note?: string }
    | null;
  if (!body || !validId(body.id))
    return NextResponse.json({ error: "bad id" }, { status: 400 });

  const action = body.action as Action;
  if (action !== "propose" && action !== "ratify" && action !== "send-back")
    return NextResponse.json({ error: "bad action" }, { status: 400 });

  // A send-back with nothing to say is the one thing this surface must refuse:
  // the note is the whole point of returning it.
  const note = typeof body.note === "string" ? body.note.trim().slice(0, MAX_NOTE) : "";
  if (action === "send-back" && !note)
    return NextResponse.json({ error: "a send-back needs a note" }, { status: 400 });

  const actor = await resolveAdminActorId(gate.username);

  try {
    if (action === "ratify") {
      // Clears the note — the objection has been answered.
      await pgPool.query(
        `INSERT INTO catalog_entries (catalog_id, status, ratified_by, ratified_at, updated_at)
           VALUES ($1, 'ratified', $2, now(), now())
         ON CONFLICT (catalog_id) DO UPDATE SET
           status = 'ratified', ratified_by = EXCLUDED.ratified_by,
           ratified_at = EXCLUDED.ratified_at, note = NULL, updated_at = now()`,
        [body.id, actor],
      );
    } else if (action === "send-back") {
      await pgPool.query(
        `INSERT INTO catalog_entries
           (catalog_id, status, sent_back_by, sent_back_at, note, updated_at)
           VALUES ($1, 'proposed', $2, now(), $3, now())
         ON CONFLICT (catalog_id) DO UPDATE SET
           status = 'proposed', sent_back_by = EXCLUDED.sent_back_by,
           sent_back_at = EXCLUDED.sent_back_at, note = EXCLUDED.note, updated_at = now()`,
        [body.id, actor, note],
      );
    } else {
      // propose — idempotent; keeps the FIRST proposer rather than overwriting it.
      await pgPool.query(
        `INSERT INTO catalog_entries (catalog_id, status, proposed_by, proposed_at, updated_at)
           VALUES ($1, 'proposed', $2, now(), now())
         ON CONFLICT (catalog_id) DO UPDATE SET
           status = 'proposed',
           proposed_by = COALESCE(catalog_entries.proposed_by, EXCLUDED.proposed_by),
           proposed_at = COALESCE(catalog_entries.proposed_at, EXCLUDED.proposed_at),
           updated_at = now()`,
        [body.id, actor],
      );
    }
  } catch (e) {
    // Writes are LOUD on purpose: a ratify that silently no-ops is worse than one
    // that fails in the open.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "write failed" },
      { status: 500 },
    );
  }

  const r = await pgPool.query(
    `SELECT ${SELECT_COLS} FROM catalog_entries WHERE catalog_id = $1`,
    [body.id],
  );
  return NextResponse.json({ ok: true, row: r.rows[0] ?? null });
}

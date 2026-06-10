// /api/sandbox/block-default — Phase 2 (data lane) of office-sandbox-catalog-mirror.
//
// The DATA pathway of the sandbox three-way deploy: edit a catalog block's
// DEFAULT props, persist a draft, then publish so every tenant that renders the
// block FROM DEFAULTS picks up the new content (the live cascade).
//
// Storage: the existing `content_overrides` table in tgv_db (NO migration —
// key varchar(64)/data jsonb/mode/user_id already fit), keyed
// `block-default:<catalogId>`. v1 = PLATFORM defaults only (user_id IS NULL).
// Raw parameterized SQL via pgPool — no drizzle table handle (content_overrides
// is not in @tgv/module-registry/db; this also dodges the cross-bundle Column bug).
//
//   GET  ?id=<catalogId>&mode=draft|published&lang=en  → the override row (or {exists:false})
//   PUT  {id, lang?, data}                              → save/replace the DRAFT (persist, no deploy)
//   POST {id, lang?}                                    → publish: copy DRAFT → PUBLISHED (deploy:data)
//   DELETE ?id=&lang=&mode=                             → drop override(s) → revert to in-code default
//
// The resolver that READS these rows on the render path lives in
// @tgv/module-page-editor: editor/defaults/resolveBlockDefaults.ts (key namespace shared).

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { pgPool } from "@/lib/pg-pool";

export const runtime = "nodejs";

const KEY_PREFIX = "block-default:";
const ID_RE = /^[a-z0-9][a-z0-9-]{0,80}$/i; // catalog ids are kebab-case
const LANG_RE = /^[a-z]{2}(-[a-z]{2})?$/i;

function keyFor(id: string) {
  return `${KEY_PREFIX}${id}`;
}

function validId(id: unknown): id is string {
  return typeof id === "string" && ID_RE.test(id);
}

/** Manual upsert (no unique index on key/lang/mode/user_id; user_id IS NULL makes
 *  ON CONFLICT awkward) — UPDATE then INSERT-if-missing, in one txn. */
async function upsertOverride(
  key: string,
  lang: string,
  mode: "draft" | "published",
  data: unknown,
): Promise<void> {
  const json = JSON.stringify(data ?? {});
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const upd = await client.query(
      `UPDATE content_overrides SET data = $1::jsonb, updated_at = now()
         WHERE key = $2 AND lang = $3 AND mode = $4 AND user_id IS NULL`,
      [json, key, lang, mode],
    );
    if (upd.rowCount === 0) {
      await client.query(
        `INSERT INTO content_overrides (key, lang, mode, user_id, data, updated_at)
           VALUES ($1, $2, $3, NULL, $4::jsonb, now())`,
        [key, lang, mode, json],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function readOverride(
  key: string,
  lang: string,
  mode: "draft" | "published",
): Promise<{ data: unknown; updatedAt: string } | null> {
  const r = await pgPool.query(
    `SELECT data, updated_at FROM content_overrides
       WHERE key = $1 AND lang = $2 AND mode = $3 AND user_id IS NULL
       ORDER BY updated_at DESC LIMIT 1`,
    [key, lang, mode],
  );
  if (r.rowCount === 0) return null;
  return { data: r.rows[0].data, updatedAt: r.rows[0].updated_at };
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const lang = url.searchParams.get("lang") ?? "en";
  const mode = (url.searchParams.get("mode") ?? "published") as "draft" | "published";
  if (!validId(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  if (!LANG_RE.test(lang)) return NextResponse.json({ error: "bad lang" }, { status: 400 });
  if (mode !== "draft" && mode !== "published")
    return NextResponse.json({ error: "bad mode" }, { status: 400 });

  const row = await readOverride(keyFor(id), lang, mode);
  return NextResponse.json(
    row ? { id, lang, mode, exists: true, data: row.data, updatedAt: row.updatedAt } : { id, lang, mode, exists: false, data: null },
  );
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => null)) as { id?: string; lang?: string; data?: unknown } | null;
  if (!body || !validId(body.id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const lang = body.lang ?? "en";
  if (!LANG_RE.test(lang)) return NextResponse.json({ error: "bad lang" }, { status: 400 });
  if (body.data === null || typeof body.data !== "object")
    return NextResponse.json({ error: "data must be an object (the COMPLETE props — renderer uses whole-object fallback)" }, { status: 400 });

  await upsertOverride(keyFor(body.id), lang, "draft", body.data);
  return NextResponse.json({ id: body.id, lang, mode: "draft", saved: true });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => null)) as { id?: string; lang?: string } | null;
  if (!body || !validId(body.id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const lang = body.lang ?? "en";
  if (!LANG_RE.test(lang)) return NextResponse.json({ error: "bad lang" }, { status: 400 });

  const draft = await readOverride(keyFor(body.id), lang, "draft");
  if (!draft) return NextResponse.json({ error: "no draft to publish" }, { status: 400 });

  await upsertOverride(keyFor(body.id), lang, "published", draft.data);
  return NextResponse.json({ id: body.id, lang, mode: "published", published: true });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const lang = url.searchParams.get("lang") ?? "en";
  const mode = url.searchParams.get("mode"); // optional: drop just one mode
  if (!validId(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  if (!LANG_RE.test(lang)) return NextResponse.json({ error: "bad lang" }, { status: 400 });

  if (mode && mode !== "draft" && mode !== "published")
    return NextResponse.json({ error: "bad mode" }, { status: 400 });

  const r = mode
    ? await pgPool.query(
        `DELETE FROM content_overrides WHERE key=$1 AND lang=$2 AND mode=$3 AND user_id IS NULL`,
        [keyFor(id), lang, mode],
      )
    : await pgPool.query(
        `DELETE FROM content_overrides WHERE key=$1 AND lang=$2 AND user_id IS NULL`,
        [keyFor(id), lang],
      );
  return NextResponse.json({ id, lang, deleted: r.rowCount ?? 0, revertedToInCodeDefault: true });
}

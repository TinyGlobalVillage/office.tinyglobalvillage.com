// RCS side of `move.mts` — runs inside the Office checkout on RCS with Office's .env.local:
//   node --env-file=.env.local /tmp/fae-cast/rcs-move.mjs /tmp/fae-cast/job.json
// Files each character picture into the HOUSE gallery (the rows Office's gallery and the TGV dashboard
// gallery read), public, inside "Template Sites" › "<NNN Brand>", and each site's prompt doc into the
// house Doc Editor library under the same two folders. Prints one JSON line per picture / doc.
// Network + DB only — no build work on RCS. Re-runnable: folders and docs are found before they are made.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire, register } from "node:module";

// The @tgv dists are emitted for a bundler (extensionless relative imports) — fill in ".js" for plain node.
register(
  "data:text/javascript," +
    encodeURIComponent(`
      export async function resolve(spec, ctx, next) {
        try { return await next(spec, ctx); } catch (e) {
          if (!["ERR_MODULE_NOT_FOUND", "ERR_UNSUPPORTED_DIR_IMPORT"].includes(e?.code) || !/^\\.{1,2}\\//.test(spec)) throw e;
          try { return await next(spec + ".js", ctx); } catch { return next(spec + "/index.js", ctx); }
        }
      }`),
);

const OFFICE = process.cwd();
const req = createRequire(path.join(OFFICE, "package.json"));
const { Pool } = req("pg");
const S = await import(req.resolve("@tgv/module-storage/server"));

const HOUSE_DOMAIN = process.env.FAE_HOUSE_DOMAIN || "tinyglobalvillage.com";
const SHARE_ORIGIN = process.env.FAE_SHARE_ORIGIN || `https://${HOUSE_DOMAIN}`;
const job = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
const ROOT = job.root || "Template Sites";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

const r = await pool.query(
  `SELECT vs.id AS site_id, v.member_id, m.role
     FROM villager_sites vs
     JOIN villager v ON v.site_id = vs.id AND v.status IN ('registered','active')
     JOIN members m  ON m.id = v.member_id
    WHERE lower(vs.domain) = $1
    ORDER BY v.created_at ASC LIMIT 1`,
  [HOUSE_DOMAIN],
);
const row = r.rows[0];
if (!row) throw new Error(`no house site for ${HOUSE_DOMAIN}`);
const scope = {
  tenantSlug: HOUSE_DOMAIN.split(".")[0],
  siteId: String(row.site_id),
  memberId: String(row.member_id),
  role: row.role === "superadmin" ? "superadmin" : row.role === "admin" ? "admin" : "member",
};

const adapter = S.createStorageR2AdapterFromEnv();
if (!adapter) throw new Error("R2 env incomplete — refusing to fall back to disk for shared pictures");
const storage = S.createStorageHandlers({
  adapter,
  cdnBaseUrl: process.env.CDN_BASE_URL ?? "https://office.tinyglobalvillage.com/media",
  pool,
  resolveScope: async () => scope,
  quota: S.createPgQuotaProvider({ pool, resolveTier: async () => "plus" }),
  readBasePath: "/api/storage/file",
});

// ── gallery folders: Template Sites › <site>. Nesting is storage 0131's parent_id. ──
const hasParent = (await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name='storage_collections' AND column_name='parent_id'`)).rowCount > 0;
if (!hasParent) throw new Error("storage_collections.parent_id missing — apply storage migration 0131 first");
let cols = await S.listCollections(pool, scope);
async function collection(name, parentId, description) {
  let c = cols.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!c) {
    c = await S.insertCollection(pool, scope, { name, description });
    cols.push(c);
  }
  if (parentId && c.parent_id !== parentId) {
    await pool.query(`UPDATE public.storage_collections SET parent_id = $1, updated_at = now() WHERE id = $2 AND site_id = $3`, [parentId, c.id, scope.siteId]);
    c.parent_id = parentId;
  }
  return c;
}
const rootCol = await collection(ROOT, null, "Our own fae characters for the template gallery — one folder per template site. Registry: office docs/template-gallery/cast-registry.json");

for (const item of job.items ?? []) {
  try {
    const col = await collection(item.folder, rootCol.id, `Characters for the ${item.brand} template (${item.templateId}).`);
    const buf = await fs.readFile(item.path);
    const file = new File([buf], item.filename, { type: item.contentType });
    const res = await storage.storeFile(scope, file, "fae-templates", { visibility: "public" });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
    const id = body.file.id;
    await S.updateFileMeta(pool, scope, id, { title: item.title, tags: item.tags });
    await S.addFilesToCollection(pool, scope, col.id, [id]);
    if (item.cover) await S.updateCollection(pool, scope, col.id, { coverFileId: id });
    const token = await storage.ensureShareToken(scope, id);
    if (!token) throw new Error("no share token minted");
    console.log(JSON.stringify({ ok: true, key: item.key, fileId: id, collectionId: col.id, url: `${SHARE_ORIGIN}/api/storage/shared/${token}/` }));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, key: item.key, error: String(e?.message ?? e) }));
  }
}

// ── Doc Editor: the same two folders in the house library, one page per site (found by title, then updated). ──
const owner = scope.memberId;
const ownerKind = (await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name='docs_documents' AND column_name='owner_kind'`)).rowCount > 0;
async function docFolder(name, parentId) {
  const f = await pool.query(
    `SELECT id FROM docs_folders WHERE site_id=$1 AND owner_id=$2 AND lower(name)=lower($3) AND parent_id IS NOT DISTINCT FROM $4::uuid AND trashed_at IS NULL LIMIT 1`,
    [scope.siteId, owner, name, parentId],
  );
  if (f.rows[0]) return f.rows[0].id;
  const n = await pool.query(`INSERT INTO docs_folders (site_id, owner_id, parent_id, name, color, sort) VALUES ($1,$2,$3,$4,'pink',0) RETURNING id`, [scope.siteId, owner, parentId, name]);
  return n.rows[0].id;
}
if ((job.docs ?? []).length) {
  const rootFolder = await docFolder(ROOT, null);
  for (const d of job.docs) {
    try {
      const folder = await docFolder(d.folder, rootFolder);
      const found = await pool.query(`SELECT id FROM docs_documents WHERE site_id=$1 AND owner_id=$2 AND folder_id=$3 AND title=$4 AND lifecycle='active' LIMIT 1`, [scope.siteId, owner, folder, d.title]);
      let id = found.rows[0]?.id;
      if (id) {
        await pool.query(
          `UPDATE docs_documents SET content=$2::jsonb, plain_text=$3, word_count=$4, version=version+1, updated_at=now(), last_edited_by=$5 WHERE id=$1`,
          [id, JSON.stringify(d.content), d.plainText, d.count, owner],
        );
      } else {
        const q = await pool.query(
          `INSERT INTO docs_documents (site_id, owner_id, folder_id, kind, title, icon, content, plain_text, word_count, last_edited_by${ownerKind ? ", owner_kind" : ""})
           VALUES ($1,$2,$3,'page'::docs_kind,$4,$5,$6::jsonb,$7,$8,$2${ownerKind ? ",'member'" : ""}) RETURNING id`,
          [scope.siteId, owner, folder, d.title, d.icon ?? null, JSON.stringify(d.content), d.plainText, d.count],
        );
        id = q.rows[0].id;
      }
      console.log(JSON.stringify({ ok: true, doc: d.siteKey, docId: id, folderId: folder, updated: Boolean(found.rows[0]) }));
    } catch (e) {
      console.log(JSON.stringify({ ok: false, doc: d.siteKey, error: String(e?.message ?? e) }));
    }
  }
}
await pool.end();

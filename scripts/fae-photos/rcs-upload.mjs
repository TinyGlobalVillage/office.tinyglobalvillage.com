// RCS side of the fae photo pool — runs inside the Office checkout on RCS with Office's .env.local:
//   node --env-file=.env.local /tmp/fae-photos/rcs-upload.mjs /tmp/fae-photos/job.json
// Deposits each prepared image into the HOUSE gallery (the same rows Office's gallery and the HQ
// dashboard gallery read), public, inside the "Fae Template Photos" collection, and prints one JSON
// line per file with its stable share link. Network + DB only — no build work on RCS.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire, register } from "node:module";

// The @tgv dists are emitted for a bundler (extensionless relative imports). Plain node needs the
// ".js" / "/index.js" filled in — this hook does only that.
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
const COLLECTION = process.env.FAE_COLLECTION || "Fae Template Photos";

const job = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
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

let adapter = S.createStorageR2AdapterFromEnv();
if (!adapter) throw new Error("R2 env incomplete — refusing to fall back to disk for shared photos");
const storage = S.createStorageHandlers({
  adapter,
  cdnBaseUrl: process.env.CDN_BASE_URL ?? "https://office.tinyglobalvillage.com/media",
  pool,
  resolveScope: async () => scope,
  quota: S.createPgQuotaProvider({ pool, resolveTier: async () => "plus" }),
  readBasePath: "/api/storage/file",
});

const cols = await S.listCollections(pool, scope);
const col = cols.find((c) => c.name === COLLECTION) ?? (await S.insertCollection(pool, scope, {
  name: COLLECTION,
  description: "Free-licence (CC0 / public domain) photos used by the fae template gallery. Ledger: office docs/template-gallery/photo-ledger.json",
}));

// Retire: delete files from the gallery (storage row, R2 object, quota, share grants) — `job.remove: [fileId]`.
for (const id of job.remove ?? []) {
  const res = await storage.remove(new Request("http://local/"), id);
  console.log(JSON.stringify({ ok: res.ok, removed: id, status: res.status }));
}

for (const item of job.items ?? []) {
  try {
    const buf = await fs.readFile(item.path);
    const file = new File([buf], item.filename, { type: item.contentType });
    const res = await storage.storeFile(scope, file, "fae-templates", { visibility: "public" });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
    const id = body.file.id;
    await S.updateFileMeta(pool, scope, id, { title: item.title, tags: item.tags });
    await S.addFilesToCollection(pool, scope, col.id, [id]);
    const token = await storage.ensureShareToken(scope, id);
    if (!token) throw new Error("no share token minted");
    console.log(JSON.stringify({ ok: true, key: item.key, fileId: id, url: `${SHARE_ORIGIN}/api/storage/shared/${token}` }));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, key: item.key, error: String(e?.message ?? e) }));
  }
}
await pool.end();

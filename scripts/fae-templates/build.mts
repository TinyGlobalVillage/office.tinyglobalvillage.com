// Build fae gallery templates from specs → bundle JSON + an upsert SQL file, checked against the editor's
// own sanitizer (anything the sanitizer would drop is reported, so a template never loses a field silently).
//
//   node_modules/.bin/tsx clients/office.tinyglobalvillage.com/scripts/fae-templates/build.mts 2247d9b7 [more keys…] [--record]
//
// Output: $FAE_OUT (default $TMPDIR/fae-templates)/<templateId>.json + upsert.sql
// --record writes the photo uses into docs/template-gallery/photo-ledger.json (refuses a 6th site per photo;
// our own drawn art — source "original" — is not capped) and marks the templates "built" in progress.json.
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeModelLayers } from '../../../../packages/@tgv/module-core/module-page-editor/editor/paint/validateModel.ts';
import { buildTemplate, type Ledger, type TemplateSpec } from './kit.ts';

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, '../../docs/template-gallery');
const ledgerPath = join(docs, 'photo-ledger.json');
const progressPath = join(docs, 'progress.json');
const out = process.env.FAE_OUT ?? join(tmpdir(), 'fae-templates');
mkdirSync(out, { recursive: true });

const args = process.argv.slice(2);
const record = args.includes('--record');
const keys = args.filter((a) => !a.startsWith('--'));
if (!keys.length) throw new Error('usage: build.mts <specKey…> [--record]');

const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as Ledger & { maxUses: number; photos: Record<string, { uses: string[]; source?: string }> };
const progress = JSON.parse(readFileSync(progressPath, 'utf8')) as { templates: Record<string, Record<string, unknown>> }; // keyed by reference key

/** Every leaf path in a JSON value. */
function leaves(v: unknown, p = '', acc = new Set<string>()): Set<string> {
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) leaves(x, `${p}.${k}`, acc);
    if (Array.isArray(v) && !v.length) acc.add(p);
  } else acc.add(`${p}=${JSON.stringify(v)}`);
  return acc;
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const dq = (s: string) => {
  if (s.includes('$fae$')) throw new Error('payload contains the dollar-quote tag');
  return `$fae$${s}$fae$`;
};

const sql: string[] = ['BEGIN;'];
for (const key of keys) {
  const spec = (await import(join(here, 'specs', `${key}.ts`))).default as TemplateSpec;
  const built = buildTemplate(spec, ledger, randomUUID);
  let lost = 0;
  for (const p of built.pages) {
    const before = leaves(p.model);
    const clean = sanitizeModelLayers(structuredClone(p.model));
    const after = leaves(clean);
    // defaults the sanitizer omits on purpose (false / 0 / "" / paintFrame / plus sign) are not losses
    const dropped = [...before].filter((x) => !after.has(x) && !/=(false|0|"")$|paintFrame=true$|fold\.sign="plus"$/.test(x));
    p.model = clean;
    if (dropped.length) {
      lost += dropped.length;
      console.warn(`${key}/${p.slug}: sanitizer drops ${dropped.length}:\n  ${dropped.slice(0, 12).join('\n  ')}`);
    }
  }
  const landing = built.pages[0];
  const bundle = { v: 2, origin: 'authored', source: 'draft', site: built.templateId, capturedAt: new Date().toISOString(), landingSlug: landing.slug, pages: built.pages };
  writeFileSync(join(out, `${built.templateId}.json`), JSON.stringify(bundle, null, 1));
  const species = built.site.cast.mode === 'single' ? [built.site.cast.species] : ['collective', ...built.site.cast.species];
  const tags = ['fae', spec.industry, ...species, `ref:${spec.ref}`];
  const label = built.site.brand;
  const desc = `${spec.description} ${built.pages.length} pages.`;
  const model = JSON.stringify(landing.model);
  const bj = JSON.stringify(bundle);
  const tagSql = `ARRAY[${tags.map(q).join(',')}]::text[]`;
  sql.push(
    `UPDATE shared_templates SET label=${q(label)}, description=${q(desc)}, category=${q(spec.category)}, suggested_slug=${q(landing.slug)}, suggested_title=${q(landing.title)}, kind='bundle', model_json=${dq(model)}::jsonb, bundle_json=${dq(bj)}::jsonb, tags=${tagSql}, updated_at=now(), deleted_at=NULL WHERE template_id=${q(built.templateId)};`,
    `INSERT INTO shared_templates (template_id,label,description,category,suggested_slug,suggested_title,status,kind,model_json,bundle_json,tags) SELECT ${q(built.templateId)},${q(label)},${q(desc)},${q(spec.category)},${q(landing.slug)},${q(landing.title)},'sandbox','bundle',${dq(model)}::jsonb,${dq(bj)}::jsonb,${tagSql} WHERE NOT EXISTS (SELECT 1 FROM shared_templates WHERE template_id=${q(built.templateId)});`,
  );
  console.log(`${built.templateId}  ${label}  pages=${built.pages.map((p) => `${p.slug}:${p.model.sections.length}`).join(',')}  photos=${built.used.join(',')}  bytes=${bj.length}${lost ? `  LOST=${lost}` : ''}`);
  if (record) {
    // a pick this template no longer shows (its own cast art took the slot) gives its use back to the pool
    for (const [k, ph] of Object.entries(ledger.photos)) if (!built.used.includes(k) && ph.uses.includes(built.templateId)) ph.uses = ph.uses.filter((u) => u !== built.templateId);
    for (const k of built.used) {
      const ph = ledger.photos[k];
      if (ph.uses.includes(built.templateId)) continue;
      if (ph.source !== 'original' && ph.uses.length >= ledger.maxUses) throw new Error(`${k} already on ${ph.uses.length} sites`);
      ph.uses.push(built.templateId);
    }
    const row = Object.values(progress.templates).find((t) => t.templateId === built.templateId);
    if (row) {
      row.status = 'built';
      row.pages = built.pages.map((p) => p.slug);
      row.photos = built.used;
      row.brand = label;
      row.cast = species.join('+');
    }
  }
}
sql.push('COMMIT;');
writeFileSync(join(out, 'upsert.sql'), sql.join('\n') + '\n');
if (record) {
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
  writeFileSync(progressPath, JSON.stringify(progress, null, 2) + '\n');
}
console.log(`→ ${out}/upsert.sql`);

// Move finished character art onto TGV (CHARACTERS-PLAN stage 4) — Mac side.
//
//   node_modules/.bin/tsx clients/office.tinyglobalvillage.com/scripts/fae-art/characters/move.mts [--sites 1-73] [--dry]
//
// For every rendered picture of the chosen sites (default: every elf / gnome site — faery sites stay
// paused): a web JPEG with its SEO filename goes into the house gallery under "Template Sites" ›
// "<NNN Brand>", titled with its alt text and tagged; each site's prompt doc becomes a Doc Editor page in
// the same two folders. The ledger (docs/template-gallery/photo-ledger.json) gets one `source: original`
// entry per picture with a `cast` block — the kit reads that to put the site's own characters on its
// pages. Re-runnable: pictures already in the ledger are skipped, docs are updated in place.
// RCS work (rcs-move.mjs) is network + DB only. Needs storage migration 0131 (gallery sub-folders) on tgv_db.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseNotionPage } from '../../../../../packages/@tgv/module-core/module-docs/dashboard/import/notionMarkdown.ts';
import { countWords, sanitizeDoc, toPlainText } from '../../../../../packages/@tgv/module-core/module-docs/lib/docModel.ts';
import { buildTemplate, type Ledger, type TemplateSpec } from '../../fae-templates/kit.ts';

// cast.mts's slugify (importing cast.mts would run its command line)
const slugify = (s: string) =>
  s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS = join(HERE, '../../../docs/template-gallery');
const REGISTRY = join(DOCS, 'cast-registry.json');
const LEDGER = join(DOCS, 'photo-ledger.json');
const HOME = process.env.FAE_ART_HOME ?? join(homedir(), '.local/share/tgv-fae-art');
const SITES_DIR = join(HOME, 'Template Sites');
const RCS_HOST = process.env.FAE_RCS_HOST || 'rcs';
const RCS_OFFICE = process.env.FAE_RCS_OFFICE || '/srv/refusion-core/clients/office.tinyglobalvillage.com';
const WORK = join(process.env.FAE_SCRATCH ?? join(tmpdir(), 'fae-cast'), 'move');
const BATCH = 40;

type Pic = { no: number; kind: 'portrait' | 'scene'; title: string; file: string; alt: string; seed: number; tags: string[]; character?: { name: string; species: string; gender: string; role: string } };
type Site = { n: number; key: string; templateId: string; brand: string; slug: string; folder: string; industry: string; cast: string; style: string; stage?: string; pictures: Pic[] };
type Entry = Record<string, unknown> & { url: string; uses: string[]; tags?: string[]; source?: string };

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const sitesArg = args[args.indexOf('--sites') + 1];
const pick = (s: string | undefined) => {
  if (!s || !args.includes('--sites')) return null;
  const set = new Set<number>();
  for (const part of s.split(',')) {
    const [a, b] = part.split('-').map(Number);
    for (let i = a; i <= (b || a); i++) set.add(i);
  }
  return set;
};
const only = pick(sitesArg);
const hasFaeries = (s: Site) => s.cast === 'faerie' || s.cast === 'collective';

const reg = JSON.parse(readFileSync(REGISTRY, 'utf8')) as { sites: Site[] };
const ledger = JSON.parse(readFileSync(LEDGER, 'utf8')) as Ledger & { photos: Record<string, Entry> };
const saveLedger = () => {
  const photos = Object.fromEntries(Object.entries(ledger.photos).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(LEDGER, JSON.stringify({ ...ledger, photos }, null, 2) + '\n');
};

/** The ledger key a picture gets: the founder's scene `a-scene-<key>` (a second take `-2`), a portrait `a-<key>-<name>`. */
function keyOf(s: Site, p: Pic): string {
  if (p.kind === 'scene') {
    const take = /\(take (\d+)\)/.exec(p.title)?.[1];
    return `a-scene-${s.key}${take ? `-${take}` : ''}`;
  }
  return `a-${s.key}-${slugify(p.character?.name ?? p.title)}`;
}

/** Which drawn face (`a-elf-2`) each portrait stands in for: the template's faces in first-use order, as cast.mts init named them. */
async function facesOf(s: Site): Promise<string[]> {
  const spec = (await import(join(HERE, '../../fae-templates/specs', `${s.key}.ts`))).default as TemplateSpec;
  const b = buildTemplate(spec, structuredClone(ledger), randomUUID, { cast: false });
  return b.used.filter((k) => /^a-(elf|gnome|faerie)-\d+$/.test(k));
}

const sites = reg.sites.filter((s) => (only ? only.has(s.n) : !hasFaeries(s)));
const items: Record<string, unknown>[] = [];
const docs: Record<string, unknown>[] = [];
const meta = new Map<string, Entry>();
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

for (const s of sites) {
  const pics = s.pictures.filter((p) => existsSync(join(SITES_DIR, s.folder, p.file)));
  if (pics.length < s.pictures.length) console.warn(`${s.folder}: ${s.pictures.length - pics.length} picture(s) not rendered — moving the rest`);
  const faces = await facesOf(s);
  const portraits = s.pictures.filter((p) => p.kind === 'portrait');
  if (faces.length !== portraits.length) console.warn(`${s.folder}: ${faces.length} faces vs ${portraits.length} portraits — faces left unmapped`);
  const sceneFirst = pics.find((p) => p.kind === 'scene');
  for (const p of pics) {
    const key = keyOf(s, p);
    if (ledger.photos[key]?.fileId) continue; // already on TGV
    const src = join(SITES_DIR, s.folder, p.file);
    const jpg = p.file.replace(/\.png$/, '.jpg');
    const out = join(WORK, `${key}.jpg`);
    execFileSync('magick', [src, '-strip', '-quality', '88', out]);
    const [w, h] = execFileSync('magick', ['identify', '-format', '%w %h', out]).toString().trim().split(' ').map(Number);
    const face = p.kind === 'portrait' && faces.length === portraits.length ? faces[portraits.indexOf(p)] : undefined;
    items.push({
      key,
      path: `/tmp/fae-cast/${key}.jpg`,
      filename: jpg,
      contentType: 'image/jpeg',
      title: p.alt.slice(0, 200),
      tags: ['fae-template', 'fae-art', 'license:original', ...p.tags],
      folder: s.folder,
      brand: s.brand,
      templateId: s.templateId,
      cover: p === sceneFirst,
    });
    meta.set(key, {
      id: key,
      url: '',
      width: w,
      height: h,
      tags: p.kind === 'scene' ? ['character', 'scene', `tpl-${s.key}`] : ['avatar', 'portrait', 'character', `tpl-${s.key}`],
      title: p.title,
      alt: p.alt,
      filename: jpg,
      source: 'original',
      sourceId: `cast:${s.key}:${p.no}`,
      provider: 'tgv',
      license: 'original',
      licenseUrl: null,
      creator: 'Tiny Global Village',
      landing: null,
      cast: { site: s.key, no: p.no, kind: p.kind, ...(face ? { face } : {}), ...(p.character ? { name: p.character.name, species: p.character.species, gender: p.character.gender, role: p.character.role } : {}) },
      uses: [],
    });
  }
  const md = join(SITES_DIR, s.folder, `${s.slug}-image-prompts.md`);
  if (existsSync(md)) {
    const page = parseNotionPage(readFileSync(md, 'utf8'));
    const content = sanitizeDoc(page.body);
    const plainText = toPlainText(content);
    docs.push({ siteKey: s.key, folder: s.folder, title: page.title ?? `${s.brand} — image prompts`, icon: '🧝', content, plainText, count: countWords(plainText) });
  }
}

console.log(`${sites.length} sites · ${items.length} pictures to upload · ${docs.length} prompt docs`);
if (dry) process.exit(0);

function run(job: object, files: string[]): Record<string, unknown>[] {
  writeFileSync(join(WORK, 'job.json'), JSON.stringify(job));
  copyFileSync(join(HERE, 'rcs-move.mjs'), join(WORK, 'rcs-move.mjs'));
  execFileSync('ssh', [RCS_HOST, 'rm -rf /tmp/fae-cast && mkdir -p /tmp/fae-cast']);
  execFileSync('scp', ['-q', join(WORK, 'job.json'), join(WORK, 'rcs-move.mjs'), ...files, `${RCS_HOST}:/tmp/fae-cast/`]);
  const stdout = execFileSync('ssh', [RCS_HOST, `cd ${RCS_OFFICE} && node --env-file=.env.local /tmp/fae-cast/rcs-move.mjs /tmp/fae-cast/job.json; rm -rf /tmp/fae-cast`], { maxBuffer: 1 << 26 }).toString();
  return stdout.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));
}

let ok = 0;
let bad = 0;
for (let i = 0; i < items.length; i += BATCH) {
  const batch = items.slice(i, i + BATCH);
  const res = run({ items: batch }, batch.map((it) => join(WORK, `${it.key}.jpg`)));
  for (const r of res) {
    if (!r.ok) {
      bad++;
      console.log(`FAIL ${r.key}: ${r.error}`);
      continue;
    }
    const e = meta.get(String(r.key))!;
    ledger.photos[String(r.key)] = { ...e, url: String(r.url), fileId: r.fileId, collectionId: r.collectionId };
    ok++;
  }
  saveLedger();
  console.log(`pictures ${Math.min(i + BATCH, items.length)}/${items.length} (ok ${ok}, failed ${bad})`);
}

if (docs.length) {
  const res = run({ docs }, []);
  const byKey = new Map(res.filter((r) => r.doc).map((r) => [String(r.doc), r]));
  for (const s of sites) {
    const r = byKey.get(s.key);
    if (!r) continue;
    if (!r.ok) console.log(`FAIL doc ${s.folder}: ${r.error}`);
    else (s as Site & { tgv?: unknown }).tgv = { docId: r.docId, docFolderId: r.folderId };
  }
  console.log(`prompt docs: ${res.filter((r) => r.ok).length}/${docs.length}`);
}

// a site is ON TGV once every one of its rendered pictures is in the ledger with a link
for (const s of sites) {
  const all = s.pictures.filter((p) => existsSync(join(SITES_DIR, s.folder, p.file)));
  if (all.length === s.pictures.length && all.every((p) => ledger.photos[keyOf(s, p)]?.fileId)) s.stage = 'on-tgv';
}
writeFileSync(REGISTRY, JSON.stringify(reg, null, 1) + '\n');
console.log(`done: ${ok} uploaded, ${bad} failed`);

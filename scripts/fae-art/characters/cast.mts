// The cast registry: every template site's own named characters and scenes, each picture numbered,
// SEO-named and filed in that site's folder, with the prompt and seed that made it (Gio 2026-11-19).
//
//   tsx cast.mts init            build docs/template-gallery/cast-registry.json (once; never reshuffles) and
//                                file the renders that already exist into their site folders
//   tsx cast.mts jobs [--sites 1-10]   write <out>/jobs.json — every picture not rendered yet, site order
//   tsx cast.mts docs            rewrite SITES.txt + every site's prompt doc from the registry + disk
//   tsx cast.mts remix <site#> <pic#> [--seed N] [--add "words"]
//                                re-use a picture's prompt (new seed by default) as a new numbered picture
//   tsx cast.mts stage <site#>[,…|a-b] reviewed|on-tgv     record a site's stage in the status file
//
// Layout under FAE_ART_HOME (default ~/.local/share/tgv-fae-art):
//   SITES.txt                              every site, its picture count and where it stands
//   Template Sites/<NNN Brand>/            the site's pictures (SEO filenames) + <brand>-image-prompts.md
// The registry (in the repo) is the source of truth; folders and docs are rebuilt from it.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEXICON } from '../../../../../packages/@tgv/module-core/module-component-library/helpers/fae/index.ts';
import { buildTemplate } from '../../fae-templates/kit.ts';
import { BACKDROP, BODY, COSTUME, PALETTE, STYLE, STYLES, TRADE_TAGS, hash, pick, seedsFor, tradeFor, type Era, type Gender, type Species, type Style } from './look.mts';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT = join(HERE, '..', '..', '..');
const DOCS = join(CLIENT, 'docs/template-gallery');
const REGISTRY = join(DOCS, 'cast-registry.json');
const HOME = process.env.FAE_ART_HOME ?? join(homedir(), '.local/share/tgv-fae-art');
const OUT = process.env.FAE_ART_OUT ?? join(HOME, 'out');
const SITES_DIR = join(HOME, 'Template Sites');
const STATUS = join(HOME, 'SITES.txt');

export type Picture = {
  no: number;
  kind: 'portrait' | 'scene';
  title: string; // the character's name, or the scene's
  file: string; // SEO filename inside the site folder
  alt: string;
  prompt: string;
  seed: number;
  width: number;
  height: number;
  tags: string[];
  character?: { name: string; species: Species; gender: Gender; role: string };
  from?: number; // a remix: the picture whose prompt it re-used
  origin?: string; // where an already-rendered picture came from
};
export type Site = {
  n: number;
  key: string;
  templateId: string;
  brand: string;
  slug: string;
  folder: string;
  industry: string;
  cast: string; // elf | gnome | faerie | collective
  style: Style;
  stage?: 'reviewed' | 'on-tgv';
  pictures: Picture[];
};
type Registry = { note: string; sites: Site[] };

// ————————————————————————————————————————————————————— names

/** Every lexicon first name read as a woman's or a man's, so the face matches the name on the page. */
const NAME_GENDER: Record<string, Gender> = Object.fromEntries(
  [
    'Aelindra Elowen Ithilwen Nimrien Lirael Mireth Ellisande Quelenna Shaelynn Ilyrana Seraphel Venyra Orlaith Ysolde Maelis Rhoswen',
    'Lumi Wisp Juniper Saffi Fern Clover Nyx Posy Marigold Wren Tansy Zinnia Bryony Petra Hazel Linnet Tilly',
    'Tilda Hettie Orla Mabel Gilly Wendeline Bertha Agatha Pippa Ottoline Greta Ida Maude',
  ]
    .join(' ')
    .split(' ')
    .map((n) => [n, 'female' as Gender])
    .concat(
      [
        'Thalion Caladrel Faelar Sylvaris Aerendyl Galathil Taurion Varis Arannis Erevan Corvaleth Aldrith Theren Calenor',
        'Pip Bramble Thistle Briar Dewi Sorrel Lark Kestrel Moth Sable Indigo Sprig Vesper',
        'Bodo Fennick Grummel Wobbin Nesbit Pell Dunstan Tobble Bartholomew Fizzwick Rosco Hamish Nib Humbert Barnaby Wilbur Fergus',
      ]
        .join(' ')
        .split(' ')
        .map((n) => [n, 'male' as Gender]),
    ),
);
const genderOf = (name: string, key: string): Gender => NAME_GENDER[name.split(' ')[0]] ?? (hash(key) % 2 ? 'male' : 'female');

export const slugify = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const pad = (n: number, w = 2) => String(n).padStart(w, '0');

// ————————————————————————————————————————————————————— init

function portraitPrompt(sp: Species, g: Gender, era: Era, style: Style, id: string) {
  return [
    `Head-and-shoulders portrait of ${BODY[sp][g]}, wearing ${pick(COSTUME[era], id)}`,
    'looking at the camera with a playful, warm expression, centred, face fully in frame',
    pick(BACKDROP, `${id}:bg`),
    PALETTE,
    STYLE[style],
  ].join(', ');
}

async function init() {
  if (existsSync(REGISTRY) && !process.argv.includes('--rebuild')) throw new Error(`${REGISTRY} exists — it never reshuffles (pass --rebuild only before anything is filed)`);
  const ledger = JSON.parse(readFileSync(join(DOCS, 'photo-ledger.json'), 'utf8'));
  const specDir = join(CLIENT, 'scripts/fae-templates/specs');
  const keys = readdirSync(specDir).filter((f) => f.endsWith('.ts')).map((f) => f.slice(0, -3)).sort();

  // renders made before the registry (generic elf portraits): reuse them on matching characters
  const legacy = existsSync(join(OUT, 'portrait'))
    ? readdirSync(join(OUT, 'portrait'))
        .filter((f) => /^[a-z]+-[fm]-\d+-v\d\.png$/.test(f))
        .sort()
        .map((f) => ({ f, meta: JSON.parse(readFileSync(join(OUT, 'portrait', f.replace('.png', '.json')), 'utf8')) }))
    : [];
  const moves: Array<[string, string]> = [];

  const sites: Site[] = [];
  for (const [i, key] of keys.entries()) {
    const spec = (await import(join(specDir, `${key}.ts`))).default;
    const b = buildTemplate(spec, ledger, randomUUID);
    const site = b.site;
    const n = i + 1;
    const style = STYLES[i % STYLES.length];
    const castMode = site.cast.mode === 'single' ? (site.cast.species as string) : 'collective';
    const s: Site = {
      n,
      key,
      templateId: b.templateId,
      brand: site.brand,
      slug: slugify(site.brand),
      folder: `${pad(n, 3)} ${site.brand.replace(/[/:]/g, '-')}`,
      industry: spec.industry,
      cast: castMode,
      style,
      pictures: [],
    };
    const files = new Set<string>();
    const uniq = (f: string) => {
      let out = f;
      for (let k = 2; files.has(out); k++) out = f.replace(/\.png$/, `-${k}.png`);
      files.add(out);
      return out;
    };

    // one character per distinct face the template shows: the site's named people first, then extras
    const faces = [...b.used].filter((k: string) => /^a-(elf|gnome|faerie)-/.test(k));
    const usedNames = new Set(site.people.map((p) => p.name.split(' ')[0]));
    const bySpecies = new Map<string, number>();
    for (const face of faces) {
      const sp = face.split('-')[1] as Species;
      const k = bySpecies.get(sp) ?? 0;
      bySpecies.set(sp, k + 1);
      const named = site.people.filter((p) => p.species === sp)[k];
      let name = named?.name;
      if (!name) {
        const firsts = LEXICON[sp].firstNames.filter((f) => !usedNames.has(f));
        const first = firsts[hash(`${key}:${face}`) % firsts.length];
        usedNames.add(first);
        name = `${first} ${pick(LEXICON[sp].surnames, `${key}:${face}:s`)}`;
      }
      const role = named?.role ?? 'Customer';
      const g = genderOf(name, `${key}:${face}`);
      const id = `${key}-${slugify(name)}`;
      const era: Era = hash(`${id}:era`) % 2 ? 'myth' : 'space';
      const no = s.pictures.length + 1;
      let prompt = portraitPrompt(sp, g, era, style, id);
      let seed = seedsFor(id, 1)[0];
      let origin: string | undefined;
      const reuse = legacy.findIndex((l) => l.meta.meta.species === sp && l.meta.meta.gender === g && l.meta.meta.style === style);
      if (reuse >= 0) {
        const [l] = legacy.splice(reuse, 1);
        prompt = l.meta.prompt;
        seed = l.meta.seed;
        origin = `out/portrait/${l.f}`;
      }
      const lexSp = LEXICON[sp].singular;
      const file = uniq(`${slugify(name)}-${slugify(lexSp)}-${slugify(role)}-${s.slug}.png`);
      s.pictures.push({
        no,
        kind: 'portrait',
        title: name,
        file,
        alt: `${name}, ${lexSp} ${role.toLowerCase()}${role === 'Customer' ? ' of' : ' at'} ${site.brand}`,
        prompt,
        seed,
        width: 768,
        height: 768,
        tags: ['avatar', 'portrait', 'character', sp, g, `style-${style}`, `era-${era}`, `tpl-${key}`],
        character: { name, species: sp, gender: g, role },
        ...(origin ? { origin } : {}),
      });
      if (origin) moves.push([join(OUT, origin.replace(/^out\//, '')), join(SITES_DIR, s.folder, file)]);
    }

    // one scene (Gio 2026-11-20: one take, 1024×576 — renders ~2.5x faster), starring the founder (or the whole collective) at the site's trade
    const founder = site.people[0];
    const fg = genderOf(founder.name, `${key}:founder`);
    const sid = `scene-${key}`;
    const era: Era = hash(`${sid}:era`) % 2 ? 'myth' : 'space';
    const who =
      site.cast.mode === 'single'
        ? BODY[site.cast.species][fg]
        : 'an equal trio of fae friends — an elf, a gnome and a faerie — working side by side';
    const prompt = [`Full-body wide shot of ${who}, wearing ${pick(COSTUME[era], sid)}`, tradeFor(spec.industry), 'every person in the scene a complete figure with head, body, arms and legs, joyful, energetic, magical, room to the side for a headline', PALETTE, STYLE[style]].join(', ');
    const sp = site.cast.mode === 'single' ? [site.cast.species as string] : ['elf', 'gnome', 'faerie'];
    for (const [v, seed] of seedsFor(sid, 1).entries()) {
      const title = site.cast.mode === 'single' ? `${founder.name} at work` : `The ${site.brand} collective at work`;
      const who = site.cast.mode === 'single' ? `${slugify(founder.name)}-${slugify(LEXICON[site.cast.species].singular)}` : 'elf-gnome-faerie-collective';
      s.pictures.push({
        no: s.pictures.length + 1,
        kind: 'scene',
        title: v ? `${title} (take ${v + 1})` : title,
        file: uniq(`${s.slug}-${slugify(spec.industry)}-${who}-scene-${v + 1}.png`),
        alt: site.cast.mode === 'single' ? `${founder.name}, ${founder.role.toLowerCase()} of ${site.brand}, at work` : `The elf, gnome and faerie partners of ${site.brand} at work`,
        prompt,
        seed,
        width: 1024,
        height: 576,
        tags: ['character', 'scene', `tpl-${key}`, spec.industry, ...sp, `style-${style}`, `era-${era}`, ...(TRADE_TAGS[spec.industry] ?? [])],
      });
    }
    sites.push(s);
  }

  const reg: Registry = { note: 'Fae template cast — source of truth for every character picture (scripts/fae-art/characters/cast.mts). Never reshuffle; append.', sites };
  writeFileSync(REGISTRY, JSON.stringify(reg, null, 1) + '\n');
  mkdirSync(join(OUT, 'filed-sidecars'), { recursive: true });
  for (const [from, to] of moves) {
    mkdirSync(dirname(to), { recursive: true });
    renameSync(from, to);
    const side = from.replace(/\.png$/, '.json');
    if (existsSync(side)) renameSync(side, join(OUT, 'filed-sidecars', side.split('/').pop()!)); // kept out of the site folders
  }
  console.log(`${sites.length} sites, ${sites.reduce((a, s) => a + s.pictures.length, 0)} pictures; filed ${moves.length} existing renders; ${legacy.length} renders matched no character (left in out/portrait)`);
}

// ————————————————————————————————————————————————————— jobs, docs, remix, stage

const load = (): Registry => JSON.parse(readFileSync(REGISTRY, 'utf8'));
const save = (r: Registry) => writeFileSync(REGISTRY, JSON.stringify(r, null, 1) + '\n');
const rendered = (s: Site, p: Picture) => existsSync(join(SITES_DIR, s.folder, p.file));

function range(spec: string | undefined, max: number): Set<number> {
  if (!spec) return new Set(Array.from({ length: max }, (_, i) => i + 1));
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    const [a, b] = part.split('-').map(Number);
    for (let i = a; i <= (b || a); i++) out.add(i);
  }
  return out;
}

function jobs(sitesArg?: string) {
  const r = load();
  const want = range(sitesArg, r.sites.length);
  const list = r.sites
    .filter((s) => want.has(s.n))
    .flatMap((s) =>
      s.pictures
        .filter((p) => !rendered(s, p))
        .map((p) => ({ id: `${pad(s.n, 3)}-${pad(p.no)}`, site: s.n, kind: p.kind, prompt: p.prompt, seeds: [p.seed], files: [join(s.folder, p.file)], width: p.width, height: p.height })),
    );
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'jobs.json'), JSON.stringify({ base: SITES_DIR, jobs: list }, null, 1));
  console.log(`${list.length} pictures to render${sitesArg ? ` in sites ${sitesArg}` : ''} → ${join(OUT, 'jobs.json')}`);
}

function siteDoc(s: Site) {
  const L: string[] = [];
  L.push(`# ${s.brand} — image prompts`, '');
  L.push(`Template ${pad(s.n, 3)} · \`${s.templateId}\` · ${s.industry} · cast: ${s.cast} · style: ${s.style}`, '');
  L.push('Every picture on this site, numbered. The index gives each one\'s title and SEO filename; the prompt list after it has the exact prompt and seed, so any picture can be made again, or re-used for new angles (`cast.mts remix <site#> <picture#>`).', '');
  L.push('## Index', '', '| # | Title | SEO filename | Kind | Rendered |', '|---|---|---|---|---|');
  for (const p of s.pictures) L.push(`| ${pad(p.no)} | ${p.title} | \`${p.file}\` | ${p.kind}${p.from ? ` (from #${pad(p.from)})` : ''} | ${rendered(s, p) ? 'yes' : '—'} |`);
  L.push('', '## Prompts', '');
  for (const p of s.pictures) {
    L.push(`### ${pad(p.no)} · ${p.title}`, '');
    L.push(`- **File:** \`${p.file}\``);
    L.push(`- **Alt text:** ${p.alt}`);
    if (p.character) L.push(`- **Character:** ${p.character.name} — ${p.character.species}, ${p.character.gender}, ${p.character.role}`);
    L.push(`- **Seed:** ${p.seed} · **Size:** ${p.width}×${p.height} · **Engine:** FLUX.1-schnell 4-bit, 4 steps`);
    if (p.from) L.push(`- **Re-used from:** #${pad(p.from)}`);
    L.push('', '```text', p.prompt, '```', '');
  }
  return L.join('\n');
}

function docs() {
  const r = load();
  const rows: string[] = [];
  let all = 0;
  let done = 0;
  for (const s of r.sites) {
    const n = s.pictures.filter((p) => rendered(s, p)).length;
    all += s.pictures.length;
    done += n;
    const status = s.stage === 'on-tgv' ? 'ON TGV' : s.stage === 'reviewed' ? 'reviewed' : n === s.pictures.length ? 'FINISHED' : n ? 'in progress' : 'not started';
    rows.push(`${pad(s.n, 3)}  ${s.key}  ${s.brand.padEnd(34).slice(0, 34)}  ${s.cast.padEnd(10)}  ${`${n}/${s.pictures.length}`.padStart(5)}  ${status}`);
    if (n) {
      mkdirSync(join(SITES_DIR, s.folder), { recursive: true });
      writeFileSync(join(SITES_DIR, s.folder, `${s.slug}-image-prompts.md`), siteDoc(s));
    }
  }
  const now = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  writeFileSync(
    STATUS,
    [
      'TGV fae template sites — character pictures',
      `updated ${now} · ${done}/${all} pictures rendered (${Math.round((100 * done) / all)}%)`,
      'pictures live in "Template Sites/<NNN Brand>/", each with its <brand>-image-prompts.md',
      'status: not started · in progress · FINISHED (all rendered) · reviewed · ON TGV',
      '',
      '#    template  site                                cast        done   status',
      ...rows,
      '',
    ].join('\n'),
  );
}

function remix(siteNo: number, picNo: number) {
  const r = load();
  const s = r.sites.find((x) => x.n === siteNo);
  const p = s?.pictures.find((x) => x.no === picNo);
  if (!s || !p) throw new Error(`no picture #${picNo} on site ${siteNo}`);
  const a = (k: string) => {
    const i = process.argv.indexOf(k);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const no = Math.max(...s.pictures.map((x) => x.no)) + 1;
  const seed = a('--seed') ? Number(a('--seed')) : seedsFor(`${s.key}:${p.no}:remix:${no}`, 1)[0];
  const add = a('--add');
  const prompt = add ? `${p.prompt}, ${add}` : p.prompt;
  const file = p.file.replace(/(-\d+)?\.png$/, '') + `-${no}.png`;
  s.pictures.push({ ...p, no, seed, prompt, file, from: p.no, title: `${p.title.replace(/ \(.*\)$/, '')} (#${pad(no)})`, origin: undefined });
  save(r);
  console.log(`site ${pad(s.n, 3)} picture #${pad(no)} ← #${pad(p.no)} seed ${seed} → ${file}`);
}

function stage(sitesArg: string, st: string) {
  if (st !== 'reviewed' && st !== 'on-tgv') throw new Error('stage is reviewed | on-tgv');
  const r = load();
  const want = range(sitesArg, r.sites.length);
  for (const s of r.sites) if (want.has(s.n)) s.stage = st;
  save(r);
}

const [cmd, a1, a2] = process.argv.slice(2);
const sitesFlag = (() => {
  const i = process.argv.indexOf('--sites');
  return i > 0 ? process.argv[i + 1] : undefined;
})();
if (cmd === 'init') {
  await init();
  docs();
} else if (cmd === 'jobs') jobs(sitesFlag);
else if (cmd === 'docs') docs();
else if (cmd === 'remix') {
  remix(Number(a1), Number(a2));
  jobs(a1);
  docs();
} else if (cmd === 'stage') {
  stage(a1, a2);
  docs();
} else {
  console.log('usage: cast.mts init | jobs [--sites 1-10] | docs | remix <site#> <pic#> [--seed N] [--add "words"] | stage <sites> reviewed|on-tgv');
  process.exit(2);
}

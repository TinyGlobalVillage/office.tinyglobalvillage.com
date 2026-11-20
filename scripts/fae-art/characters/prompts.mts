// Builds the job list for the fae character engine: every picture's id, prompt, seed and size,
// written to <out>/jobs.json. Deterministic — the same inputs give the same jobs, so a rerun of
// generate.py picks up exactly where the last one stopped. Writes no image.
//
//   node_modules/.bin/tsx clients/office.tinyglobalvillage.com/scripts/fae-art/characters/prompts.mts [--out DIR] [--variants N]
//
// Two kinds (CHARACTERS-PLAN.md):
//   portrait  head-and-shoulders, square — replaces the drawn avatars (team, reviews, testimonials)
//   scene     full-body, wide — one per template: its own species at its own trade, for heroes and photos
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFaeSite } from '../../../../../packages/@tgv/module-core/module-component-library/helpers/fae/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT = join(HERE, '..', '..', '..');
const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const OUT = arg('--out', process.env.FAE_ART_OUT ?? join(homedir(), '.local/share/tgv-fae-art/out'));
const VARIANTS = Number(arg('--variants', '2')); // candidates per picture; the contact sheet picks one

type Species = 'elf' | 'gnome' | 'faerie';
type Gender = 'female' | 'male';
type Style = 'photo' | 'felt' | 'clay' | 'toon';
type Era = 'space' | 'myth';
export type Job = {
  id: string;
  kind: 'portrait' | 'scene';
  prompt: string;
  seeds: number[];
  width: number;
  height: number;
  tags: string[];
  meta: Record<string, string>;
};

// ————————————————————————————————————————————————————— the look, in words

/** TGV Office's colours (src/app/theme.ts) — every picture carries them. */
const PALETTE =
  'colour palette of neon magenta pink, electric cyan and soft violet with small touches of warm gold, ' +
  'glowing energy threads of pink and cyan light weaving and spiralling through the air';

const STYLE: Record<Style, string> = {
  photo: 'cinematic fantasy photograph, 85mm lens, shallow depth of field, realistic skin texture, crisp fine detail, rim light',
  felt: 'handmade posable felt doll puppet, needle-felted wool skin, visible stitched seams, yarn hair, tabletop miniature photography, soft studio light',
  clay: 'stop-motion claymation figure, sculpted plasticine with fingerprint texture, handmade miniature set, tilt-shift photography',
  toon: 'stylised 3D animated feature-film character, expressive oversized eyes, soft subsurface skin, playful proportions, polished render',
};

const BODY: Record<Species, Record<Gender, string>> = {
  elf: {
    female: 'an elf woman, side hair tucked behind her slender pointed elf ears, a single smooth ear on each side of her face, luminous almond eyes and flowing hair braided with glowing beads',
    male: 'an elf man, side hair tucked behind his slender pointed elf ears, a single smooth ear on each side of his face, luminous almond eyes and a sharp proud face, hair tied back with silver cord',
  },
  gnome: {
    female: 'a stout gnome woman with rosy cheeks, a tall floppy pointed knitted hat, thick braids with copper beads and a big warm grin',
    male: 'a stout old gnome man with rosy cheeks, a tall floppy pointed knitted hat and a long white braided beard woven with glowing thread',
  },
  faerie: {
    female: 'a faerie woman with one pair of translucent iridescent dragonfly wings growing from her shoulder blades, two human ears, delicate features and starlight freckles',
    male: 'a faerie man with one pair of translucent iridescent moth wings growing from his shoulder blades, two human ears, fine features and silver-dusted cheekbones',
  },
};

/** Never modern streetwear — space-age or mythical, nothing in between. */
const COSTUME: Record<Era, string[]> = {
  space: [
    'a sleek iridescent space-age flight suit with glowing cyan seams',
    'chrome and silk star-voyager armour with neon pink piping',
    'a holographic cosmic cloak embroidered with moving constellations',
    'a luminous orbital explorer harness with violet light panels',
    'a retro-futurist rocket-ranger long coat with gold trim and a glass visor pushed up',
    'a pearl-white nebula diplomat robe with floating crystal epaulettes',
  ],
  myth: [
    'an embroidered velvet tunic stitched with gold knotwork',
    'a moss-green woven cloak pinned with a glowing crystal brooch',
    'leaf-and-bark leather armour laced with luminous thread',
    'flowing druid robes with rune-lit hems',
    'an ancient bronze-clasped wool mantle with a fur collar',
    'a patchwork wizard coat of star-dyed silk and tiny bells',
  ],
};

const BACKDROP = [
  'a deep-space nebula backdrop with drifting stars',
  'a bioluminescent forest at night with glowing mushrooms',
  'a cosmic loom of glowing threads stretching into the dark',
  'an aurora sky over a moonlit glade',
  'a crystal cavern lit by floating orbs',
];

/** What each trade looks like when fae do it — the scene's action and set. */
const TRADE: Record<string, string> = {
  accounting: 'tallying glowing gold coins on a floating abacus of light in a candlelit counting-house among star charts',
  actor: 'performing on a moonlit stage under a spotlight beam, theatrical pose, velvet curtains of light behind',
  agency: 'sketching luminous designs on a hovering holographic drafting board in a bustling creative studio-workshop',
  architecture: 'raising a model of a spiralling tree-tower city from glowing blueprints of light',
  artist: 'painting a canvas with brushes that trail living neon light, paint jars glowing on the easel',
  bakery: 'pulling star-dusted loaves from a glowing mushroom-cap oven, warm flour drifting through the light',
  'barbershop-salon': 'styling a client’s hair into a crown of glowing braids at an ornate mirror in a cosy salon',
  blog: 'writing with a quill that leaves floating glowing words in the air, journals stacked around',
  business: 'shaking hands across a market stall of curious wares at a twilight fae market',
  coach: 'guiding a traveller along a glowing stone path up a misty mountain, pointing the way',
  construction: 'building a rune-carved stone bridge with floating beams of light and a glowing hammer',
  education: 'teaching a ring of wide-eyed young fae from a floating book under a great old tree',
  ecommerce: 'packing glowing parcels tied with light-thread into a basket by a postal toadstool',
  fashion: 'fitting a shimmering gown of woven light on a tailor’s form, bolts of cosmic silk all around',
};
const tradeFor = (industry: string) => TRADE[industry] ?? 'at work at their craft in a glowing fae workshop';

/** Existing pool tags a scene also answers to, so the kit can mix it with the photos it already asks for. */
const TRADE_TAGS: Record<string, string[]> = {
  accounting: ['desk', 'study'],
  actor: ['stage'],
  agency: ['studio', 'workshop'],
  architecture: ['architecture'],
  artist: ['art', 'studio'],
  bakery: ['bakery', 'bread', 'food'],
  'barbershop-salon': ['barber'],
  blog: ['books', 'desk'],
  business: ['city'],
  coach: ['landscape'],
  construction: ['architecture', 'craft'],
  education: ['school', 'books'],
  ecommerce: ['product'],
  fashion: ['fabric'],
};

// ————————————————————————————————————————————————————— jobs

const hash = (s: string) => {
  let x = 2166136261;
  for (const ch of s) x = Math.imul(x ^ ch.charCodeAt(0), 16777619);
  return x >>> 0;
};
const seedsFor = (id: string) => Array.from({ length: VARIANTS }, (_, v) => hash(`${id}#${v}`) % 2 ** 31);
const pick = <T>(list: readonly T[], key: string) => list[hash(key) % list.length];
const STYLES: Style[] = ['photo', 'felt', 'clay', 'toon'];
const SPECIES: Species[] = ['elf', 'gnome', 'faerie'];
const GENDERS: Gender[] = ['female', 'male'];

function portrait(species: Species, gender: Gender, n: number): Job {
  const id = `${species}-${gender[0]}-${String(n).padStart(2, '0')}`;
  const style = STYLES[n % STYLES.length];
  const era: Era = Math.floor(n / STYLES.length) % 2 ? 'myth' : 'space'; // each style gets both eras
  const prompt = [
    `Head-and-shoulders portrait of ${BODY[species][gender]}, wearing ${pick(COSTUME[era], id)}`,
    'looking at the camera with a playful, warm expression, centred, face fully in frame',
    pick(BACKDROP, `${id}:bg`),
    PALETTE,
    STYLE[style],
  ].join(', ');
  return {
    id, kind: 'portrait', prompt, seeds: seedsFor(id), width: 768, height: 768, // avatars show small; 768 renders ~1.8x faster (Gio 2026-11-19)
    tags: ['avatar', 'portrait', 'character', species, gender, `style-${style}`, `era-${era}`],
    meta: { species, gender, style, era },
  };
}

function scene(key: string, industry: string, n: number): Job {
  const site = createFaeSite({ seed: `fae-${key}`, industry });
  const id = `scene-${key}`;
  const style = STYLES[n % STYLES.length];
  const era: Era = hash(`${id}:era`) % 2 ? 'myth' : 'space';
  const gender = GENDERS[hash(`${id}:g`) % 2];
  const who =
    site.cast.mode === 'single'
      ? BODY[site.cast.species][gender]
      : 'an equal trio of fae friends — an elf, a gnome and a faerie — working side by side';
  const prompt = [
    `Full-body wide shot of ${who}, wearing ${pick(COSTUME[era], id)}`,
    tradeFor(industry),
    'joyful, energetic, magical, room to the side for a headline',
    PALETTE,
    STYLE[style],
  ].join(', ');
  const species = site.cast.mode === 'single' ? [site.cast.species] : ['elf', 'gnome', 'faerie'];
  return {
    id, kind: 'scene', prompt, seeds: seedsFor(id), width: 1344, height: 768,
    tags: ['character', 'scene', `tpl-${key}`, industry, ...species, `style-${style}`, `era-${era}`, ...(TRADE_TAGS[industry] ?? [])],
    meta: { template: key, industry, cast: site.cast.mode, gender, style, era },
  };
}

const progress = JSON.parse(readFileSync(join(CLIENT, 'docs/template-gallery/progress.json'), 'utf8')) as {
  templates: Record<string, { industry: string }>;
};
const jobs: Job[] = [];
for (const s of SPECIES) for (const g of GENDERS) for (let n = 0; n < 20; n++) jobs.push(portrait(s, g, n));
Object.entries(progress.templates)
  .sort(([a], [b]) => a.localeCompare(b))
  .forEach(([key, t], n) => jobs.push(scene(key, t.industry, n)));

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'jobs.json'), JSON.stringify({ variants: VARIANTS, jobs }, null, 1));
const renders = jobs.reduce((a, j) => a + j.seeds.length, 0);
console.log(`${jobs.length} jobs (${jobs.filter((j) => j.kind === 'portrait').length} portraits, ${jobs.filter((j) => j.kind === 'scene').length} scenes), ${renders} renders → ${join(OUT, 'jobs.json')}`);

// The look of every fae picture, in words: palette, styles, species bodies, costumes, backdrops and
// what each trade looks like when fae do it. Pure data + tiny helpers; cast.mts builds the jobs from it.
export type Species = 'elf' | 'gnome' | 'faerie';
export type Gender = 'female' | 'male';
export type Style = 'photo' | 'felt' | 'clay' | 'toon';
export type Era = 'space' | 'myth';

// ————————————————————————————————————————————————————— the look, in words

/** TGV Office's colours (src/app/theme.ts) — every picture carries them. */
export const PALETTE =
  'colour palette of neon magenta pink, electric cyan and soft violet with small touches of warm gold, ' +
  'glowing energy threads of pink and cyan light weaving and spiralling through the air';

export const STYLE: Record<Style, string> = {
  photo: 'cinematic fantasy photograph, 85mm lens, shallow depth of field, realistic skin texture, crisp fine detail, rim light',
  felt: 'handmade posable felt doll puppet, needle-felted wool skin, visible stitched seams, yarn hair, tabletop miniature photography, soft studio light',
  clay: 'stop-motion claymation figure, sculpted plasticine with fingerprint texture, handmade miniature set, tilt-shift photography',
  toon: 'stylised 3D animated feature-film character, expressive oversized eyes, soft subsurface skin, playful proportions, polished render',
};

export const BODY: Record<Species, Record<Gender, string>> = {
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
export const COSTUME: Record<Era, string[]> = {
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

export const BACKDROP = [
  'a deep-space nebula backdrop with drifting stars',
  'a bioluminescent forest at night with glowing mushrooms',
  'a cosmic loom of glowing threads stretching into the dark',
  'an aurora sky over a moonlit glade',
  'a crystal cavern lit by floating orbs',
];

/** What each trade looks like when fae do it — the scene's action and set. */
export const TRADE: Record<string, string> = {
  accounting: 'tallying glowing gold coins on a floating abacus of light in a candlelit counting-house among star charts',
  actor: 'performing on a moonlit stage under a spotlight beam, theatrical pose, velvet curtains of light behind',
  agency: 'sketching luminous designs on a hovering holographic drafting board in a bustling creative studio-workshop',
  architecture: 'raising a model of a spiralling tree-tower city from glowing blueprints of light',
  artist: 'painting a canvas with brushes that trail living neon light, paint jars glowing on the easel',
  bakery: 'pulling star-dusted loaves from a glowing mushroom-cap oven, warm flour drifting through the light',
  'barbershop-salon': 'braiding glowing ribbons into the long hair of a smiling fae customer who sits whole and relaxed in a plush velvet barber chair, the customer’s shoulders, arms, body and legs all visible in the chair, an ornate mirror and a cosy salon behind them',
  blog: 'writing with a quill that leaves floating glowing words in the air, journals stacked around',
  business: 'shaking hands across a market stall of curious wares with a fae shopper standing on the far side, the shopper’s whole body visible from head to feet, at a twilight fae market',
  coach: 'walking beside a fae traveller with a walking staff on a glowing stone path up a misty mountain, both figures seen whole from head to feet, pointing the way',
  construction: 'building a rune-carved stone bridge with floating beams of light and a glowing hammer',
  education: 'reading from a floating book to a few wide-eyed young fae children sitting cross-legged on the grass, each child a whole small person with body, arms and legs, under a great old tree',
  ecommerce: 'packing glowing parcels tied with light-thread into a basket by a postal toadstool',
  fashion: 'fitting a shimmering gown of woven light on a tailor’s form, bolts of cosmic silk all around',
};
export const tradeFor = (industry: string) => TRADE[industry] ?? 'at work at their craft in a glowing fae workshop';

/** Existing pool tags a scene also answers to, so the kit can mix it with the photos it already asks for. */
export const TRADE_TAGS: Record<string, string[]> = {
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

export const hash = (s: string) => {
  let x = 2166136261;
  for (const ch of s) x = Math.imul(x ^ ch.charCodeAt(0), 16777619);
  return x >>> 0;
};
export const seedsFor = (id: string, n: number) => Array.from({ length: n }, (_, v) => hash(`${id}#${v}`) % 2 ** 31);
export const pick = <T>(list: readonly T[], key: string) => list[hash(key) % list.length];
export const STYLES: Style[] = ['photo', 'felt', 'clay', 'toon'];
export const SPECIES: Species[] = ['elf', 'gnome', 'faerie'];
export const GENDERS: Gender[] = ['female', 'male'];


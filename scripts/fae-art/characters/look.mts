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
    female: 'a faerie woman with delicate features, starlight freckles and two human ears, one pair of huge pale-gold iridescent dragonfly wings, each wing as long as her whole body, flecked with cyan and magenta veins and shimmering particle filaments, both wings joined to her body at one single point on the bare skin between her shoulder blades, the wing roots clearly visible',
    male: 'a faerie man with fine features, silver-dusted cheekbones and two human ears, one pair of huge pale-gold iridescent moth wings, each wing as long as his whole body, flecked with cyan and magenta veins and shimmering particle filaments, both wings joined to his body at one single point on the bare skin between his shoulder blades, the wing roots clearly visible',
  },
};

/** Never modern streetwear — space-age or mythical, nothing in between. */
export const COSTUME: Record<Era, string[]> = {
  space: [
    'a flowing iridescent space-age tunic with glowing cyan seams',
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
  // One figure, hands free or holding ONE simple prop, big props standing beside or behind them.
  // A second person or a hand working a prop is where a 4-step model grows extra arms and fuses objects into bodies (Gio 2026-11-20).
  accounting: 'standing in front of a tall wooden abacus of glowing gold beads, holding a small leather ledger against the chest, in a candlelit counting-house among star charts',
  actor: 'standing on a moonlit stage under a spotlight beam, taking a theatrical bow, velvet curtains of light behind',
  agency: 'standing beside a hovering holographic drafting board covered in luminous designs, in a bustling creative studio-workshop',
  architecture: 'holding a small model of a spiralling tree-tower city in both hands, glowing blueprints of light floating behind',
  artist: 'standing beside an easel with a glowing canvas, holding a single paintbrush that trails living neon light',
  bakery: 'holding a wooden tray of star-dusted loaves in both hands beside a glowing mushroom-cap oven, warm flour drifting through the light',
  'barbershop-salon': 'standing proudly beside an empty plush velvet barber chair, holding a pair of silver scissors, an ornate mirror and glowing ribbons in a cosy salon behind',
  blog: 'holding a quill that leaves floating glowing words in the air, journals stacked on a desk beside them',
  business: 'standing behind a market stall of curious glowing wares, arms open in welcome, at a twilight fae market',
  coach: 'standing on a glowing stone path up a misty mountain holding a walking staff, pointing the way ahead',
  construction: 'standing on a rune-carved stone bridge holding a glowing hammer, floating beams of light behind',
  education: 'standing under a great old tree holding an open glowing book, floating letters drifting up from its pages',
  ecommerce: 'holding a glowing parcel tied with light-thread, a basket of parcels beside a postal toadstool',
  fashion: 'standing beside a tailor’s form dressed in a shimmering gown of woven light, bolts of cosmic silk all around',
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

/** Every race across the board (Gio 2026-11-20): each character gets a heritage, a skin tone and a natural
 *  hair type. Within a site the characters rotate through the list, so no cast is all one look. */
export const HERITAGE: { lead: string; hair: string }[] = [
  { lead: 'dark-brown-skinned Black West African', hair: 'tightly coiled black hair' },
  { lead: 'East Asian', hair: 'straight glossy black hair' },
  { lead: 'brown-skinned South Asian Indian', hair: 'long wavy black hair' },
  { lead: 'tan-skinned Latino', hair: 'thick wavy dark-brown hair' },
  { lead: 'olive-skinned Middle Eastern', hair: 'curly dark-brown hair' },
  { lead: 'copper-skinned Native American', hair: 'long straight black hair' },
  { lead: 'brown-skinned Black Afro-Caribbean', hair: 'black locs' },
  { lead: 'golden-brown-skinned Southeast Asian Filipino', hair: 'sleek black hair' },
  { lead: 'brown-skinned Polynesian Pacific Islander', hair: 'thick curly black hair' },
  { lead: 'deep-brown-skinned Black East African', hair: 'a short natural black afro' },
  { lead: 'fair freckled Irish', hair: 'copper-red hair' },
  { lead: 'light-brown-skinned mixed-race', hair: 'loose brown curls' },
  { lead: 'bronze-skinned North African', hair: 'dark wavy hair' },
  { lead: 'olive-skinned Mediterranean', hair: 'dark curly hair' },
  { lead: 'pale Scandinavian', hair: 'ash-blonde hair' },
];
/** The race goes first, where schnell listens hardest, and the hair rides along: a trailing clause gets ignored. */
export const withHeritage = (body: string, h?: { lead: string; hair: string }) => (h ? `${body.replace(/^an? /, `a ${h.lead} `)}, ${h.hair}` : body);
export const heritageText = (h: { lead: string; hair: string }) => `${h.lead}, ${h.hair}`;
/** The k-th character of a site: stepping by a number coprime to the list keeps a site's cast varied. */
export const heritageFor = (siteKey: string, k: number) => HERITAGE[(hash(`${siteKey}:heritage`) + k * 7) % HERITAGE.length];
/** A mixed group's line, for scenes with a whole collective. */
export const MIXED_GROUP = 'each of a different race and skin tone';
export const STYLES: Style[] = ['photo', 'felt', 'clay', 'toon'];
/** Faeries fly: big wings, and an open back so both visibly grow from one point (Gio 2026-11-20). */
export const backView = (g: 'female' | 'male') => {
  const h = g === 'female' ? 'her' : 'his';
  return { open: `with a low open back that shows ${h} shoulder blades, otherwise fully and modestly clothed`, pose: `seen from behind with ${h} back to the camera, both wings spread wide and even to the left and right of ${h} body, turning ${h} head to look back over ${h} shoulder at the camera with a playful, warm smile` };
};

export const SPECIES: Species[] = ['elf', 'gnome', 'faerie'];
export const GENDERS: Gender[] = ['female', 'male'];


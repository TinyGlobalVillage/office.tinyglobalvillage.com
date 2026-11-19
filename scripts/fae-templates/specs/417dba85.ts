// Ref — white fashion house: serif headlines, small capital buttons, a full photo hero, product rows beside tall promos.
// Kept: centred photo hero with eyebrow + two buttons · eyebrow + filter tabs + four ware cards · "curated" centred
// heading, then a 2×2 ware grid beside a tall picture promo · the same row mirrored · a quiet sign-up band.
import { button, contact, ctaBand, group, headBlock, hero, image, imageStory, pageTitle, reviews, section, shape, stackLast, stats, text, tone, avatarsFor, bottom, GLYPHS, CW, PAD, W, type Ctx, type Node, type Section, type Tone, type TemplateSpec } from '../kit.ts';
const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const tints = ['#efe9e2', '#e6e2dc', '#f2ede6', '#e9e1d8'];

type Head = { eyebrow?: boolean | string; heading?: string; align?: 'left' | 'center'; size?: number; intro?: boolean };

/** The ware grid (the kit has no product card): drawn tiles — a glyph on a tint — with name and price. */
function wares(c: Ctx, o: { n: number; cols: number; x: number; w: number; y: number; t: ReturnType<typeof tone>; mobile?: number }) {
  const gap = 20;
  const cellW = (o.w - gap * (o.cols - 1)) / o.cols;
  const th = Math.round(cellW * 1.2);
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < o.n; i++) {
    const tile = group(c, { name: 'Picture', x: 0, y: 0, w: cellW, h: th, pct: 100, children: [
      shape(c, { x: 0, y: 0, w: cellW, h: th, pct: 100, fill: tints[i % tints.length], name: 'Tile' }),
      text(c, { text: GLYPHS[(i * 5 + o.n) % GLYPHS.length], x: 0, y: th / 2 - 40, w: cellW, pct: 100, size: 60, color: '#7a5c45', align: 'center', lh: 1.2, name: 'Ware' }),
    ] });
    const ti = text(c, { slot: 'offering.title', x: 0, y: th + 14, w: cellW, pct: 100, size: 17, color: o.t.head, font: 'head', role: 'h3', name: 'Name' });
    const pr = text(c, { slot: 'offering.price', x: 0, y: bottom(ti) + 4, w: cellW, pct: 100, size: 14, color: o.t.muted, name: 'Price' });
    const sw = text(c, { text: '● ● ●', x: 0, y: bottom(pr) + 4, w: cellW, pct: 100, size: 12, color: '#b39a83', track: 2, name: 'Colours' });
    maxH = Math.max(maxH, bottom(sw) + 6);
    items.push(group(c, { name: `Ware ${i + 1}`, x: 0, y: 0, w: cellW, h: bottom(sw) + 6, children: [tile, ti, pr, sw], flow: { gap: 6, pad: 6 } }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const rows = Math.ceil(o.n / o.cols);
  const gh = rows * maxH + (rows - 1) * 28;
  return group(c, { name: 'Wares', x: o.x, y: o.y, w: o.w, h: gh, children: items, layout: { cols: o.cols, bp: { tablet: Math.min(o.cols, 2), mobile: o.mobile ?? 2 }, gap } });
}

/** Eyebrow + heading, a row of filter tabs, then four wares. */
function tabbedShelf(c: Ctx, head: Head, tabs: string[]): Section {
  const t = tone(c, 'bg');
  const hb = headBlock(c, t, { ...head, y: 90 });
  const pw = 130;
  const gw = tabs.length * pw + (tabs.length - 1) * 10;
  const row = group(c, { name: 'Tabs', x: (W - gw) / 2, y: hb.y + 30, w: gw, h: 44, children: tabs.map((p, i) => button(c, { text: p, href: '/collections', x: 0, y: 0, w: pw, size: 12, look: i === 0 ? 'dark' : 'outline' })), layout: { cols: tabs.length, bp: { tablet: tabs.length, mobile: tabs.length }, gap: 10 } });
  const g = wares(c, { n: 4, cols: 4, x: PAD, w: CW, y: hb.y + 30 + 50 + 40, t });
  return section([...hb.nodes, row, g], bottom(g) + 90, t.bg);
}

/** A 2×2 ware grid beside a tall picture promo with its words laid over the foot of the picture. */
function promoRow(c: Ctx, photo: string, promoLeft: boolean, head?: Head): Section {
  const t = tone(c, 'bg');
  const layers: Node[] = [];
  let y = 40;
  if (head) { const hb = headBlock(c, t, { ...head, y: 90 }); layers.push(...hb.nodes); y = hb.y + 48; }
  const pw = 440;
  const gw = CW - pw - 30;
  const g = wares(c, { n: 4, cols: 2, x: promoLeft ? PAD + pw + 30 : PAD, w: gw, y, t, mobile: 2 });
  const H = g.box.desktop.h;
  const inner = pw - 64;
  const promo = group(c, { name: 'Promo', x: promoLeft ? PAD : W - PAD - pw, y, w: pw, h: H, children: [
    image(c, { key: photo, x: 0, y: 0, w: pw, h: H, pct: 100 }),
    shape(c, { x: 0, y: 0, w: pw, h: H, pct: 100, fill: 'rgba(20,16,12,0.32)', name: 'Wash' }),
    text(c, { slot: 'eyebrow', x: 32, y: H - 250, w: inner, pct: (inner / pw) * 100, size: 12, color: 'rgba(255,255,255,0.85)', weight: 600, upper: true, track: 2, name: 'Eyebrow' }),
    text(c, { slot: 'headline', x: 32, y: H - 215, w: inner, pct: (inner / pw) * 100, size: 30, color: '#ffffff', font: 'head', name: 'Heading' }),
    button(c, { slot: 'cta', href: '/collections', x: 32, y: H - 90, look: 'light', size: 13 }),
  ] });
  layers.push(g, ...stackLast([promo]));
  return section(layers, y + H + 90, t.bg);
}

const spec: TemplateSpec = {
  key: '417dba85', ref: '417dba85', name: 'Silkthistle House', industry: 'ecommerce', category: 'Ecommerce',
  description: 'An elven spun-silk house in white and serif: a full photo hero, tabbed wares, ware grids beside tall picture promos.',
  palette: { bg: '#ffffff', surface: '#f6f3ef', ink: '#1d1d1d', body: '#4c4844', muted: '#7d7770', accent: '#7a5c45', accentInk: '#ffffff', dark: '#1d1d1d', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#e3cdb8', line: 'rgba(29,29,29,0.14)' },
  fonts: { head: serif, body: sans, headWeight: 400, headTrack: 0, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'transparent over the hero: links left, centred serif wordmark, search + basket right', footer: 'white, wordmark + four link columns + newsletter field' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-center', photo: '@fabric|nature', h: 700, eyebrow: true, buttons: 2, overlay: 'rgba(20,16,12,0.4)' }),
      tabbedShelf(c, { eyebrow: 'Woven this season', heading: 'Signature silks' }, ['Moss', 'Dew', 'Ember']),
      promoRow(c, '@forest|mist', false, { heading: 'Gathered collections', intro: true }),
      promoRow(c, '@mushroom|moss', true),
      ctaBand(c, { tone: 'surface', split: true }),
    ] },
    { slug: 'collections', title: 'Collections', build: (c) => [
      pageTitle(c, { title: 'Collections', tone: 'surface' }),
      tabbedShelf(c, { heading: 'All the bolts' }, ['All', 'Scarves', 'Cloaks']),
      reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 2) }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'The house', tone: 'bg' }),
      imageStory(c, { photo: avatarsFor(c.site, 1)[0], side: 'left', tone: 'surface', button: true }),
      stats(c, { n: 4, tone: 'bg' }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'surface', heading: 'Visit the loom room' })] },
  ],
};
export default spec;

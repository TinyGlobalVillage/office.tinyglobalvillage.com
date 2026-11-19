// Ref — a small clothing shop on white: links left, wordmark centred, cart right; a centred row of filter words over
// a hairline, then a four-column grid of product pictures with a name and a price under each, and a centred
// link to the lookbook.
// Kept: centred filter row + rule · four-across product grid (picture · name · price) · lookbook link ·
// lookbook (wide picture + picture cards) · about · contact.
import { CW, GLYPHS, PAD, bottom, cards, contact, group, image, imageStory, pageTitle, photoBand, section, shape, splitHeading, text, tone, type Ctx, type Node, type Section, type TemplateSpec } from '../kit.ts';

const sans = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

const TINTS = ['#e8e2d8', '#d9d4cc', '#cfd6cf', '#e6d9cf', '#d8dde3', '#ece7df'];

/** Filter words over a rule, a grid of product cards, and a centred link. */
function shop(c: Ctx, o: { n: number; photos: Array<string | null> }): Section {
  const t = tone(c, 'bg');
  const layers: Node[] = [];
  const filters = ['All', 'Cloaks', 'Knits', 'Boots', 'Trinkets'];
  const fw = 120;
  const fx = (1200 - fw * filters.length) / 2;
  filters.forEach((f, i) => layers.push(text(c, { text: f, x: fx + i * fw, y: 70, w: fw, size: 14, color: i === 0 ? t.head : t.muted, weight: i === 0 ? 600 : 400, align: 'center', name: 'Filter' })));
  const rule = shape(c, { x: PAD, y: 112, w: CW, h: 1, fill: t.line, name: 'Rule' });
  layers.push(rule);
  const gap = 24;
  const cellW = (CW - gap * 3) / 4;
  const th = Math.round(cellW * 1.3);
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < o.n; i++) {
    const ph = o.photos[i % o.photos.length];
    const pic = ph
      ? image(c, { key: ph, x: 0, y: 0, w: cellW, h: th, pct: 100 })
      : group(c, { name: 'Tile', x: 0, y: 0, w: cellW, h: th, pct: 100, children: [
          shape(c, { x: 0, y: 0, w: cellW, h: th, pct: 100, fill: TINTS[i % TINTS.length], name: 'Tile fill' }),
          text(c, { text: GLYPHS[(i * 5 + 1) % GLYPHS.length], x: 0, y: th / 2 - 32, w: cellW, pct: 100, size: 46, color: 'rgba(60,50,40,0.45)', align: 'center', lh: 1.2, name: 'Glyph' }),
        ] });
    const nm = text(c, { slot: 'offering.title', index: i, x: 0, y: th + 14, w: cellW, pct: 100, size: 14, color: t.head, name: 'Name' });
    const pr = text(c, { slot: 'offering.price', index: i, x: 0, y: bottom(nm) + 4, w: cellW, pct: 100, size: 13, color: t.muted, name: 'Price' });
    const ch = bottom(pr) + 6;
    maxH = Math.max(maxH, ch);
    items.push(group(c, { name: `Product ${i + 1}`, x: 0, y: 0, w: cellW, h: ch, children: [pic, nm, pr], flow: { gap: 6, pad: 6 } }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const rows = Math.ceil(o.n / 4);
  const gy = bottom(rule) + 50;
  const gh = rows * maxH + (rows - 1) * 44;
  layers.push(group(c, { name: 'Products', x: PAD, y: gy, w: CW, h: gh, children: items, layout: { cols: 4, bp: { tablet: 2, mobile: 2 }, gap } }));
  const ln = { ...text(c, { text: 'See the lookbook ›', x: 450, y: gy + gh + 60, w: 300, size: 15, color: t.head, weight: 600, align: 'center', name: 'Lookbook link' }), href: '/lookbook' };
  layers.push(ln);
  return section(layers, bottom(ln) + 90, t.bg);
}

const spec: TemplateSpec = {
  key: 'db89c579',
  ref: 'db89c579',
  name: 'Mosswick Mercantile',
  industry: 'business',
  category: 'Business',
  description: 'A pixie outfitter’s shop window: filter words, twelve wares with their prices and a lookbook of the season.',
  palette: { bg: '#ffffff', surface: '#f5f2ee', ink: '#1e1e1e', body: '#4b4b4b', muted: '#8a8a8a', accent: '#1e1e1e', accentInk: '#ffffff', dark: '#1e1e1e', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', darkAccent: '#e6d9cf', line: 'rgba(30,30,30,0.12)' },
  fonts: { head: sans, body: sans, headWeight: 500, headTrack: 0.5, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'links left, wordmark centred, basket + search right', footer: 'white, hairline, sign-up line + three small link columns' },
  pages: [
    {
      slug: 'home',
      title: 'Shop',
      build: (c) => [shop(c, { n: 12, photos: [null, '@moss', null, null, null, null, '@candle|warm', null, null, null, null, null] })],
    },
    {
      slug: 'lookbook',
      title: 'Lookbook',
      build: (c) => [
        pageTitle(c, { title: 'The moss season', tone: 'bg' }),
        photoBand(c, { photo: '@forest|mist', tone: 'bg', h: 560 }),
        cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', photos: ['@moss', '@candle|warm', '@mushroom'], head: false, titleSlot: 'caption', bodySlot: 'offering.body', cardFill: false, imgH: 420 }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'Stitched by hand', tone: 'surface' }),
        imageStory(c, { photo: '@mushroom', side: 'right', tone: 'bg', button: false }),
        splitHeading(c, { tone: 'surface', heading: 'Slow thread, long wear', paras: 2 }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Ask the outfitter' })],
    },
  ],
};
export default spec;

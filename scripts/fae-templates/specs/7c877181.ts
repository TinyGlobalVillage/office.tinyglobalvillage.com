// Ref — airy white skincare shop: thin sans, blush accents, outline buttons, centred wordmark between search and cart.
// Kept: pale centred hero with eyebrow + thin headline + outline button · two half-width promo pictures · "best
// loved" two large ware cards with add buttons · two more half tiles (blush, words only) · three service icons.
import { button, cards, centered, contact, ctaBand, group, headBlock, pageTitle, section, shape, splitHeading, stats, text, tone, hero, bottom, GLYPHS, CW, PAD, W, type BtnLook, type Ctx, type Node, type Section, type Tone, type TemplateSpec } from '../kit.ts';
const avenir = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

type Head = { eyebrow?: boolean | string; heading?: string; align?: 'left' | 'center'; size?: number; intro?: boolean };
/** A shelf of wares (the kit has no product card): a drawn tile — a glyph on a tint — then name, price, a small button. */
function shelf(c: Ctx, o: { n: number; cols: number; tone: Tone; head?: Head; tints: string[]; ink: string; btn?: BtnLook; more?: boolean; tileH?: number }): Section {
  const t = tone(c, o.tone);
  const gap = 24;
  const cellW = (CW - gap * (o.cols - 1)) / o.cols;
  const r = c.fonts.cardRadius ?? 0;
  const layers: Node[] = [];
  let y = 90;
  if (o.head) { const hb = headBlock(c, t, { ...o.head, y }); layers.push(...hb.nodes); y = hb.y + 40; }
  const th = o.tileH ?? Math.round(cellW * 1.1);
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < o.n; i++) {
    const tile = group(c, { name: 'Picture', x: 0, y: 0, w: cellW, h: th, pct: 100, children: [
      shape(c, { x: 0, y: 0, w: cellW, h: th, pct: 100, fill: o.tints[i % o.tints.length], radius: r, name: 'Tile' }),
      text(c, { text: GLYPHS[(i * 5 + 2) % GLYPHS.length], x: 0, y: th / 2 - 46, w: cellW, pct: 100, size: 72, color: o.ink, align: 'center', lh: 1.2, name: 'Ware' }),
    ] });
    const ti = text(c, { slot: 'offering.title', x: 0, y: th + 16, w: cellW, pct: 100, size: 18, color: t.head, font: 'head', role: 'h3', align: 'center', name: 'Name' });
    const pr = text(c, { slot: 'offering.price', x: 0, y: bottom(ti) + 6, w: cellW, pct: 100, size: 15, color: t.body, align: 'center', name: 'Price' });
    const kids: Node[] = [tile, ti, pr];
    let cy = bottom(pr);
    if (o.btn) { const b = button(c, { text: 'Add to basket', href: '/shop', x: 0, y: cy + 14, pct: 100, look: o.btn, size: 13 }); kids.push(b); cy = bottom(b); }
    maxH = Math.max(maxH, cy + 6);
    items.push(group(c, { name: `Ware ${i + 1}`, x: 0, y: 0, w: cellW, h: cy + 6, children: kids, flow: { gap: 8, pad: 6 } }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const rows = Math.ceil(o.n / o.cols);
  const gh = rows * maxH + (rows - 1) * gap;
  layers.push(group(c, { name: 'Shelf', x: PAD, y, w: CW, h: gh, children: items, layout: { cols: o.cols, bp: { tablet: Math.min(o.cols, 2), mobile: o.cols >= 4 ? 2 : 1 }, gap } }));
  y += gh;
  if (o.more) {
    const b = button(c, { slot: 'cta', href: '/shop', x: 0, y: y + 44, look: 'outline' });
    b.box.desktop.x = Math.round((W - b.box.desktop.w) / 2);
    layers.push(b);
    y = bottom(b);
  }
  return section(layers, y + 90, t.bg);
}

/** Two blush tiles side by side, words only: eyebrow, heading, outline button. */
function blushPair(c: Ctx) {
  const gap = 24;
  const cw = (CW - gap) / 2;
  const tiles = [0, 1].map((i) => group(c, { name: `Tile ${i + 1}`, x: 0, y: 0, w: cw, h: 320, fill: i ? '#efe2dc' : '#f4e8e3', flow: { gap: 14, pad: 48 }, children: [
    text(c, { slot: 'eyebrow', x: 48, y: 56, w: cw - 96, pct: ((cw - 96) / cw) * 100, size: 12, color: c.pal.accent, weight: 600, upper: true, track: 2, name: 'Eyebrow' }),
    text(c, { slot: 'headline', x: 48, y: 90, w: cw - 96, pct: ((cw - 96) / cw) * 100, size: 32, color: c.pal.ink, font: 'head', name: 'Heading' }),
    button(c, { slot: 'cta', href: '/shop', x: 48, y: 200, look: 'outline' }),
  ] }));
  const g = group(c, { name: 'Tiles', x: PAD, y: 40, w: CW, h: 320, children: tiles, layout: { cols: 2, bp: { tablet: 2, mobile: 1 }, gap } });
  return section([g], 40 + 320 + 60, c.pal.bg);
}

const tints = ['#f4e8e3', '#ede6e1', '#f1ebe6', '#e9ddd6'];
const spec: TemplateSpec = {
  key: '7c877181', ref: '7c877181', name: 'Dewpetal Apothecary', industry: 'ecommerce', category: 'Ecommerce',
  description: 'A faerie dew-balm shop in blush and white: a hushed centred hero, half-width promos, two big best-loved jars.',
  palette: { bg: '#ffffff', surface: '#f4f2f0', ink: '#2a2523', body: '#5a524e', muted: '#8a817c', accent: '#9c5f57', accentInk: '#ffffff', dark: '#2a2523', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#f0c9c1', line: 'rgba(42,37,35,0.14)' },
  fonts: { head: avenir, body: avenir, headWeight: 300, headTrack: 0.5, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'blush notice bar; search left, centred wordmark, links centre row, sign-in + basket right', footer: 'white, four thin link columns + newsletter line' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'plain-center', tone: 'surface', eyebrow: true, h: 560, headSize: 50 }),
      cards(c, { n: 2, cols: 2, kind: 'photo', tone: 'bg', photos: ['@nature|flowers', '@candle|light'], cardFill: false, imgH: 380, align: 'center', head: false, link: '/shop' }),
      shelf(c, { n: 2, cols: 2, tone: 'bg', head: { heading: 'Best loved' }, tints, ink: '#9c5f57', btn: 'outline', tileH: 420 }),
      blushPair(c),
      cards(c, { n: 3, cols: 3, kind: 'icon', tone: 'surface', cardFill: false, head: { heading: 'Gentle rituals' } }),
    ] },
    { slug: 'shop', title: 'Shop', build: (c) => [
      pageTitle(c, { title: 'The dew shelf', tone: 'surface' }),
      shelf(c, { n: 8, cols: 4, tone: 'bg', tints, ink: '#9c5f57', btn: 'outline' }),
      ctaBand(c, { tone: 'accent' }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About', tone: 'bg' }),
      splitHeading(c, { tone: 'surface', paras: 2, heading: 'Gathered at first light' }),
      stats(c, { n: 3, tone: 'bg' }),
      centered(c, { tone: 'surface', slot: 'newsletter', heading: 'Letters from the meadow', button: true }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Write to the stillroom' })] },
  ],
};
export default spec;

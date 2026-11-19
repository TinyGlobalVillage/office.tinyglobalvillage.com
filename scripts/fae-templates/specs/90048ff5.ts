// Ref — white fashion store in wide-spaced capitals with copper outline buttons and a black sale band.
// Kept: photo hero (words left, eyebrow, one button) · black sale band with a price line and a four-box countdown ·
// three staggered collection columns (words over a tall picture, the middle one picture-first) + button · "picked
// by the village" four ware cards + button · split (picture left, heading + words right).
import { button, contact, faq, group, headBlock, hero, image, imageStory, pageTitle, reviews, section, shape, stackDown, stackLast, text, tone, avatarsFor, bottom, GLYPHS, CW, PAD, W, type Ctx, type Node, type Section, type Tone, type TemplateSpec } from '../kit.ts';
const avenir = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";
const COPPER = '#a5673f';

type Head = { eyebrow?: boolean | string; heading?: string; align?: 'left' | 'center'; size?: number; intro?: boolean };
/** A shelf of wares (the kit has no product card): a drawn tile — a glyph on a tint — then name, price, and a
 *  copper "see more" button under the row. */
function shelf(c: Ctx, o: { n: number; cols: number; tone: Tone; head?: Head; more?: boolean }): Section {
  const t = tone(c, o.tone);
  const gap = 24;
  const cellW = (CW - gap * (o.cols - 1)) / o.cols;
  const layers: Node[] = [];
  let y = 90;
  if (o.head) { const hb = headBlock(c, t, { ...o.head, y }); layers.push(...hb.nodes); y = hb.y + 40; }
  const th = Math.round(cellW * 1.25);
  const tints = ['#f3ede8', '#ebe5df', '#f1e8e0', '#e8e0d8'];
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < o.n; i++) {
    const tile = group(c, { name: 'Picture', x: 0, y: 0, w: cellW, h: th, pct: 100, children: [
      shape(c, { x: 0, y: 0, w: cellW, h: th, pct: 100, fill: tints[i % tints.length], name: 'Tile' }),
      text(c, { text: GLYPHS[(i * 5 + 1) % GLYPHS.length], x: 0, y: th / 2 - 42, w: cellW, pct: 100, size: 64, color: COPPER, align: 'center', lh: 1.2, name: 'Ware' }),
    ] });
    const ti = text(c, { slot: 'offering.title', x: 0, y: th + 16, w: cellW, pct: 100, size: 14, color: t.head, weight: 600, upper: true, track: 2, align: 'center', role: 'h3', name: 'Name' });
    const pr = text(c, { slot: 'offering.price', x: 0, y: bottom(ti) + 6, w: cellW, pct: 100, size: 15, color: t.body, align: 'center', name: 'Price' });
    maxH = Math.max(maxH, bottom(pr) + 6);
    items.push(group(c, { name: `Ware ${i + 1}`, x: 0, y: 0, w: cellW, h: bottom(pr) + 6, children: [tile, ti, pr], flow: { gap: 8, pad: 6 } }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const rows = Math.ceil(o.n / o.cols);
  const gh = rows * maxH + (rows - 1) * gap;
  layers.push(group(c, { name: 'Shelf', x: PAD, y, w: CW, h: gh, children: items, layout: { cols: o.cols, bp: { tablet: Math.min(o.cols, 2), mobile: 2 }, gap } }));
  y += gh;
  if (o.more) {
    const b = button(c, { slot: 'cta', href: '/shop', x: 0, y: y + 44, look: 'outline' });
    b.box.desktop.x = Math.round((W - b.box.desktop.w) / 2);
    layers.push(b);
    y = bottom(b);
  }
  return section(layers, y + 90, t.bg);
}

/** The black sale band: words left, four countdown boxes right (drawn — no live timer), an outline button. */
function countdown(c: Ctx) {
  const left = stackDown([
    text(c, { slot: 'eyebrow', x: PAD, y: 0, w: 440, size: 12, color: '#d9a27a', weight: 600, upper: true, track: 3, name: 'Eyebrow' }),
    text(c, { text: 'The Frost Moon sale', x: PAD, y: 0, w: 440, size: 34, color: '#ffffff', font: 'head', upper: true, track: 3, name: 'Heading' }),
    text(c, { slot: 'offering.price', x: PAD, y: 0, w: 440, size: 18, color: 'rgba(255,255,255,0.8)', name: 'Price' }),
  ], 90, [12, 14]);
  const b = button(c, { slot: 'cta', href: '/shop', x: PAD, y: left.y + 28, look: 'ghost-light' });
  const bw = 120;
  const boxes = ['Days', 'Hours', 'Minutes', 'Seconds'].map((lab, i) => group(c, { name: lab, x: 0, y: 0, w: bw, h: 120, fill: '#ffffff', children: [
    text(c, { text: ['03', '14', '27', '50'][i], x: 0, y: 22, w: bw, pct: 100, size: 40, color: '#151515', font: 'head', align: 'center', lh: 1.1, name: 'Count' }),
    text(c, { text: lab, x: 0, y: 76, w: bw, pct: 100, size: 11, color: '#6b6b6b', upper: true, track: 2, align: 'center', name: 'Unit' }),
  ] }));
  const gw = bw * 4 + 16 * 3;
  const H = Math.max(bottom(b), 90 + 120) + 90;
  const row = group(c, { name: 'Countdown', x: W - PAD - gw, y: (H - 120) / 2, w: gw, h: 120, children: boxes, layout: { cols: 4, bp: { tablet: 4, mobile: 4 }, gap: 16 } });
  return section([...left.nodes, ...stackLast([row]), ...stackLast([b], 60)], H, c.pal.dark);
}

/** Three collection columns, staggered: words over a tall picture, the middle one with its picture first. */
function staggered(c: Ctx, photos: string[]) {
  const t = tone(c, 'bg');
  const gap = 40;
  const cw = (CW - gap * 2) / 3;
  const ph = 460;
  const cols = photos.map((p, i) => {
    const words = [
      text(c, { slot: 'offering.title', x: 0, y: 0, w: cw, pct: 100, size: 20, color: t.head, font: 'head', upper: true, track: 3, role: 'h3', name: 'Title' }),
      text(c, { slot: 'offering.body', x: 0, y: 0, w: cw, pct: 100, size: 15, color: t.body, name: 'Body' }),
    ];
    const pic = image(c, { key: p, x: 0, y: 0, w: cw, h: ph, pct: 100 });
    const st = stackDown(i === 1 ? [pic, ...words] : [...words, pic], 0, 16);
    return group(c, { name: `Collection ${i + 1}`, x: 0, y: 0, w: cw, h: st.y, children: st.nodes, flow: { gap: 16 } });
  });
  const gh = Math.max(...cols.map((g) => g.box.desktop.h));
  for (const g of cols) g.box.desktop.h = gh;
  const g = group(c, { name: 'Collections', x: PAD, y: 100, w: CW, h: gh, children: cols, layout: { cols: 3, bp: { tablet: 1, mobile: 1 }, gap } });
  const b = button(c, { slot: 'cta', href: '/shop', x: 0, y: 100 + gh + 48, look: 'outline' });
  b.box.desktop.x = Math.round((W - b.box.desktop.w) / 2);
  return section([g, b], bottom(b) + 100, t.bg);
}

const spec: TemplateSpec = {
  key: '90048ff5', ref: '90048ff5', name: 'Copperwing Wardrobe', industry: 'ecommerce', category: 'Ecommerce',
  description: 'A faerie wardrobe in white and copper, set in wide capitals: a photo hero, a black sale countdown, staggered collection columns.',
  palette: { bg: '#ffffff', surface: '#f6f2ee', ink: '#151515', body: '#4a4a4a', muted: '#7a7a7a', accent: COPPER, accentInk: '#ffffff', dark: '#111111', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#d9a27a', line: 'rgba(21,21,21,0.14)' },
  fonts: { head: avenir, body: avenir, headWeight: 500, headTrack: 3, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'black notice bar; wordmark left, wide-spaced capital links centre, search + account + basket right', footer: 'white, four link columns + newsletter field, copper rule' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: '@fabric|warm', h: 680, eyebrow: true, buttons: 1, headSize: 50, overlay: 'rgba(20,14,10,0.4)' }),
      countdown(c),
      staggered(c, ['@forest|mist', '@candle|light', '@mushroom|moss']),
      shelf(c, { n: 4, cols: 4, tone: 'bg', head: { heading: 'Picked by the village' }, more: true }),
      imageStory(c, { photo: avatarsFor(c.site, 3)[0], side: 'left', tone: 'surface', button: true }),
    ] },
    { slug: 'shop', title: 'Shop', build: (c) => [
      pageTitle(c, { title: 'The wardrobe', tone: 'surface' }),
      shelf(c, { n: 8, cols: 4, tone: 'bg' }),
      faq(c, { n: 4, tone: 'surface', head: { heading: 'Fittings and returns' } }),
    ] },
    { slug: 'lookbook', title: 'Lookbook', build: (c) => [
      pageTitle(c, { title: 'Lookbook', tone: 'bg' }),
      staggered(c, ['@forest|mist', '@candle|light', '@mushroom|moss']),
      reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 1) }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Visit the wardrobe' })] },
  ],
};
export default spec;

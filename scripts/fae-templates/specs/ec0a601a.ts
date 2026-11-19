// Ref — warm taupe furniture shop: serif headlines over sans, a photo hero with words left, a four-point trust strip.
// Kept: photo hero (words left, eyebrow, one small white button) · four-point trust strip with icons · three centred
// picture cards on warm off-white · split band (full-bleed picture left, taupe panel right with heading + button) ·
// "maker's guide" words left beside a drawn panel.
import { button, cards, contact, faq, group, headBlock, hero, imageStory, listPanel, pageTitle, posts, reviews, section, shape, text, tone, zigzag, avatarsFor, bottom, GLYPHS, CW, PAD, W, type Ctx, type Node, type Section, type Tone, type TemplateSpec } from '../kit.ts';
const serif = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const rooms = ['@candle|light', '@library|study', '@moss|nature'];

type Head = { eyebrow?: boolean | string; heading?: string; align?: 'left' | 'center'; size?: number; intro?: boolean };
/** A shelf of wares (the kit has no product card): a drawn tile — a glyph on a tint — then name, price, a small button. */
function shelf(c: Ctx, o: { n: number; cols: number; tone: Tone; head?: Head; tints: string[]; ink: string }): Section {
  const t = tone(c, o.tone);
  const gap = 28;
  const cellW = (CW - gap * (o.cols - 1)) / o.cols;
  const r = c.fonts.cardRadius ?? 0;
  const layers: Node[] = [];
  let y = 90;
  if (o.head) { const hb = headBlock(c, t, { ...o.head, y }); layers.push(...hb.nodes); y = hb.y + 40; }
  const th = Math.round(cellW * 0.8);
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < o.n; i++) {
    const tile = group(c, { name: 'Picture', x: 0, y: 0, w: cellW, h: th, pct: 100, children: [
      shape(c, { x: 0, y: 0, w: cellW, h: th, pct: 100, fill: o.tints[i % o.tints.length], radius: r, name: 'Tile' }),
      text(c, { text: GLYPHS[(i * 3 + 4) % GLYPHS.length], x: 0, y: th / 2 - 44, w: cellW, pct: 100, size: 68, color: o.ink, align: 'center', lh: 1.2, name: 'Ware' }),
    ] });
    const ti = text(c, { slot: 'offering.title', x: 0, y: th + 16, w: cellW, pct: 100, size: 20, color: t.head, font: 'head', role: 'h3', align: 'center', name: 'Name' });
    const pr = text(c, { slot: 'offering.price', x: 0, y: bottom(ti) + 6, w: cellW, pct: 100, size: 15, color: t.body, align: 'center', name: 'Price' });
    const b = button(c, { text: 'Add to basket', href: '/shop', x: 0, y: bottom(pr) + 14, pct: 100, look: 'outline', size: 13 });
    maxH = Math.max(maxH, bottom(b) + 6);
    items.push(group(c, { name: `Ware ${i + 1}`, x: 0, y: 0, w: cellW, h: bottom(b) + 6, children: [tile, ti, pr, b], flow: { gap: 8, pad: 6 } }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const rows = Math.ceil(o.n / o.cols);
  const gh = rows * maxH + (rows - 1) * gap;
  layers.push(group(c, { name: 'Shelf', x: PAD, y, w: CW, h: gh, children: items, layout: { cols: o.cols, bp: { tablet: Math.min(o.cols, 2), mobile: 1 }, gap } }));
  return section(layers, y + gh + 90, t.bg);
}

const spec: TemplateSpec = {
  key: 'ec0a601a', ref: 'ec0a601a', name: 'Burrowcraft Furnishers', industry: 'ecommerce', category: 'Ecommerce',
  description: 'A gnome furniture burrow in warm taupe: a photo hero, a trust strip of promises, three rooms, a split band with a maker.',
  palette: { bg: '#f8f4ef', surface: '#efe8df', ink: '#2d2620', body: '#5a5047', muted: '#857a6f', accent: '#7a6655', accentInk: '#ffffff', dark: '#3b322b', darkInk: '#f8f4ef', darkBody: 'rgba(248,244,239,0.82)', darkAccent: '#e4d3bf', line: 'rgba(45,38,32,0.14)' },
  fonts: { head: serif, body: sans, headWeight: 400, headTrack: -0.3, btnRadius: 2, btnUpper: false, cardRadius: 0 },
  chrome: { nav: 'transparent over the hero: serif wordmark left, links centre, search + basket right', footer: 'taupe, wordmark + newsletter left, three link columns right' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: '@interior|warm', h: 640, eyebrow: true, buttons: 1, headSize: 58, overlay: 'rgba(40,30,22,0.42)' }),
      cards(c, { n: 4, cols: 4, kind: 'icon', tone: 'surface', cardFill: false, head: false, bodySlot: 'caption' }),
      cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', photos: rooms, cardFill: false, imgH: 340, align: 'center', head: { heading: 'Rooms for every burrow' } }),
      imageStory(c, { photo: avatarsFor(c.site, 2)[0], side: 'left', tone: 'accent', inset: false, h: 620, button: true, eyebrow: true }),
      zigzag(c, { rows: [{ art: listPanel({ card: '#ffffff', ink: '#2d2620', muted: '#857a6f', accent: '#7a6655', line: 'rgba(45,38,32,0.14)', radius: 4, avatars: avatarsFor(c.site, 3) }), pill: true }], tone: 'bg', startRight: false }),
    ] },
    { slug: 'shop', title: 'Shop', build: (c) => [
      pageTitle(c, { title: 'Furnishings', tone: 'surface' }),
      shelf(c, { n: 6, cols: 3, tone: 'bg', tints: ['#efe5d8', '#e7ddd0', '#f1e9de'], ink: '#7a6655' }),
      reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 4) }),
    ] },
    { slug: 'guide', title: "Maker's guide", build: (c) => [
      pageTitle(c, { title: "The maker's guide", tone: 'bg', align: 'left' }),
      posts(c, { n: 3, photos: rooms, tone: 'surface', head: false }),
      faq(c, { n: 5, tone: 'bg' }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'surface', heading: 'Visit the showroom' })] },
  ],
};
export default spec;

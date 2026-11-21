// Ref — winter market on cream: indigo nav box, a dark photo hero with a date line and a chat tab, red titles.
// Kept: centred photo hero with eyebrow date + one white button + a floating contact tab · "shop by category"
// picture cards with red titles and underlined links on a cream band · centred emblem + "become a vendor" heading +
// red button · bordered split (picture left, words right) · cream footer.
import { button, cards, centered, contact, faq, group, headBlock, hero, listPanel, pageTitle, pricing, reviews, section, shape, steps, text, tone, zigzag, avatarsFor, bottom, GLYPHS, CW, PAD, W, type BtnLook, type Ctx, type Node, type Section, type Tone, type TemplateSpec } from '../kit.ts';
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

type Head = { eyebrow?: boolean | string; heading?: string; align?: 'left' | 'center'; size?: number; intro?: boolean };
/** A shelf of wares (the kit has no product card): a drawn tile — a glyph on a tint — then name, price, a small button. */
function shelf(c: Ctx, o: { n: number; cols: number; tone: Tone; head?: Head; tints: string[]; ink: string; btn?: BtnLook; tileH?: number }): Section {
  const t = tone(c, o.tone);
  const gap = 24;
  const cellW = (CW - gap * (o.cols - 1)) / o.cols;
  const r = c.fonts.cardRadius ?? 0;
  const layers: Node[] = [];
  let y = 90;
  if (o.head) { const hb = headBlock(c, t, { ...o.head, y }); layers.push(...hb.nodes); y = hb.y + 40; }
  const th = o.tileH ?? Math.round(cellW * 0.9);
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < o.n; i++) {
    const tile = group(c, { name: 'Picture', x: 0, y: 0, w: cellW, h: th, pct: 100, children: [
      shape(c, { x: 0, y: 0, w: cellW, h: th, pct: 100, fill: o.tints[i % o.tints.length], radius: r, name: 'Tile' }),
      text(c, { text: GLYPHS[(i * 7 + 1) % GLYPHS.length], x: 0, y: th / 2 - 44, w: cellW, pct: 100, size: 68, color: o.ink, align: 'center', lh: 1.2, name: 'Ware' }),
    ] });
    const ti = text(c, { slot: 'offering.title', x: 0, y: th + 16, w: cellW, pct: 100, size: 18, color: c.pal.accent, font: 'head', role: 'h3', name: 'Name' });
    const pr = text(c, { slot: 'offering.price', x: 0, y: bottom(ti) + 6, w: cellW, pct: 100, size: 15, color: t.body, weight: 600, name: 'Price' });
    const kids: Node[] = [tile, ti, pr];
    let cy = bottom(pr);
    if (o.btn) { const b = button(c, { text: 'Add to basket', href: '/market', x: 0, y: cy + 14, pct: 100, look: o.btn, size: 13 }); kids.push(b); cy = bottom(b); }
    maxH = Math.max(maxH, cy + 6);
    items.push(group(c, { name: `Ware ${i + 1}`, x: 0, y: 0, w: cellW, h: cy + 6, children: kids, flow: { gap: 8, pad: 6 } }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const rows = Math.ceil(o.n / o.cols);
  const gh = rows * maxH + (rows - 1) * gap;
  layers.push(group(c, { name: 'Shelf', x: PAD, y, w: CW, h: gh, children: items, layout: { cols: o.cols, bp: { tablet: Math.min(o.cols, 2), mobile: o.cols >= 4 ? 2 : 1 }, gap } }));
  return section(layers, y + gh + 90, t.bg);
}

const tints = ['#efe3cc', '#e6dcf2', '#f4dcd6', '#e3ead8'];
const spec: TemplateSpec = {
  key: '85d0ae34', ref: '85d0ae34', name: 'Frostfern Fair', industry: 'ecommerce', category: 'Ecommerce',
  description: 'A gnome winter market on cream and indigo: a dark photo hero with a date line, red-titled category cards, a call for stallholders.',
  palette: { bg: '#fbf5ea', surface: '#f3e8d4', ink: '#22184a', body: '#4a4363', muted: '#756e8c', accent: '#b8232a', accentInk: '#ffffff', dark: '#2e2470', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.82)', darkAccent: '#ffd9a0', line: 'rgba(34,24,74,0.16)' },
  fonts: { head: sans, body: sans, headWeight: 700, headTrack: -0.3, btnRadius: 6, btnUpper: false, cardRadius: 12 },
  chrome: { nav: 'indigo rounded nav box: logo left, links right, red CTA', footer: 'cream, brand + blurb left, four link columns' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-center', photo: '@forest|mist', h: 640, eyebrow: true, buttons: 1, overlay: 'rgba(20,14,50,0.58)', sideNote: true }),
      cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'surface', photos: ['@bakery|bread', '@candle|light', '@mushroom|moss'], link: '/market', imgH: 240, head: { heading: 'Wander by stall' } }),
      centered(c, { tone: 'bg', eyebrow: '❄  ✦  ❄', heading: 'Keep a stall at the fair', button: true }),
      zigzag(c, { rows: [{ art: listPanel({ card: '#ffffff', ink: '#22184a', muted: '#756e8c', accent: '#b8232a', line: 'rgba(34,24,74,0.14)', radius: 12, avatars: avatarsFor(c.site, 1) }), bullets: 3 }], tone: 'surface', startRight: true }),
      reviews(c, { n: 3, tone: 'bg', avatars: avatarsFor(c.site, 4), head: { heading: 'Heard by the brazier' } }),
    ] },
    { slug: 'market', title: 'Market', build: (c) => [
      pageTitle(c, { title: 'The market', tone: 'surface' }),
      shelf(c, { n: 8, cols: 4, tone: 'bg', tints, ink: '#2e2470', btn: 'solid' }),
      faq(c, { n: 4, tone: 'surface' }),
    ] },
    { slug: 'vendors', title: 'Vendors', build: (c) => [
      pageTitle(c, { title: 'Become a stallholder', tone: 'bg' }),
      steps(c, { n: 3, tone: 'surface', head: { heading: 'From lantern-up to last bell' } }),
      pricing(c, { n: 3, tone: 'bg', head: { heading: 'Stall fees', intro: true } }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'surface', heading: 'Find the fair' })] },
  ],
};
export default spec;

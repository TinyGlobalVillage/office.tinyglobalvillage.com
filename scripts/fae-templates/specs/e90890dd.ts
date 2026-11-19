// Ref — black-and-white paper shop: thin sans headings, typewriter body, pipe-separated links, square everything.
// Kept: four collection cards (a ware picture over a black caption block with "see all") · "what's new" two large
// picture cards with a title and a small link · centred "join the club" newsletter + button · ruled footer columns.
import { button, cards, centered, contact, faq, group, headBlock, pageTitle, section, shape, splitHeading, team, text, tone, avatarsFor, bottom, GLYPHS, CW, PAD, W, type BtnLook, type Ctx, type Node, type Section, type Tone, type TemplateSpec } from '../kit.ts';
const thin = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const mono = "'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace";

/** Collection cards: a drawn ware tile above a black caption block holding the name and a "see all" link. */
function collections(c: Ctx) {
  const t = tone(c, 'bg');
  const n = 4;
  const gap = 20;
  const cw = (CW - gap * (n - 1)) / n;
  const hb = headBlock(c, t, { heading: 'Shop the drawers', y: 80, size: 34 });
  const y = hb.y + 40;
  const tints = ['#f1f0ec', '#e9e7e1', '#f4f2ee', '#e4e2dc'];
  const items = Array.from({ length: n }, (_, i) => group(c, { name: `Drawer ${i + 1}`, x: 0, y: 0, w: cw, h: 400, children: [
    group(c, { name: 'Picture', x: 0, y: 0, w: cw, h: 280, pct: 100, children: [
      shape(c, { x: 0, y: 0, w: cw, h: 280, pct: 100, fill: tints[i], name: 'Tile' }),
      text(c, { text: ['✉', '✎', '❦', '✧'][i], x: 0, y: 100, w: cw, pct: 100, size: 64, color: '#111111', align: 'center', lh: 1.2, name: 'Ware' }),
    ] }),
    group(c, { name: 'Caption', x: 0, y: 280, w: cw, h: 120, pct: 100, fill: '#111111', children: [
      text(c, { slot: 'offering.title', x: 20, y: 24, w: cw - 40, pct: ((cw - 40) / cw) * 100, size: 18, color: '#ffffff', font: 'head', weight: 300, role: 'h3', name: 'Name' }),
      { ...text(c, { text: 'See all →', x: 20, y: 70, w: cw - 40, pct: ((cw - 40) / cw) * 100, size: 13, color: 'rgba(255,255,255,0.75)', name: 'Link' }), href: '/shop' },
    ] }),
  ] }));
  const g = group(c, { name: 'Drawers', x: PAD, y, w: CW, h: 400, children: items, layout: { cols: n, bp: { tablet: 2, mobile: 1 }, gap } });
  return section([...hb.nodes, g], y + 400 + 90, t.bg);
}

type Head = { eyebrow?: boolean | string; heading?: string; align?: 'left' | 'center'; size?: number; intro?: boolean };
/** A shelf of wares (the kit has no product card): a drawn tile — a glyph on a tint — then name, price, a small button. */
function shelf(c: Ctx, o: { n: number; cols: number; tone: Tone; head?: Head; tints: string[]; ink: string; btn?: BtnLook }): Section {
  const t = tone(c, o.tone);
  const gap = 20;
  const cellW = (CW - gap * (o.cols - 1)) / o.cols;
  const layers: Node[] = [];
  let y = 90;
  if (o.head) { const hb = headBlock(c, t, { ...o.head, y }); layers.push(...hb.nodes); y = hb.y + 40; }
  const th = Math.round(cellW);
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < o.n; i++) {
    const tile = group(c, { name: 'Picture', x: 0, y: 0, w: cellW, h: th, pct: 100, children: [
      shape(c, { x: 0, y: 0, w: cellW, h: th, pct: 100, fill: o.tints[i % o.tints.length], name: 'Tile' }),
      text(c, { text: GLYPHS[(i * 5 + 3) % GLYPHS.length], x: 0, y: th / 2 - 42, w: cellW, pct: 100, size: 64, color: o.ink, align: 'center', lh: 1.2, name: 'Ware' }),
    ] });
    const ti = text(c, { slot: 'offering.title', x: 0, y: th + 16, w: cellW, pct: 100, size: 15, color: t.head, name: 'Name', role: 'h3' });
    const pr = text(c, { slot: 'offering.price', x: 0, y: bottom(ti) + 4, w: cellW, pct: 100, size: 14, color: t.muted, name: 'Price' });
    const kids: Node[] = [tile, ti, pr];
    let cy = bottom(pr);
    if (o.btn) { const b = button(c, { text: 'Add to basket', href: '/shop', x: 0, y: cy + 14, pct: 100, look: o.btn, size: 12 }); kids.push(b); cy = bottom(b); }
    maxH = Math.max(maxH, cy + 6);
    items.push(group(c, { name: `Ware ${i + 1}`, x: 0, y: 0, w: cellW, h: cy + 6, children: kids, flow: { gap: 8, pad: 6 } }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const rows = Math.ceil(o.n / o.cols);
  const gh = rows * maxH + (rows - 1) * gap;
  layers.push(group(c, { name: 'Shelf', x: PAD, y, w: CW, h: gh, children: items, layout: { cols: o.cols, bp: { tablet: Math.min(o.cols, 2), mobile: o.cols >= 4 ? 2 : 1 }, gap } }));
  return section(layers, y + gh + 90, t.bg);
}

const spec: TemplateSpec = {
  key: 'e90890dd', ref: 'e90890dd', name: 'Quillmoss Stationers', industry: 'ecommerce', category: 'Ecommerce',
  description: 'A gnome paper-and-ink shop in black and white: typewriter words, collection drawers with black captions, a quill club sign-up.',
  palette: { bg: '#ffffff', surface: '#f4f3f0', ink: '#111111', body: '#3a3a3a', muted: '#6e6e6e', accent: '#111111', accentInk: '#ffffff', dark: '#111111', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', line: 'rgba(17,17,17,0.2)' },
  fonts: { head: thin, body: mono, headWeight: 300, headTrack: 0.5, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'black notice bar; search left, centred wordmark, pipe-separated links centre, sign-in + basket right', footer: 'four ruled columns: shop, policies, hours, visit' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      collections(c),
      cards(c, { n: 2, cols: 2, kind: 'photo', tone: 'bg', photos: ['@books|study', '@desk|library'], cardFill: false, imgH: 460, link: '/shop', head: { heading: "What's new on the desk", size: 34 } }),
      centered(c, { tone: 'surface', heading: 'Join the quill club', slot: 'newsletter', size: 34, button: true }),
    ] },
    { slug: 'shop', title: 'Shop', build: (c) => [
      pageTitle(c, { title: 'Shop all', tone: 'bg' }),
      shelf(c, { n: 8, cols: 4, tone: 'bg', tints: ['#f1f0ec', '#e9e7e1'], ink: '#111111', btn: 'outline' }),
      faq(c, { n: 4, tone: 'surface', head: { heading: 'Post and returns' } }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About the stationery nook', tone: 'surface' }),
      splitHeading(c, { tone: 'bg', paras: 2, heading: 'Pressed under the old oak' }),
      team(c, { n: 3, avatars: avatarsFor(c.site, 5), tone: 'surface', head: false }),
    ] },
    { slug: 'visit', title: 'Visit', build: (c) => [contact(c, { tone: 'bg', heading: 'Come visit the shop' })] },
  ],
};
export default spec;

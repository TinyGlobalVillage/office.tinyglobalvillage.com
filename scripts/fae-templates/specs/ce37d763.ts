// Ref — outdoor outfitter in white, beige and forest green: heavy geometric capitals, photo bands, square buttons.
// Kept: photo hero with a big bold headline · centred "explore the latest" heading + paragraph · three picture
// category cards · beige newsletter band + green button · a forest-green call band · four ware cards · a closing
// band of trail numbers.
import { button, cards, centered, contact, ctaBand, faq, group, headBlock, hero, pageTitle, posts, section, shape, stats, text, tone, bottom, GLYPHS, CW, PAD, type Ctx, type Node, type Section, type Tone, type TemplateSpec } from '../kit.ts';
const grot = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const trails = ['@nature', '@nature#2', '@mist|landscape'];

type Head = { eyebrow?: boolean | string; heading?: string; align?: 'left' | 'center'; size?: number; intro?: boolean };
/** A shelf of wares (the kit has no product card): a drawn tile — a glyph on a tint — then name and price, no button. */
function shelf(c: Ctx, o: { n: number; cols: number; tone: Tone; head?: Head; tints: string[]; ink: string; more?: boolean }): Section {
  const t = tone(c, o.tone);
  const gap = 20;
  const cellW = (CW - gap * (o.cols - 1)) / o.cols;
  const layers: Node[] = [];
  let y = 90;
  if (o.head) { const hb = headBlock(c, t, { ...o.head, y }); layers.push(...hb.nodes); y = hb.y + 40; }
  const th = Math.round(cellW * 1.05);
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < o.n; i++) {
    const tile = group(c, { name: 'Picture', x: 0, y: 0, w: cellW, h: th, pct: 100, children: [
      shape(c, { x: 0, y: 0, w: cellW, h: th, pct: 100, fill: o.tints[i % o.tints.length], name: 'Tile' }),
      text(c, { text: GLYPHS[(i * 5 + 6) % GLYPHS.length], x: 0, y: th / 2 - 42, w: cellW, pct: 100, size: 64, color: o.ink, align: 'center', lh: 1.2, name: 'Ware' }),
    ] });
    const ti = text(c, { slot: 'offering.title', x: 0, y: th + 16, w: cellW, pct: 100, size: 15, color: t.head, font: 'head', weight: 700, upper: true, track: 1, role: 'h3', name: 'Name' });
    const pr = text(c, { slot: 'offering.price', x: 0, y: bottom(ti) + 6, w: cellW, pct: 100, size: 15, color: c.pal.accent, weight: 600, name: 'Price' });
    maxH = Math.max(maxH, bottom(pr) + 6);
    items.push(group(c, { name: `Ware ${i + 1}`, x: 0, y: 0, w: cellW, h: bottom(pr) + 6, children: [tile, ti, pr], flow: { gap: 8, pad: 6 } }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const rows = Math.ceil(o.n / o.cols);
  const gh = rows * maxH + (rows - 1) * gap;
  layers.push(group(c, { name: 'Shelf', x: PAD, y, w: CW, h: gh, children: items, layout: { cols: o.cols, bp: { tablet: Math.min(o.cols, 2), mobile: 2 }, gap } }));
  y += gh;
  if (o.more) {
    const b = button(c, { slot: 'cta', href: '/shop', x: 0, y: y + 44, look: 'solid' });
    b.box.desktop.x = Math.round((1200 - b.box.desktop.w) / 2);
    layers.push(b);
    y = bottom(b);
  }
  return section(layers, y + 90, t.bg);
}

const tints = ['#ece6da', '#e2e8df', '#efe9de', '#dfe5dc'];
const spec: TemplateSpec = {
  key: 'ce37d763', ref: 'ce37d763', name: 'Pinecap Outfitters', industry: 'ecommerce', category: 'Ecommerce',
  description: 'An elven trail outfitter in forest green and beige: heavy capitals over photo bands, three trail categories, a gear shelf.',
  palette: { bg: '#ffffff', surface: '#efe9df', ink: '#1b1f1a', body: '#454b43', muted: '#737a70', accent: '#2f5a3a', accentInk: '#ffffff', dark: '#1f2b22', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#b9d6a8', line: 'rgba(27,31,26,0.14)' },
  fonts: { head: grot, body: sans, headWeight: 800, headTrack: 0.5, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'transparent over the hero: wordmark left, capital links centre, account + basket right', footer: 'forest green, wordmark + four link columns + socials' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: '@forest', h: 660, buttons: 1, headSize: 62, overlay: 'rgba(14,22,16,0.45)' }),
      centered(c, { tone: 'bg', eyebrow: true, heading: 'Explore the new trail gear', size: 36 }),
      cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', photos: trails, cardFill: false, imgH: 420, align: 'center', head: false, link: '/shop' }),
      centered(c, { tone: 'surface', heading: 'Keep in touch by owl', slot: 'newsletter', size: 32, button: true }),
      ctaBand(c, { tone: 'accent' }),
      shelf(c, { n: 4, cols: 4, tone: 'bg', head: { heading: 'For a sound night under the pines' }, tints, ink: '#2f5a3a', more: true }),
      stats(c, { n: 4, tone: 'dark' }),
    ] },
    { slug: 'shop', title: 'Shop', build: (c) => [
      pageTitle(c, { title: 'Gear', tone: 'dark', align: 'left' }),
      shelf(c, { n: 8, cols: 4, tone: 'bg', tints, ink: '#2f5a3a' }),
      faq(c, { n: 4, tone: 'surface', head: { heading: 'Trail questions' } }),
    ] },
    { slug: 'journal', title: 'Journal', build: (c) => [pageTitle(c, { title: 'Trail notes', tone: 'surface' }), posts(c, { n: 3, photos: trails, tone: 'bg', head: false })] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Find the outpost' })] },
  ],
};
export default spec;

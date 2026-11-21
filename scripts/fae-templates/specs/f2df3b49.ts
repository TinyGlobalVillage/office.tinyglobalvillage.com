// Ref — a quiet jewellery shop: cream, centred serif wordmark with the links beneath, framed product photography.
// Kept: inset-feeling photo hero with a small caption low-left · centred one-line promise + outlined button ·
// two pictures side by side · heading + button left beside two product tiles · dark photo band to close.
import {
  CW, GLYPHS, PAD, bottom, button, centered, contact, ctaBand, group, hero, image, imageStory, pageTitle, posts, section, shape, stackDown, stats, text, tone,
  type Ctx, type Node, type Section, type TemplateSpec, type Tone,
} from '../kit.ts';

const serif = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const helv = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const HERO = '@jewelry|light';
const PAIR = ['@jewelry|candle#2', '@fabric|warm'];
const BAND = '@candle|light';

/** Two tall pictures shoulder to shoulder, left of centre (the reference's lookbook pair). */
function photoPair(c: Ctx, o: { photos: string[]; tone: Tone }): Section {
  const t = tone(c, o.tone);
  const cellW = 380;
  const h = 500;
  const pics: Node[] = o.photos.map((p) => image(c, { key: p, x: 0, y: 0, w: cellW, h }));
  const g = group(c, { name: 'Pair', x: PAD, y: 40, w: cellW * 2, h, children: pics, layout: { cols: 2, bp: { tablet: 2, mobile: 1 }, gap: 0 } });
  return section([g], h + 120, t.bg);
}

/** A drawn product tile: a plinth with a glyph for the piece, its name and price beneath. */
function productTiles(c: Ctx, o: { n: number; cols: number; x: number; w: number; y: number; tone: Tone }): Node {
  const t = tone(c, o.tone);
  const gap = 12;
  const cellW = (o.w - gap * (o.cols - 1)) / o.cols;
  const tileH = Math.round(cellW * 1.3);
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < o.n; i++) {
    const plinth = group(c, {
      name: 'Plinth', x: 0, y: 0, w: cellW, pct: 100, h: tileH,
      children: [
        shape(c, { x: 0, y: 0, w: cellW, pct: 100, h: tileH, fill: o.tone === 'surface' ? '#e4ddcf' : c.pal.surface, name: 'Plinth fill' }),
        text(c, { text: GLYPHS[(i * 3 + 1) % GLYPHS.length], x: 0, y: tileH / 2 - 34, w: cellW, pct: 100, size: 52, color: '#b08d4f', align: 'center', lh: 1.2, name: 'Piece' }),
      ],
    });
    const nm = text(c, { slot: 'offering.title', index: i, x: 0, y: tileH + 12, w: cellW, pct: 100, size: 14, color: t.ink, align: 'center', name: 'Name' });
    const pr = text(c, { slot: 'offering.price', index: i, x: 0, y: bottom(nm) + 2, w: cellW, pct: 100, size: 13, color: t.body, align: 'center', name: 'Price' });
    maxH = Math.max(maxH, bottom(pr));
    items.push(group(c, { name: `Piece ${i + 1}`, x: 0, y: 0, w: cellW, h: bottom(pr), children: [plinth, nm, pr], flow: { gap: 6, pad: 0 } }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const rows = Math.ceil(o.n / o.cols);
  return group(c, { name: 'Pieces', x: o.x, y: o.y, w: o.w, h: rows * maxH + (rows - 1) * 36, children: items, layout: { cols: o.cols, bp: { tablet: Math.min(o.cols, 2), mobile: 2 }, gap } });
}

/** Heading + button on the left, two product tiles on the right ("Essential …"). */
function featured(c: Ctx, o: { tone: Tone; heading: string }): Section {
  const t = tone(c, o.tone);
  const st = stackDown([
    text(c, { text: o.heading, x: PAD, y: 0, w: 400, size: 34, color: t.head, font: 'head', name: 'Heading' }),
    button(c, { slot: 'cta', href: '/shop', x: PAD, y: 0, look: 'outline' }),
  ], 110, 26);
  const tiles = productTiles(c, { n: 2, cols: 2, x: 645, w: 495, y: 110, tone: o.tone });
  return section([...st.nodes, tiles], Math.max(st.y, bottom(tiles)) + 120, t.bg);
}

/** A full grid of tiles for the shop page. */
function shopGrid(c: Ctx, o: { n: number; tone: Tone }): Section {
  const t = tone(c, o.tone);
  const g = productTiles(c, { n: o.n, cols: 3, x: PAD, w: CW, y: 80, tone: o.tone });
  return section([g], bottom(g) + 100, t.bg);
}

const spec: TemplateSpec = {
  key: 'f2df3b49',
  ref: 'f2df3b49',
  name: 'Gilded Bramble',
  industry: 'business',
  category: 'Business',
  description: 'A fae trading house for small treasures: cream and gold, a framed hero, a lookbook pair, quiet product tiles.',
  palette: {
    bg: '#faf6ef',
    surface: '#f1ece1',
    ink: '#1a1712',
    body: '#4a443b',
    muted: '#857b6c',
    accent: '#1a1712',
    accentInk: '#faf6ef',
    dark: '#4a4238',
    darkInk: '#faf6ef',
    darkBody: 'rgba(250,246,239,0.82)',
    darkAccent: '#e3cfa4',
    line: 'rgba(26,23,18,0.14)',
  },
  fonts: { head: serif, body: helv, headWeight: 400, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'centred serif wordmark, links centred beneath, socials left, basket right', footer: 'cream, centred wordmark + one row of links' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'photo-left', photo: HERO, h: 560, eyebrow: true, buttons: 1, headSize: 40, overlay: 'rgba(30,24,16,0.34)' }),
        centered(c, { tone: 'surface', heading: 'Small things, made to last an age', size: 30, slot: 'about', button: true }),
        photoPair(c, { photos: PAIR, tone: 'surface' }),
        featured(c, { tone: 'surface', heading: 'Keepsakes of the season' }),
        ctaBand(c, { tone: 'dark', photo: BAND }),
      ],
    },
    {
      slug: 'shop',
      title: 'Shop',
      build: (c) => [pageTitle(c, { title: 'The treasure shelf', tone: 'surface' }), shopGrid(c, { n: 6, tone: 'bg' }), centered(c, { tone: 'dark', slot: 'newsletter', heading: 'Word by moth-post' })],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [pageTitle(c, { title: 'Our story', tone: 'surface' }), imageStory(c, { photo: HERO, side: 'left', tone: 'bg', eyebrow: true }), stats(c, { n: 3, tone: 'surface' })],
    },
    {
      slug: 'journal',
      title: 'Journal',
      build: (c) => [pageTitle(c, { title: 'Journal', tone: 'bg' }), posts(c, { n: 3, photos: [PAIR[0], PAIR[1], BAND], tone: 'bg', head: false })],
    },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Find our stall' })] },
  ],
};
export default spec;

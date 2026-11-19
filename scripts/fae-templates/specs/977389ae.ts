// Ref — a cookery journal in warm cream with tall serif capitals and pill outline buttons: a photo hero with the
// title left, an orange running strip of words, "new in" four across, a split feature (big picture left, small
// copy and a second picture right), a large centred statement, and a "follow us" row of four squares.
// Kept: photo-left hero · orange word strip · four-across new-in cards · split feature with outline pill button ·
// big statement · follow row · recipes + about inner pages.
import { CW, GLYPHS, PAD, avatarsFor, bottom, button, cards, contact, group, hero, image, pageTitle, reviews, section, shape, text, tone, type Ctx, type Node, type Section, type TemplateSpec } from '../kit.ts';

const serif = "'Playfair Display', 'Didot', Georgia, serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const ORANGE = '#ff9a6b';
const TINTS = ['#e9c9a8', '#d7a77f', '#c98b62', '#efd9bf'];

/** An orange strip of repeated words. */
function strip(c: Ctx, words: string[]): Section {
  const line = Array.from({ length: 3 }, () => words.join('  ✦  ')).join('  ✦  ');
  const s = shape(c, { x: 0, y: 0, w: 1200, h: 58, fill: ORANGE, name: 'Strip' });
  const tx = text(c, { text: line, x: 0, y: 16, w: 1200, size: 17, color: '#1f1a17', font: 'head', upper: true, track: 1.5, lh: 1.4, align: 'center', name: 'Words' });
  return section([s, tx], 58, ORANGE);
}

/** A drawn square tile with a glyph. */
function tile(c: Ctx, i: number, w: number, h: number): Node {
  return group(c, { name: 'Tile', x: 0, y: 0, w, h, pct: 100, children: [
    shape(c, { x: 0, y: 0, w, h, pct: 100, fill: TINTS[i % TINTS.length], name: 'Tile fill' }),
    text(c, { text: GLYPHS[(i * 4 + 3) % GLYPHS.length], x: 0, y: h / 2 - 34, w, pct: 100, size: 50, color: 'rgba(255,255,255,0.85)', align: 'center', lh: 1.2, name: 'Glyph' }),
  ] });
}

/** Heading left + pill button right, then four square cards (tile · title · short line). */
function fourRow(c: Ctx, o: { heading: string; label: string; titles: boolean; tone: 'bg' | 'surface' }): Section {
  const t = tone(c, o.tone);
  const h = text(c, { text: o.heading, x: PAD, y: 90, w: 600, size: 44, color: t.head, font: 'head', upper: true, role: 'h2', name: 'Heading' });
  const b = button(c, { text: o.label, href: '/recipes', x: 1200 - PAD - 180, y: 96, w: 180, look: 'outline', size: 14 });
  const gap = 20;
  const cellW = (CW - gap * 3) / 4;
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < 4; i++) {
    const kids: Node[] = [tile(c, i + (o.titles ? 0 : 2), cellW, cellW)];
    if (o.titles) {
      const ti = text(c, { slot: 'post.title', index: i, x: 0, y: cellW + 14, w: cellW, pct: 100, size: 18, color: t.head, font: 'head', role: 'h3', name: 'Title' });
      kids.push(ti, text(c, { slot: 'event.date', index: i, x: 0, y: bottom(ti) + 6, w: cellW, pct: 100, size: 12, color: t.muted, name: 'Date' }));
    }
    const ch = bottom(kids[kids.length - 1]) + 6;
    maxH = Math.max(maxH, ch);
    items.push(group(c, { name: `Card ${i + 1}`, x: 0, y: 0, w: cellW, h: ch, children: kids, flow: { gap: 8, pad: 0 } }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const gy = bottom(h) + 40;
  const grid = group(c, { name: 'Row', x: PAD, y: gy, w: CW, h: maxH, children: items, layout: { cols: 4, bp: { tablet: 2, mobile: 2 }, gap } });
  return section([h, b, grid], bottom(grid) + 100, t.bg);
}

/** Big picture left; eyebrow, heading, paragraph, pill button and a small picture on the right. */
function feature(c: Ctx, big: string, small: string): Section {
  const t = tone(c, 'surface');
  const pic = image(c, { key: big, x: PAD, y: 90, w: 560, h: 680 });
  const rx = 690;
  const rw = 450;
  const e = text(c, { slot: 'eyebrow', x: rx, y: 120, w: rw, size: 13, color: t.muted, upper: true, track: 2, name: 'Eyebrow' });
  const h = text(c, { text: 'Bread from the hollow oven', x: rx, y: bottom(e) + 14, w: rw, size: 46, color: t.head, font: 'head', upper: true, role: 'h2', lh: 1.05, name: 'Heading' });
  const p = text(c, { slot: 'paragraph', x: rx, y: bottom(h) + 18, w: 400, size: 15, color: t.body, name: 'Paragraph' });
  const b = button(c, { text: 'Read the recipe', href: '/recipes', x: rx, y: bottom(p) + 26, w: 200, look: 'outline', size: 14 });
  const sm = image(c, { key: small, x: rx + 150, y: bottom(b) + 40, w: 300, h: 300 });
  return section([pic, e, h, p, b, sm], Math.max(bottom(pic), bottom(sm)) + 90, t.bg);
}

/** One large centred statement under a small label. */
function statement(c: Ctx): Section {
  const t = tone(c, 'bg');
  const l = text(c, { text: 'Our kitchen', x: PAD, y: 110, w: CW, size: 13, color: t.muted, upper: true, track: 2, align: 'center', name: 'Label' });
  const s = text(c, { slot: 'about', x: 150, y: bottom(l) + 22, w: 900, size: 34, color: t.head, font: 'head', align: 'center', lh: 1.3, name: 'Statement' });
  const b = button(c, { text: 'Meet the cooks', href: '/about', x: 500, y: bottom(s) + 36, w: 200, look: 'outline', size: 14 });
  return section([l, s, b], bottom(b) + 110, t.bg);
}

const spec: TemplateSpec = {
  key: '977389ae',
  ref: '977389ae',
  name: 'Emberstep Hearthbook',
  industry: 'blog',
  category: 'Blog',
  description: 'A brownie cook’s hearthbook in warm cream and ember orange: bread from the hollow oven, new dishes and tall serif capitals.',
  palette: { bg: '#fbf4ea', surface: '#f3e6d6', ink: '#1f1a17', body: '#4f4338', muted: '#8a7a6a', accent: '#1f1a17', accentInk: '#fbf4ea', dark: '#2b211b', darkInk: '#fbf4ea', darkBody: 'rgba(251,244,234,0.8)', darkAccent: ORANGE, line: 'rgba(31,26,23,0.16)' },
  fonts: { head: serif, body: sans, headWeight: 400, headTrack: 0.5, btnRadius: 999, cardRadius: 0 },
  chrome: { nav: 'wordmark left, links centred, pill outline button right, cream bar', footer: 'orange strip, then cream columns with a sign-up line' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'photo-left', photo: '@bakery|bread', h: 660, buttons: 1, overlay: 'rgba(40,25,15,0.4)', headSize: 66 }),
        strip(c, ['Bake', 'Stir', 'Gather', 'Share']),
        fourRow(c, { heading: 'New from the hearth', label: 'All recipes', titles: true, tone: 'bg' }),
        feature(c, '@bread|bakery#2', '@warm|candle'),
        statement(c),
        fourRow(c, { heading: 'Follow the smoke', label: 'Follow along', titles: false, tone: 'surface' }),
      ],
    },
    {
      slug: 'recipes',
      title: 'Recipes',
      build: (c) => [
        pageTitle(c, { title: 'Recipes', tone: 'surface' }),
        cards(c, { n: 6, cols: 3, kind: 'plain', tone: 'bg', head: false, titleSlot: 'post.title', bodySlot: 'post.excerpt', link: '/recipes' }),
        strip(c, ['Knead', 'Rise', 'Bake', 'Break']),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'The cooks', tone: 'bg' }),
        statement(c),
        reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 6), head: { heading: 'Kind words at the table' } }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Pull up a stool' })],
    },
  ],
};
export default spec;

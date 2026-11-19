// Ref — a blush-pink food journal: no hero, straight into a three-column wall of posts, every caption centred.
// Kept: centred post wall (picture · date · title · excerpt · red "read more") · a quiet sign-up interlude ·
// about with a story picture · contact.
import { CW, GLYPHS, PAD, avatarsFor, bottom, centered, contact, group, headBlock, image, imageStory, pageTitle, section, shape, splitHeading, team, text, tone, type Ctx, type Node, type Section, type TemplateSpec, type Tone } from '../kit.ts';

const sans = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

/** A wall of post cards; a card's picture is a pool photo or, where `photos[i]` is null, a drawn tile. */
function postWall(c: Ctx, o: { n: number; cols: number; tone?: Tone; photos: Array<string | null>; tints: string[]; tileH: number[]; heading?: string }): Section {
  const t = tone(c, o.tone ?? 'bg');
  const gap = 40;
  const cellW = (CW - gap * (o.cols - 1)) / o.cols;
  const layers: Node[] = [];
  let y = 80;
  if (o.heading) {
    const hb = headBlock(c, t, { heading: o.heading, y, size: 34 });
    layers.push(...hb.nodes);
    y = hb.y + 48;
  }
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < o.n; i++) {
    const th = o.tileH[i % o.tileH.length];
    const ph = o.photos[i % o.photos.length];
    const pic = ph
      ? image(c, { key: ph, x: 0, y: 0, w: cellW, h: th, pct: 100 })
      : group(c, { name: 'Tile', x: 0, y: 0, w: cellW, h: th, pct: 100, children: [
          shape(c, { x: 0, y: 0, w: cellW, h: th, pct: 100, fill: o.tints[i % o.tints.length], name: 'Tile fill' }),
          text(c, { text: GLYPHS[(i * 7) % GLYPHS.length], x: 0, y: th / 2 - 40, w: cellW, pct: 100, size: 60, color: 'rgba(255,255,255,0.85)', align: 'center', lh: 1.2, name: 'Glyph' }),
        ] });
    const d = text(c, { slot: 'event.date', index: i, x: 0, y: th + 18, w: cellW, pct: 100, size: 13, color: t.body, align: 'center', name: 'Date' });
    const ti = text(c, { slot: 'post.title', index: i, x: 0, y: bottom(d) + 6, w: cellW, pct: 100, size: 22, color: t.head, font: 'head', align: 'center', role: 'h3', name: 'Title' });
    const ex = text(c, { slot: 'post.excerpt', index: i, x: 16, y: bottom(ti) + 8, w: cellW - 32, pct: 90, size: 14, color: t.body, align: 'center', name: 'Excerpt' });
    const ln = { ...text(c, { text: 'Read more', x: 0, y: bottom(ex) + 12, w: cellW, pct: 100, size: 13, color: c.pal.accent, weight: 600, align: 'center', name: 'Link' }), href: '/blog' };
    const ch = bottom(ln) + 6;
    maxH = Math.max(maxH, ch);
    items.push(group(c, { name: `Post ${i + 1}`, x: 0, y: 0, w: cellW, h: ch, children: [pic, d, ti, ex, ln], flow: { gap: 8, pad: 6 } }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const rows = Math.ceil(o.n / o.cols);
  const gh = rows * maxH + (rows - 1) * 56;
  layers.push(group(c, { name: 'Posts', x: PAD, y, w: CW, h: gh, children: items, layout: { cols: o.cols, bp: { tablet: 2, mobile: 1 }, gap } }));
  return section(layers, y + gh + 100, t.bg);
}

const tints = ['#c98a7e', '#8f6a5a', '#b3a184', '#7a8467'];

const spec: TemplateSpec = {
  key: '323674b9',
  ref: '323674b9',
  name: 'Blushcap Table',
  industry: 'blog',
  category: 'Blog',
  description: 'A rosy hedgerow-supper journal kept by gnomes: no hero at all, just a centred wall of recipes and tales.',
  palette: { bg: '#f8d9d3', surface: '#fbe8e4', ink: '#1c1717', body: '#4f4442', muted: '#86716d', accent: '#d2483f', accentInk: '#ffffff', dark: '#2a1f1d', darkInk: '#fbe8e4', darkBody: 'rgba(251,232,228,0.8)', darkAccent: '#f4a79d', line: 'rgba(28,23,23,0.12)' },
  fonts: { head: sans, body: sans, headWeight: 500, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'brand-left, links centred, social icons right, no bar', footer: 'blush, single centred line + socials' },
  pages: [
    {
      slug: 'home',
      title: 'Journal',
      build: (c) => [
        postWall(c, { n: 9, cols: 3, tone: 'bg', photos: ['@bread|bakery', null, '@mushroom', null, '@warm|candle', null, null, '@bread|bakery#2', null], tints, tileH: [260, 380, 220] }),
        centered(c, { tone: 'surface', heading: 'Supper notes, by owl', slot: 'newsletter', button: true }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'At our table', tone: 'bg' }),
        imageStory(c, { photo: '@warm|candle', side: 'left', tone: 'surface', button: false }),
        splitHeading(c, { tone: 'bg', heading: 'Why we write it down', button: false, paras: 2 }),
        team(c, { n: 3, avatars: avatarsFor(c.site, 4), tone: 'surface', head: { heading: 'Around the hearth' } }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Send a recipe our way' })],
    },
  ],
};
export default spec;

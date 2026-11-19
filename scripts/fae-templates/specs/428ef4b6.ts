// Ref — a black fashion journal with a centred wordmark: a row of four small featured posts, a full-bleed
// photo feature with one big serif title, then a three-column wall of posts with large serif titles.
// Kept: "featured" four-across strip (title, excerpt, date under) · full-bleed feature with outline button ·
// three-column post wall (date · big title · excerpt · underlined link) · plain about + contact.
import { CW, GLYPHS, PAD, avatarsFor, bottom, contact, group, hero, image, imageStory, pageTitle, section, shape, splitHeading, team, text, tone, type Ctx, type Node, type Section, type TemplateSpec, type Tone } from '../kit.ts';

const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** Post cards in a grid; `photos[i]` null draws a tile instead. `big` = the large serif title of the lower wall. */
function postGrid(c: Ctx, o: { n: number; cols: number; tone?: Tone; photos: Array<string | null>; tileH: number[]; tints: string[]; big?: boolean; heading?: string }): Section {
  const t = tone(c, o.tone ?? 'bg');
  const gap = o.big ? 28 : 18;
  const cellW = (CW - gap * (o.cols - 1)) / o.cols;
  const layers: Node[] = [];
  let y = o.big ? 60 : 70;
  if (o.heading) {
    const h = text(c, { text: o.heading, x: PAD, y, w: 600, size: 24, color: t.head, font: 'head', weight: 400, role: 'h2', name: 'Heading' });
    layers.push(h);
    y = bottom(h) + 26;
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
          text(c, { text: GLYPHS[(i * 5 + 2) % GLYPHS.length], x: 0, y: th / 2 - 34, w: cellW, pct: 100, size: 52, color: 'rgba(255,255,255,0.7)', align: 'center', lh: 1.2, name: 'Glyph' }),
        ] });
    const kids: Node[] = [pic];
    if (o.big) {
      const d = text(c, { slot: 'event.date', index: i, x: 0, y: th + 16, w: cellW, pct: 100, size: 12, color: t.body, name: 'Date' });
      const ti = text(c, { slot: 'post.title', index: i, x: 0, y: bottom(d) + 8, w: cellW, pct: 100, size: 32, color: t.head, font: 'head', weight: 400, role: 'h3', name: 'Title' });
      const ex = text(c, { slot: 'post.excerpt', index: i, x: 0, y: bottom(ti) + 10, w: cellW * 0.86, pct: 86, size: 14, color: t.body, name: 'Excerpt' });
      const ln = { ...text(c, { text: 'Read more', x: 0, y: bottom(ex) + 12, w: 120, size: 13, color: t.ink, name: 'Link' }), href: '/journal' };
      kids.push(d, ti, ex, ln);
    } else {
      const ti = text(c, { slot: 'post.title', index: i, x: 0, y: th + 14, w: cellW, pct: 100, size: 15, color: t.head, name: 'Title', role: 'h3' });
      const ex = text(c, { slot: 'post.excerpt', index: i, x: 0, y: bottom(ti) + 6, w: cellW, pct: 100, size: 12, color: t.body, name: 'Excerpt' });
      const d = text(c, { slot: 'event.date', index: i, x: 0, y: bottom(ex) + 8, w: cellW, pct: 100, size: 11, color: t.muted, name: 'Date' });
      kids.push(ti, ex, d);
    }
    const ch = bottom(kids[kids.length - 1]) + 6;
    maxH = Math.max(maxH, ch);
    items.push(group(c, { name: `Post ${i + 1}`, x: 0, y: 0, w: cellW, h: ch, children: kids, flow: { gap: 8, pad: 6 } }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const rows = Math.ceil(o.n / o.cols);
  const gh = rows * maxH + (rows - 1) * 40;
  layers.push(group(c, { name: 'Posts', x: PAD, y, w: CW, h: gh, children: items, layout: { cols: o.cols, bp: { tablet: 2, mobile: 1 }, gap } }));
  return section(layers, y + gh + (o.big ? 100 : 70), t.bg);
}

const tints = ['#3a2f2a', '#5a3b22', '#2d3338', '#4a4038'];

const spec: TemplateSpec = {
  key: '428ef4b6',
  ref: '428ef4b6',
  name: 'Silverthorn Almanac',
  industry: 'blog',
  category: 'Blog',
  description: 'A faerie style almanac printed on night-black: four featured tales, one silver feature, then a wall of stories in tall serif.',
  palette: { bg: '#000000', surface: '#111111', ink: '#ffffff', body: 'rgba(255,255,255,0.74)', muted: 'rgba(255,255,255,0.5)', accent: '#e9e3d6', accentInk: '#000000', dark: '#000000', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.74)', darkAccent: '#e9e3d6', line: 'rgba(255,255,255,0.16)' },
  fonts: { head: serif, body: sans, headWeight: 400, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'links left, wordmark centred, social icons right, on black', footer: 'black, centred wordmark + socials' },
  pages: [
    {
      slug: 'home',
      title: 'Journal',
      build: (c) => [
        postGrid(c, { n: 4, cols: 4, tone: 'bg', heading: 'Featured tales', photos: ['@mist', null, '@forest', null], tileH: [150], tints }),
        hero(c, { variant: 'photo-left', photo: '@moss|mushroom', h: 600, buttons: 1, overlay: 'rgba(30,30,30,0.35)', headSize: 72 }),
        postGrid(c, { n: 6, cols: 3, tone: 'bg', big: true, photos: [null, '@mist', '@candle|light', '@forest', null, null], tileH: [200, 470, 430], tints }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'About the almanac', tone: 'bg', align: 'left' }),
        imageStory(c, { photo: '@candle|light', side: 'right', tone: 'surface', inset: false }),
        splitHeading(c, { tone: 'bg', heading: 'Ink, thread and starlight', button: false }),
        team(c, { n: 3, avatars: avatarsFor(c.site, 5), tone: 'surface', head: { heading: 'Who holds the quill' } }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Write to the almanac' })],
    },
  ],
};
export default spec;

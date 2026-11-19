// Ref — a quiet faith journal on pale grey: an arched mountain-at-dusk hero with a centred serif title, then
// "all my stories" under a hairline and a three-column grid of post cards with a meta line and a counts footer.
// Kept: centred photo hero · centred heading + full-width rule · post cards (picture · date · read-time ·
// serif title · excerpt · rule · counts) · podcast episode list · about.
import { CW, GLYPHS, PAD, bottom, cards, copy, contact, group, headBlock, hero, image, imageStory, pageTitle, section, shape, splitHeading, text, tone, type Ctx, type Node, type Section, type TemplateSpec, type Tone } from '../kit.ts';

const serif = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** Heading over a hairline, then post cards with a meta line and a counts footer. */
function stories(c: Ctx, o: { n: number; tone?: Tone; heading: string; photos: Array<string | null>; tints: string[] }): Section {
  const t = tone(c, o.tone ?? 'bg');
  const layers: Node[] = [];
  const hb = headBlock(c, t, { heading: o.heading, y: 100, size: 40 });
  layers.push(...hb.nodes);
  const rule = shape(c, { x: PAD - 10, y: hb.y + 36, w: CW + 20, h: 1, fill: t.ink, name: 'Rule' });
  layers.push(rule);
  const gx = 112;
  const gw = 1200 - gx * 2;
  const gap = 62;
  const cellW = (gw - gap * 2) / 3;
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < o.n; i++) {
    const th = [300, 330, 255][i % 3];
    const ph = o.photos[i % o.photos.length];
    const pic = ph
      ? image(c, { key: ph, x: 0, y: 0, w: cellW, h: th, pct: 100 })
      : group(c, { name: 'Tile', x: 0, y: 0, w: cellW, h: th, pct: 100, children: [
          shape(c, { x: 0, y: 0, w: cellW, h: th, pct: 100, fill: o.tints[i % o.tints.length], name: 'Tile fill' }),
          text(c, { text: GLYPHS[(i * 3 + 5) % GLYPHS.length], x: 0, y: th / 2 - 36, w: cellW, pct: 100, size: 54, color: 'rgba(255,255,255,0.8)', align: 'center', lh: 1.2, name: 'Glyph' }),
        ] });
    const meta = text(c, { text: `${copy(c, 'event.date', i).text} · ${(i % 3) + 2} candle read`, x: 0, y: th + 22, w: cellW, pct: 100, size: 11, color: t.body, name: 'Meta' });
    const ti = text(c, { slot: 'post.title', index: i, x: 0, y: bottom(meta) + 10, w: cellW, pct: 100, size: 19, color: t.head, font: 'head', weight: 400, role: 'h3', name: 'Title' });
    const ex = text(c, { slot: 'post.excerpt', index: i, x: 0, y: bottom(ti) + 8, w: cellW, pct: 100, size: 12, color: t.body, name: 'Excerpt' });
    const hr = shape(c, { x: 0, y: bottom(ex) + 10, w: cellW, h: 1, pct: 100, fill: t.line, name: 'Rule' });
    const ct = text(c, { text: `${(i * 7) % 11} owls read · ${(i * 3) % 5} notes`, x: 0, y: bottom(hr) + 10, w: cellW, pct: 100, size: 10, color: t.body, name: 'Counts' });
    const ch = bottom(ct) + 6;
    maxH = Math.max(maxH, ch);
    items.push(group(c, { name: `Story ${i + 1}`, x: 0, y: 0, w: cellW, h: ch, children: [pic, meta, ti, ex, hr, ct], flow: { gap: 8, pad: 6 } }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const rows = Math.ceil(o.n / 3);
  const gy = bottom(rule) + 74;
  const gh = rows * maxH + (rows - 1) * 48;
  layers.push(group(c, { name: 'Stories', x: gx, y: gy, w: gw, h: gh, children: items, layout: { cols: 3, bp: { tablet: 2, mobile: 1 }, gap } }));
  const end = shape(c, { x: PAD - 10, y: gy + gh + 80, w: CW + 20, h: 1, fill: t.ink, name: 'Rule' });
  layers.push(end);
  return section(layers, bottom(end) + 60, t.bg);
}

const tints = ['#b99aa6', '#8d9aa8', '#c9a98f'];

const spec: TemplateSpec = {
  key: '5fe53207',
  ref: '5fe53207',
  name: 'Cloudpeak Vespers',
  industry: 'blog',
  category: 'Blog',
  description: 'A quiet fae journal of faith and wandering: a dusk-peak hero, then every story in calm grey cards.',
  palette: { bg: '#dedede', surface: '#e9e9e9', ink: '#141414', body: '#3d3d3d', muted: '#6e6e6e', accent: '#141414', accentInk: '#ffffff', dark: '#2a2530', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#f2a7a7', line: 'rgba(20,20,20,0.22)' },
  fonts: { head: serif, body: sans, headWeight: 400, btnRadius: 999, cardRadius: 0 },
  chrome: { nav: 'small wordmark left, links right, search pill with a black button', footer: 'grey, a hairline then socials + fine print' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'photo-center', photo: '@mist', h: 600, buttons: 1, overlay: 'rgba(70,40,60,0.35)', headSize: 72 }),
        stories(c, { n: 6, tone: 'bg', heading: 'Every tale so far', photos: ['@books', null, '@moss|mushroom', null, '@light|candle', null], tints }),
      ],
    },
    {
      slug: 'blog',
      title: 'Blog',
      build: (c) => [
        pageTitle(c, { title: 'The journal', tone: 'bg' }),
        stories(c, { n: 9, tone: 'bg', heading: 'Newest first', photos: [null, '@books', null, '@light|candle', null, null, '@moss|mushroom', null, null], tints }),
      ],
    },
    {
      slug: 'podcast',
      title: 'Podcast',
      build: (c) => [
        pageTitle(c, { title: 'Fireside talks', tone: 'surface' }),
        cards(c, { n: 6, cols: 2, kind: 'numbered', tone: 'bg', head: false, titleSlot: 'event.title', bodySlot: 'post.excerpt', link: '/podcast' }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'Why I write', tone: 'bg' }),
        imageStory(c, { photo: '@mist', side: 'left', tone: 'dark' }),
        splitHeading(c, { tone: 'surface', heading: 'Walk alongside', paras: 2, button: true }),
        contact(c, { tone: 'bg', heading: 'Leave a note at the door' }),
      ],
    },
  ],
};
export default spec;

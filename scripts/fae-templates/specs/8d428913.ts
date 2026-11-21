// Ref — a personal journal-and-retreats site: teal-washed photo hero, wordmark centred, condensed serif, earthy brown.
// Kept: photo hero with a short serif line low-left and a stack of big uppercase "+" links on hairlines right ·
// a white centred statement with an italic accent line and a text link · one centred picture with little review
// chips floating at its sides · three picture cards under a heading + a brown button.
import {
  PAD, W, avatarsFor, bottom, cards, centered, contact, faq, group, hero, image, pageTitle, posts, reviews, section, shape, splitHeading, stackLast, team, text, tone,
  type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';

const serif = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const helv = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const HERO = '@mist|forest';
const MID = '@books|library';
const LESSONS = ['@study|desk', '@mushroom|moss', MID];

/** The kit's photo hero with a column of big uppercase links on hairlines down its right side. */
function heroWithLinks(c: Ctx): Section {
  const s = hero(c, { variant: 'photo-left', photo: HERO, h: 700, headSize: 42, buttons: 1, overlay: 'rgba(16,52,62,0.5)' });
  const H = (s.layersFrame as { desktop: { h: number } }).desktop.h;
  const lw = 380;
  const rowH = 74;
  const words = ['Fireside talks', 'Moon retreats', 'Kindred work'];
  const rows: Node[] = words.map((w, i) =>
    group(c, {
      name: `Link ${i + 1}`, x: 0, y: 0, w: lw, pct: 100, h: rowH,
      children: [
        shape(c, { x: 0, y: 0, w: lw, pct: 100, h: 1, fill: 'rgba(255,255,255,0.5)', name: 'Rule' }),
        text(c, { text: w, x: 0, y: 16, w: lw - 40, size: 34, color: '#ffffff', font: 'head', upper: true, lh: 1.1, name: 'Link' }),
        text(c, { text: '+', x: lw - 30, y: 16, w: 30, size: 30, color: '#ffffff', align: 'right', name: 'Plus' }),
      ],
    }),
  );
  const list = group(c, { name: 'Big links', x: W - PAD - lw, y: H - rows.length * rowH - 90, w: lw, h: rows.length * rowH, children: rows, flow: { gap: 0, pad: 0 } });
  s.layers.push(...stackLast([list]));
  return s;
}

/** A centred picture with two small review chips floating over its left and right edges. */
function pictureWithChips(c: Ctx): Section {
  const t = tone(c, 'bg');
  const pw = 560;
  const ph = 620;
  const px = (W - pw) / 2;
  const pic = image(c, { key: MID, x: px, y: 80, w: pw, h: ph });
  const chip = (i: number, x: number, y: number): Node => {
    const cw = 280;
    const face = image(c, { key: avatarsFor(c.site, 2)[i], x: 16, y: 16, w: 44, h: 44, circle: true });
    const stars = text(c, { text: '★★★★★', x: 74, y: 14, w: 180, size: 14, color: c.pal.accent, name: 'Stars' });
    const who = text(c, { slot: 'review.author', index: i, x: 74, y: bottom(stars) + 2, w: 190, size: 14, color: t.ink, weight: 600, name: 'Author' });
    return group(c, { name: `Chip ${i + 1}`, x, y, w: cw, h: Math.max(76, bottom(who) + 14), children: [face, stars, who], fill: '#ffffff', radius: 14, shadow: '0px 10px 30px rgba(20,40,48,0.18)' });
  };
  const chips = [chip(0, px - 160, 200), chip(1, px + pw - 120, 480)];
  return section([pic, ...stackLast(chips)], 80 + ph + 100, t.bg);
}

const spec: TemplateSpec = {
  key: '8d428913',
  ref: '8d428913',
  name: 'Fernlight Hollow',
  industry: 'blog',
  category: 'Blog',
  description: 'A wandering faerie’s journal in teal mist and bark brown: a hero of big plus-links, a picture ringed with kind words.',
  palette: {
    bg: '#ffffff',
    surface: '#eef3f2',
    ink: '#1d2f35',
    body: '#46565a',
    muted: '#7c8b8e',
    accent: '#5a4030',
    accentInk: '#ffffff',
    dark: '#244f5c',
    darkInk: '#ffffff',
    darkBody: 'rgba(255,255,255,0.82)',
    darkAccent: '#cfe4e2',
    line: 'rgba(29,47,53,0.16)',
  },
  fonts: { head: serif, body: helv, headWeight: 400, headTrack: -0.4, btnRadius: 999, btnUpper: true, cardRadius: 4 },
  chrome: { nav: 'links left, wordmark centred, contact pill right, over the hero', footer: 'white, wordmark + links + socials, small print' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        heroWithLinks(c),
        centered(c, { tone: 'bg', eyebrow: true, headSlot: 'mission', slot: 'about', size: 30 }),
        pictureWithChips(c),
        cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'surface', photos: LESSONS, head: { heading: 'A peek at the path', align: 'center' }, titleSlot: 'post.title', bodySlot: 'post.excerpt', imgH: 260, button: true }),
      ],
    },
    {
      slug: 'journal',
      title: 'Journal',
      build: (c) => [pageTitle(c, { title: 'The journal', tone: 'dark' }), posts(c, { n: 3, photos: LESSONS, tone: 'bg', head: false }), centered(c, { tone: 'surface', slot: 'newsletter', heading: 'Letters by firefly', button: true })],
    },
    {
      slug: 'retreats',
      title: 'Retreats',
      build: (c) => [
        pageTitle(c, { title: 'Gatherings', tone: 'surface' }),
        cards(c, { n: 3, cols: 3, kind: 'numbered', tone: 'bg', head: false, titleSlot: 'event.title', bodySlot: 'event.date' }),
        reviews(c, { n: 2, cols: 2, tone: 'surface', avatars: avatarsFor(c.site, 0) }),
        faq(c, { n: 4, tone: 'bg' }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [pageTitle(c, { title: 'About', tone: 'bg' }), splitHeading(c, { tone: 'surface', paras: 2 }), team(c, { n: 1, avatars: avatarsFor(c.site, 4), tone: 'bg', bio: true, head: false })],
    },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'surface', heading: 'Write to the hollow' })] },
  ],
};
export default spec;

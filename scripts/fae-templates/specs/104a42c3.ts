// Ref — a bold network-and-events house: a deep violet-lit photo hero, big serif heads, violet and coral throughout.
// Kept: dark photo hero with the words on the RIGHT + outlined pill · white centred violet serif heading, intro
// and a two-column uppercase list · lavender-to-peach gradient band with three tall coloured cards, each with a
// pill · violet band of rounded pictures beside text in a zigzag, coral pills.
import {
  CW, PAD, W, avatarsFor, bottom, button, centered, contact, faq, group, hero, pageTitle, pricing, reviews, section, stackDown, stats, steps, team, text, tone, zigzag,
  type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';

const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

const HERO = '@water|sky';
const ROWS = ['@light|candle', '@forest|nature'];

/** The kit's photo hero with its words moved to the right half (the reference keeps the left for the picture). */
function heroRight(c: Ctx): Section {
  const s = hero(c, { variant: 'photo-left', photo: HERO, h: 700, eyebrow: true, buttons: 1, headSize: 48, overlay: 'rgba(30,8,60,0.5)' });
  const shift = W - PAD * 2 - 640 + 20; // 500..1140
  for (const n of s.layers) n.box.desktop.x += shift;
  return s;
}

/** Centred violet heading + intro, then a two-column list of uppercase lines. */
function headingAndList(c: Ctx): Section {
  const t = tone(c, 'bg');
  const st = stackDown([
    text(c, { text: 'Where the guilds of the glen meet', x: 160, y: 0, w: 880, size: 46, color: c.pal.dark, font: 'head', align: 'center', lh: 1.1, name: 'Heading' }),
    text(c, { slot: 'about', x: 240, y: 0, w: 720, size: 17, color: t.body, align: 'center', name: 'Intro' }),
  ], 100, 24);
  const colW = (CW - 60) / 2;
  const items: Node[] = [0, 1, 2, 3, 4, 5].map((i) =>
    text(c, { slot: 'offering.title', index: i, x: 0, y: 0, w: colW, pct: 100, size: 14, color: t.ink, weight: 600, upper: true, track: 1.6, name: 'List line' }),
  );
  const lineH = Math.max(...items.map((n) => n.box.desktop.h));
  for (const n of items) n.box.desktop.h = lineH;
  const g = group(c, { name: 'List', x: PAD, y: st.y + 50, w: CW, h: 3 * lineH + 2 * 18, children: items, layout: { cols: 2, bp: { tablet: 2, mobile: 1 }, gap: 18 } });
  return section([...st.nodes, g], bottom(g) + 100, t.bg);
}

/** Three tall cards in violet / white / coral on a soft lavender-to-peach gradient. */
function colouredCards(c: Ctx): Section {
  const gap = 28;
  const cellW = (CW - gap * 2) / 3;
  const pad = 32;
  const inner = cellW - pad * 2;
  const pct = (inner / cellW) * 100;
  const fills = [c.pal.dark, '#ffffff', c.pal.accent];
  const inks = ['#ffffff', c.pal.ink, '#2a1030'];
  const built = fills.map((fill, i) => {
    const ti = text(c, { slot: 'offering.title', index: i + 6, x: pad, y: pad, w: inner, pct, size: 28, color: inks[i], font: 'head', name: 'Title' });
    const su = text(c, { slot: 'tagline', index: i, x: pad, y: bottom(ti) + 8, w: inner, pct, size: 14, color: inks[i], weight: 600, upper: true, track: 1.2, name: 'Subtitle' });
    const bo = text(c, { slot: 'offering.body', index: i + 6, x: pad, y: bottom(su) + 16, w: inner, pct, size: 15, color: inks[i], name: 'Body' });
    const bt = button(c, { slot: 'cta', href: '/contact', x: pad, y: bottom(bo) + 26, look: i === 1 ? 'solid' : 'light' });
    return { kids: [ti, su, bo, bt], h: bottom(bt) + pad, fill };
  });
  const cardH = Math.max(420, ...built.map((b) => b.h));
  const cells = built.map((b, i) => group(c, { name: `Card ${i + 1}`, x: 0, y: 0, w: cellW, h: cardH, children: b.kids, fill: b.fill, radius: 18, flow: { gap: 14, pad } }));
  const g = group(c, { name: 'Cards', x: PAD, y: 100, w: CW, h: cardH, children: cells, layout: { cols: 3, bp: { tablet: 1, mobile: 1 }, gap } });
  return section([g], bottom(g) + 100, 'linear-gradient(180deg, #e3dcf7 0%, #fbe1d4 100%)');
}

const spec: TemplateSpec = {
  key: '104a42c3',
  ref: '104a42c3',
  name: 'Glimmerdeep Moot',
  industry: 'business',
  category: 'Business',
  description: 'A glowing faerie trade-moot in deep violet and coral: a right-handed photo hero, jewel-coloured cards on a dawn gradient.',
  palette: {
    bg: '#ffffff',
    surface: '#f4f0fd',
    ink: '#1c1230',
    body: '#4a4260',
    muted: '#7e7596',
    accent: '#f0906a',
    accentInk: '#2a1030',
    dark: '#4b20b8',
    darkInk: '#ffffff',
    darkBody: 'rgba(255,255,255,0.84)',
    darkAccent: '#ffd2bf',
    line: 'rgba(28,18,48,0.14)',
  },
  fonts: { head: serif, body: sans, headWeight: 500, headTrack: -0.8, btnRadius: 999, cardRadius: 18 },
  chrome: { nav: 'black bar: wordmark left, links centred, socials right', footer: 'black, wordmark + three link columns + socials' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        heroRight(c),
        headingAndList(c),
        colouredCards(c),
        zigzag(c, { rows: [{ photo: ROWS[0], pill: true }, { photo: ROWS[1], pill: true }], tone: 'dark', head: { heading: 'Tidings & gatherings', align: 'center' } }),
      ],
    },
    {
      slug: 'membership',
      title: 'Membership',
      build: (c) => [pageTitle(c, { title: 'Join the moot', tone: 'dark' }), pricing(c, { n: 3, tone: 'surface' }), faq(c, { n: 5, tone: 'bg', side: true })],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'About the moot', tone: 'surface' }),
        stats(c, { n: 4, tone: 'dark' }),
        team(c, { n: 4, avatars: avatarsFor(c.site, 1), tone: 'bg', head: { heading: 'The stewards' } }),
        reviews(c, { n: 3, cols: 3, tone: 'surface' }),
      ],
    },
    {
      slug: 'events',
      title: 'Events',
      build: (c) => [pageTitle(c, { title: 'Moots to come', tone: 'bg' }), steps(c, { n: 4, tone: 'surface', head: false }), centered(c, { tone: 'accent', slot: 'newsletter', heading: 'Hear the bells first', button: true })],
    },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Send word' })] },
  ],
};
export default spec;

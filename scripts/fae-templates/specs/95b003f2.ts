// Ref — a violet "opening soon" page: one huge blocky headline centred with a play mark, a checkered pixel strip, a black sign-up band.
// Kept: huge centred headline + play mark · two-row checker strip · black "be the first to know" sign-up with socials.
import {
  bottom, button, cards, centered, contact, faq, group, pageTitle, section, shape, stackDown, stats, steps, text, tone, W,
  type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';

const grot = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";

/** The opening-soon hero: a small line, one huge capital headline, a round play mark. */
function soonHero(c: Ctx): Section {
  const t = tone(c, 'bg');
  const d = 84;
  const nodes: Node[] = [
    text(c, { text: 'Opening at the next new moon', x: 300, y: 0, w: 600, size: 15, color: t.muted, weight: 600, upper: true, track: 3, align: 'center', name: 'Eyebrow' }),
    text(c, { slot: 'headline', x: 80, y: 0, w: 1040, size: 96, color: t.head, font: 'head', weight: 700, upper: true, align: 'center', lh: 0.98, role: 'h1', name: 'Headline' }),
    group(c, {
      name: 'Play', x: (W - d) / 2, y: 0, w: d, h: d,
      children: [
        shape(c, { x: 0, y: 0, w: d, h: d, fill: '#ffffff', radius: d / 2, name: 'Play disc' }),
        text(c, { text: '▶', x: 5, y: 22, w: d, size: 30, color: c.pal.bg, align: 'center', lh: 1.2, name: 'Play glyph' }),
      ],
    }),
  ];
  const st = stackDown(nodes, 150, [20, 44]);
  return section(st.nodes, st.y + 140, t.bg);
}

/** Two rows of pixel squares in three colours. */
function pixelStrip(c: Ctx): Section {
  const cols = 12;
  const rows = 2;
  const sq = Math.floor(W / cols);
  const fills = [c.pal.bg, '#ffffff', '#000000', c.pal.surface];
  const cells: Node[] = [];
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++) cells.push(shape(c, { x: 0, y: 0, w: sq, h: 60, fill: fills[(k + r * 2 + ((k * 7) % 3)) % 4], name: 'Pixel' }));
  const g = group(c, { name: 'Pixels', x: 0, y: 0, w: W, h: rows * 60, children: cells, layout: { cols, bp: { tablet: cols, mobile: cols }, gap: 0 } });
  return section([g], rows * 60, c.pal.bg);
}

/** Black sign-up band: heading, a line, an email field with its button, then the socials. */
function signUp(c: Ctx): Section {
  const t = tone(c, 'dark');
  const head = text(c, { text: 'Be first through the door', x: 200, y: 0, w: 800, size: 44, color: '#ffffff', font: 'head', weight: 700, upper: true, align: 'center', name: 'Heading' });
  const p = text(c, { slot: 'newsletter', x: 300, y: 0, w: 600, size: 17, color: t.body, align: 'center', name: 'Paragraph' });
  const st = stackDown([head, p], 110, 16);
  const fy = st.y + 36;
  const fw = 420;
  const fx = (W - fw - 14 - 170) / 2;
  const field = group(c, {
    name: 'Email field', x: fx, y: fy, w: fw, h: 50, border: 'rgba(255,255,255,0.5)', radius: 400,
    children: [text(c, { text: 'your@burrow.fae', x: 24, y: 14, w: fw - 48, size: 15, color: 'rgba(255,255,255,0.5)', name: 'Placeholder' })],
  });
  const b = button(c, { text: 'Notify me', href: '/contact', x: fx + fw + 14, y: fy, w: 170, look: 'light' });
  const soc = text(c, { text: '✦ Glimmergram   ·   ❦ Leafcast   ·   ☾ Moonpost', x: 300, y: fy + 100, w: 600, size: 14, color: t.muted, align: 'center', name: 'Socials' });
  return section([...st.nodes, field, b, soc], bottom(soc) + 100, t.bg);
}

const spec: TemplateSpec = {
  key: '95b003f2',
  ref: '95b003f2',
  name: 'Pixie Pixelry',
  industry: 'agency',
  category: 'Agency',
  description: 'A pixie pixel-studio about to open its door: one huge violet headline, a checkered strip, a black sign-up band.',
  palette: {
    bg: '#6b2cf5', surface: '#4f17c9', ink: '#ffffff', body: 'rgba(255,255,255,0.84)', muted: 'rgba(255,255,255,0.7)',
    accent: '#ffffff', accentInk: '#4f17c9', dark: '#000000', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.74)', darkAccent: '#ffffff',
    line: 'rgba(255,255,255,0.22)',
  },
  fonts: { head: grot, body: grot, headWeight: 700, headTrack: -1, btnRadius: 999, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'small wordmark left, two links right, white pill CTA', footer: 'black: wordmark, socials, fine print in one row' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [soonHero(c), pixelStrip(c), signUp(c)],
    },
    {
      slug: 'studio',
      title: 'Studio',
      build: (c) => [
        pageTitle(c, { title: 'What we are building', tone: 'surface', intro: true }),
        cards(c, { n: 3, cols: 3, kind: 'numbered', tone: 'bg', cardFill: false, head: false }),
        pixelStrip(c),
        stats(c, { n: 3, tone: 'dark' }),
      ],
    },
    {
      slug: 'roadmap',
      title: 'Roadmap',
      build: (c) => [
        pageTitle(c, { title: 'The road to opening', tone: 'bg' }),
        steps(c, { n: 4, tone: 'surface', head: false }),
        centered(c, { tone: 'dark', heading: 'Bring a lantern on opening night', button: true }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Tap on the window' }), faq(c, { n: 4, tone: 'surface' }), signUp(c)],
    },
  ],
};
export default spec;

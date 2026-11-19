// Ref — a calm wellness practice: white and soft grey, coral serif wordmark, a centred photo hero with a coral pill.
// Kept: photo hero, centred serif headline + small uppercase line + coral pill · grey band, centred heading over
// two text columns · coral heading + plus-row list beside a grey "introduce yourself" card with a round portrait ·
// dark photo band holding one big serif quote, a round portrait and the author.
import {
  PAD, avatarsFor, bottom, button, cards, contact, faq, group, hero, image, pageTitle, pricing, section, shape, splitHeading, stackDown, stackLast, steps, team, text, tone, wash,
  type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';

const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** Left: coral heading and a list of "+" rows on hairlines. Right: a grey card that introduces the founder. */
function introAndList(c: Ctx): Section {
  const t = tone(c, 'bg');
  const lw = 500;
  const rowH = 58;
  const rows: Node[] = [0, 1, 2, 3].map((i) =>
    group(c, {
      name: `Row ${i + 1}`, x: 0, y: 0, w: lw, pct: 100, h: rowH,
      children: [
        shape(c, { x: 0, y: 0, w: lw, pct: 100, h: 1, fill: c.pal.line, name: 'Rule' }),
        text(c, { text: '+', x: 0, y: 16, w: 24, size: 22, color: c.pal.accent, name: 'Plus' }),
        text(c, { slot: 'offering.title', index: i, x: 36, y: 18, w: lw - 36, size: 18, color: t.ink, font: 'head', name: 'Row title' }),
      ],
    }),
  );
  const head = text(c, { text: 'Paths to a gentler season', x: PAD, y: 0, w: lw, size: 34, color: c.pal.accent, font: 'head', name: 'Heading' });
  const list = group(c, { name: 'Rows', x: PAD, y: 0, w: lw, h: rows.length * rowH, children: rows, flow: { gap: 0, pad: 0 } });
  const left = stackDown([head, list], 100, 30);

  const cx = 640;
  const cw = 500;
  const pad = 40;
  const inner = cw - pad * 2;
  const pct = (inner / cw) * 100;
  const h = text(c, { text: 'Hello, little traveller', x: pad, y: pad, w: inner, pct, size: 30, color: t.ink, font: 'head', italic: true, name: 'Card heading' });
  const p = text(c, { slot: 'about', x: pad, y: bottom(h) + 16, w: inner, pct, size: 15, color: t.body, name: 'Card text' });
  const b = button(c, { slot: 'cta', href: '/about', x: pad, y: bottom(p) + 22, look: 'outline' });
  const face = image(c, { key: avatarsFor(c.site, 1)[0], x: pad, y: bottom(b) + 28, w: 110, h: 110, circle: true });
  const ch = bottom(face) + pad;
  const card = group(c, { name: 'Intro card', x: cx, y: 100, w: cw, h: ch, children: [h, p, b, face], fill: c.pal.surface, flow: { gap: 18, pad } });
  return section([...left.nodes, ...stackLast([card])], Math.max(left.y, bottom(card)) + 100, t.bg);
}

/** Dark photo band: one big serif quote on the left, a round portrait and the author on the right. */
function quoteOverPhoto(c: Ctx): Section {
  const ov = 'rgba(20,18,18,0.62)';
  const q = text(c, { slot: 'review.quote', x: PAD, y: 0, w: 700, size: 34, color: '#ffffff', font: 'head', lh: 1.3, name: 'Quote' });
  const st = stackDown([q], 140, 0);
  const H = Math.max(560, st.y + 140);
  const face = image(c, { key: avatarsFor(c.site, 3)[0], x: 900, y: 140, w: 140, h: 140, circle: true });
  const who = text(c, { slot: 'review.author', x: 860, y: bottom(face) + 20, w: 220, size: 15, color: '#ffffff', align: 'center', upper: true, name: 'Author' });
  return section([...st.nodes, ...stackLast([face, who])], H, wash(ov), 'banner-image-atomic', { bgPin: { src: c.photo('@mist|forest'), paintFrame: true, pinned: false, overlay: ov } });
}

const spec: TemplateSpec = {
  key: '0b977915',
  ref: '0b977915',
  name: 'Willowdew Rest',
  industry: 'agency',
  category: 'Agency',
  description: 'A soft-spoken faerie herald house in white and coral: a misty centred hero, a plus-row list beside a warm hello card.',
  palette: {
    bg: '#ffffff',
    surface: '#f4f3f2',
    ink: '#2b2626',
    body: '#5c5555',
    muted: '#8f8686',
    accent: '#d9725f',
    accentInk: '#ffffff',
    dark: '#2b2626',
    darkInk: '#ffffff',
    darkBody: 'rgba(255,255,255,0.82)',
    darkAccent: '#f2b2a4',
    line: 'rgba(43,38,38,0.14)',
  },
  fonts: { head: serif, body: sans, headWeight: 400, headTrack: -0.3, btnRadius: 999, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'coral serif wordmark left, links beside it, coral pill CTA right', footer: 'white, wordmark + links + socials, small print centred' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'photo-center', photo: '@nature|landscape', h: 640, eyebrow: true, buttons: 1, overlay: 'rgba(30,24,22,0.36)' }),
        splitHeading(c, { tone: 'surface', paras: 2, button: false }),
        introAndList(c),
        quoteOverPhoto(c),
      ],
    },
    {
      slug: 'offerings',
      title: 'Offerings',
      build: (c) => [pageTitle(c, { title: 'What we offer', tone: 'surface' }), cards(c, { n: 4, cols: 2, kind: 'plain', tone: 'bg', head: false, link: '/contact' }), pricing(c, { n: 3, tone: 'surface' })],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [pageTitle(c, { title: 'About us', tone: 'bg' }), steps(c, { n: 3, tone: 'surface' }), team(c, { n: 4, avatars: avatarsFor(c.site, 0), tone: 'bg', head: { heading: 'The circle' } })],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'surface', heading: 'Send a leaf-note' }), faq(c, { n: 4, tone: 'bg', side: true })],
    },
  ],
};
export default spec;

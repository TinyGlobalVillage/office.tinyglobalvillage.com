// Ref — an enrolment-led trade school: night city photography, thin geometric sans, one violet accent.
// Kept: dark photo hero, words left + outlined button, a sign-up panel low-right · white 2×2 hairline grid, the
// first cell a heading and three cells with violet square icons · dark photo "about" band, heading left and
// paragraphs + outlined button right. Added: numbers, a price-row list and a sign-off band on inner pages.
import {
  CW, GLYPHS, PAD, W, bottom, button, cards, contact, ctaBand, faq, group, hero, pageTitle, reviews, section, shape, stackDown, stackLast, stats, steps, text, tone, wash,
  type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';

const grot = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

const HERO = '@city|architecture';
const ABOUT = '@architecture|interior#2';

/** The kit's photo hero plus a small moth-post sign-up panel tucked low-right. */
function heroWithSignup(c: Ctx): Section {
  const s = hero(c, { variant: 'photo-left', photo: HERO, h: 720, buttons: 1, headSize: 56, overlay: 'rgba(6,6,14,0.58)' });
  const pw = 330;
  const pad = 26;
  const inner = pw - pad * 2;
  const pct = (inner / pw) * 100;
  const h = text(c, { text: 'Join the guild roll', x: pad, y: pad, w: inner, pct, size: 20, color: '#ffffff', font: 'head', name: 'Panel heading' });
  const p = text(c, { slot: 'newsletter', x: pad, y: bottom(h) + 10, w: inner, pct, size: 14, color: 'rgba(255,255,255,0.8)', name: 'Panel text' });
  const field = shape(c, { x: pad, y: bottom(p) + 16, w: inner, pct, h: 44, fill: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.4)', name: 'Field' });
  const b = button(c, { text: 'Sign me up', href: '/contact', x: pad, y: bottom(field) + 12, w: inner, pct, look: 'solid' });
  const ph = bottom(b) + pad;
  const H = ((s.layersFrame as { desktop: { h: number } }).desktop.h);
  const panel = group(c, { name: 'Sign-up panel', x: W - PAD - pw, y: H - ph - 70, w: pw, h: ph, children: [h, p, field, b], fill: 'rgba(14,12,26,0.72)', flow: { gap: 12, pad } });
  s.layers.push(...stackLast([panel]));
  return s;
}

/** A 2×2 grid on hairlines: a heading cell, then three cells each with a violet square glyph, a title and a line. */
function whyGrid(c: Ctx): Section {
  const t = tone(c, 'bg');
  const cellW = CW / 2;
  const pad = 44;
  const inner = cellW - pad * 2;
  const pct = (inner / cellW) * 100;
  const cells: Node[] = [];
  const headCell = [
    text(c, { text: 'Why the guild keeps its door open', x: pad, y: pad, w: inner, pct, size: 36, color: t.head, font: 'head', lh: 1.15, name: 'Heading' }),
  ];
  headCell.push(text(c, { slot: 'subhead', x: pad, y: bottom(headCell[0]) + 16, w: inner, pct, size: 16, color: t.body, name: 'Intro' }));
  let cellH = bottom(headCell[1]) + pad;
  const bodies: Node[][] = [];
  for (let i = 0; i < 3; i++) {
    const icon = group(c, {
      name: 'Icon', x: pad, y: pad, w: 52, h: 52,
      children: [
        shape(c, { x: 0, y: 0, w: 52, h: 52, fill: c.pal.accent, name: 'Icon square' }),
        text(c, { text: GLYPHS[(i * 4 + 2) % GLYPHS.length], x: 0, y: 10, w: 52, size: 24, color: '#ffffff', align: 'center', lh: 1.2, name: 'Glyph' }),
      ],
    });
    const ti = text(c, { slot: 'offering.title', index: i, x: pad, y: bottom(icon) + 22, w: inner, pct, size: 22, color: t.head, font: 'head', name: 'Title' });
    const bo = text(c, { slot: 'offering.body', index: i, x: pad, y: bottom(ti) + 10, w: inner, pct, size: 15, color: t.body, name: 'Body' });
    bodies.push([icon, ti, bo]);
    cellH = Math.max(cellH, bottom(bo) + pad);
  }
  [headCell, ...bodies].forEach((kids, i) => {
    cells.push(group(c, { name: `Cell ${i + 1}`, x: 0, y: 0, w: cellW, h: cellH, children: kids, border: c.pal.line, flow: { gap: 14, pad } }));
  });
  const g = group(c, { name: 'Why grid', x: PAD, y: 90, w: CW, h: cellH * 2, children: cells, layout: { cols: 2, bp: { tablet: 2, mobile: 1 }, gap: 0 } });
  return section([g], bottom(g) + 90, t.bg);
}

/** Dark photo band: big heading + line on the left; paragraphs + outlined button on the right. */
function aboutOverPhoto(c: Ctx): Section {
  const ov = 'rgba(8,8,16,0.7)';
  const left = stackDown([
    text(c, { text: 'A guild built for the long road', x: PAD, y: 0, w: 460, size: 44, color: '#ffffff', font: 'head', lh: 1.1, name: 'Heading' }),
    text(c, { slot: 'tagline', x: PAD, y: 0, w: 440, size: 18, color: 'rgba(255,255,255,0.78)', name: 'Line' }),
  ], 130, 20);
  const right = stackDown([
    text(c, { slot: 'about', x: 640, y: 0, w: 500, size: 16, color: 'rgba(255,255,255,0.86)', name: 'Paragraph' }),
    text(c, { slot: 'mission', x: 640, y: 0, w: 500, size: 16, color: 'rgba(255,255,255,0.86)', name: 'Paragraph 2' }),
    button(c, { slot: 'cta', href: '/about', x: 640, y: 0, look: 'ghost-light' }),
  ], 130, [18, 30]);
  const H = Math.max(left.y, right.y) + 130;
  return section([...left.nodes, ...right.nodes], H, wash(ov), 'banner-image-atomic', { bgPin: { src: c.photo(ABOUT), paintFrame: true, pinned: false, overlay: ov } });
}

const spec: TemplateSpec = {
  key: '191813b0',
  ref: '191813b0',
  name: 'Lanternway Guild',
  industry: 'business',
  category: 'Business',
  description: 'A night-lit caravan guild school: dark city photography, a sign-up panel in the hero, a crisp hairline grid.',
  palette: {
    bg: '#ffffff',
    surface: '#f3f2f8',
    ink: '#121218',
    body: '#4a4a58',
    muted: '#7d7d8c',
    accent: '#7457f0',
    accentInk: '#ffffff',
    dark: '#121218',
    darkInk: '#ffffff',
    darkBody: 'rgba(255,255,255,0.8)',
    darkAccent: '#b9a8ff',
    line: 'rgba(18,18,24,0.14)',
  },
  fonts: { head: grot, body: sans, headWeight: 400, headTrack: -0.6, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'wordmark left; links in a row right with Log In + violet enrol button, transparent over the hero', footer: 'black, four link columns + small print' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [heroWithSignup(c), whyGrid(c), aboutOverPhoto(c), stats(c, { n: 4, tone: 'bg', boxed: true })],
    },
    {
      slug: 'programs',
      title: 'Programs',
      build: (c) => [pageTitle(c, { title: 'Courses of the road', tone: 'dark', align: 'left' }), cards(c, { n: 4, cols: 1, kind: 'price-row', tone: 'bg', head: false }), steps(c, { n: 3, tone: 'surface' })],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [pageTitle(c, { title: 'About the guild', tone: 'surface', align: 'left' }), reviews(c, { n: 3, cols: 3, tone: 'bg' }), faq(c, { n: 5, tone: 'surface' })],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Send word to the guild' }), ctaBand(c, { tone: 'accent', buttons: 2 })],
    },
  ],
};
export default spec;

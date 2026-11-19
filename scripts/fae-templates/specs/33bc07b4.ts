// Ref — a one-tutor online lessons site: a cream split hero with a desk photo, a "what I teach" block (words left,
// a 2×2 grid of subject tiles right), one big testimonial beside its heading, a cream contact block.
// Kept: split hero on a light band · heading-left / tile-grid-right block · heading-left / single big quote ·
// contact with a note card.
import { avatarsFor, badge, button, cards, contact, group, hero, pageTitle, pricing, reviews, section, splitHeading, stackDown, stackLast, steps, team, text, tone, faq, GLYPHS, CW, PAD, type Ctx, type Node, type Section, type TemplateSpec } from '../kit.ts';

const avenir = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

/** Words on the left (heading, paragraph, button), a 2×2 grid of subject tiles on the right — each tile a title,
 *  a glyph square and a line. On a phone the tiles fall into one column under the words. */
function teach(c: Ctx): Section {
  const t = tone(c, 'bg');
  const left = stackDown([
    text(c, { text: 'What I can teach you', x: PAD, y: 0, w: 380, size: 38, color: t.head, font: 'head', name: 'Heading' }),
    text(c, { slot: 'paragraph', x: PAD, y: 0, w: 380, size: 16, color: t.body, name: 'Paragraph' }),
    button(c, { slot: 'cta', href: '/services', x: PAD, y: 0, look: 'solid' }),
  ], 110, [20, 30]);
  const gx = 500;
  const gw = CW - (gx - PAD);
  const gap = 24;
  const cellW = (gw - gap) / 2;
  const pad = 24;
  const inner = ((cellW - pad * 2) / cellW) * 100;
  const tiles: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < 4; i++) {
    const ti = text(c, { slot: 'offering.title', index: i, x: pad, y: 24, w: cellW - pad * 2, pct: inner, size: 19, color: t.head, font: 'head', role: 'h3', name: 'Subject' });
    const ic = badge(c, { x: pad, y: ti.box.desktop.y + ti.box.desktop.h + 14, d: 52, glyph: GLYPHS[(i * 3 + 1) % GLYPHS.length], fill: i % 2 ? '#ffd9a8' : '#c9d3ff', ink: c.pal.ink });
    const by = ic[0].box.desktop.y + 52 + 14;
    const bo = text(c, { slot: 'offering.body', index: i, x: pad, y: by, w: cellW - pad * 2, pct: inner, size: 14, color: t.body, name: 'Line' });
    const h = bo.box.desktop.y + bo.box.desktop.h + 24;
    maxH = Math.max(maxH, h);
    tiles.push(group(c, { name: `Subject ${i + 1}`, x: 0, y: 0, w: cellW, h, children: [ti, ...ic, bo], flow: { gap: 14, pad: 24 }, fill: c.pal.surface, radius: c.fonts.cardRadius ?? 0 }));
  }
  for (const k of tiles) k.box.desktop.h = maxH;
  const gh = maxH * 2 + gap;
  const grid = group(c, { name: 'Subjects', x: gx, y: 100, w: gw, h: gh, children: tiles, layout: { cols: 2, bp: { tablet: 2, mobile: 1 }, gap } });
  return section([...left.nodes, ...stackLast([grid])], Math.max(left.y, 100 + gh) + 100, t.bg);
}

/** Heading on the left, one large quote with its author on the right. */
function bigQuote(c: Ctx): Section {
  const t = tone(c, 'bg');
  const head = text(c, { text: 'Kind words from my pupils', x: PAD, y: 100, w: 360, size: 36, color: t.head, font: 'head', name: 'Heading' });
  const st = stackDown([
    text(c, { text: '“', x: 500, y: 0, w: 80, size: 80, color: c.pal.accent, font: 'head', lh: 1, name: 'Mark' }),
    text(c, { slot: 'review.quote', index: 0, x: 500, y: 0, w: 640, size: 24, color: t.ink, font: 'head', lh: 1.5, weight: 400, name: 'Quote' }),
    text(c, { slot: 'review.author', index: 0, x: 500, y: 0, w: 640, size: 15, color: t.muted, weight: 600, name: 'Author' }),
  ], 110, [0, 20]);
  return section([head, ...st.nodes], Math.max(head.box.desktop.y + head.box.desktop.h, st.y) + 100, t.bg);
}

const spec: TemplateSpec = {
  key: '33bc07b4',
  ref: '33bc07b4',
  name: 'Inkwell Hollow Lessons',
  industry: 'education',
  category: 'Education',
  description: 'A cosy one-elf tutoring nook: a cream welcome by the desk, a little grid of subject tiles, one big kind word.',
  palette: { bg: '#ffffff', surface: '#fdf0e0', ink: '#1d2a8a', body: '#3a4270', muted: '#666d96', accent: '#1d2a8a', accentInk: '#ffffff', dark: '#1d2a8a', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.84)', darkAccent: '#ffd9a8', line: 'rgba(29,42,138,0.14)' },
  fonts: { head: avenir, body: avenir, headWeight: 600, btnRadius: 6, cardRadius: 12 },
  chrome: { nav: 'name left, links right, navy "book a lesson" button', footer: 'cream, centred name, email and social glyphs' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'split', tone: 'surface', photo: '@study|desk', h: 620, imageRadius: 12, buttons: 2 }),
        teach(c),
        bigQuote(c),
        contact(c, { tone: 'surface', heading: 'Book a first lesson' }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'Hello, I am your tutor', tone: 'surface' }),
        splitHeading(c, { tone: 'bg', paras: 2, button: false }),
        team(c, { n: 1, avatars: avatarsFor(c.site, 4), tone: 'surface', head: false, bio: true }),
      ],
    },
    {
      slug: 'services',
      title: 'Services',
      build: (c) => [
        pageTitle(c, { title: 'Lessons I offer', tone: 'bg' }),
        cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'surface', head: false, align: 'left' }),
        steps(c, { n: 3, tone: 'bg', head: { heading: 'How a lesson runs' } }),
      ],
    },
    {
      slug: 'packages',
      title: 'Packages',
      build: (c) => [
        pageTitle(c, { title: 'Lesson bundles', tone: 'surface' }),
        pricing(c, { n: 3, tone: 'bg', head: false }),
        reviews(c, { n: 2, cols: 2, tone: 'surface', avatars: avatarsFor(c.site, 4) }),
        faq(c, { n: 4, tone: 'bg' }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Send a note by owl' })],
    },
  ],
};
export default spec;

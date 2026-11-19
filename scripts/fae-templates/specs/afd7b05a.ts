// Ref — a friendly one-tutor practice: pale grey page, a rounded inset hero picture, bold rounded sans, violet + coral.
// Kept: inset picture hero with a bold white headline left + violet pill · "about me": violet heading, a portrait
// overlapping a white shadowed card of two paragraphs · "how it works": violet heading over ONE white shadowed card
// holding a 2×2 grid · a coral pill to close.
import {
  CW, PAD, avatarsFor, bottom, button, cards, contact, faq, group, hero, image, pageTitle, pricing, reviews, section, stackLast, steps, text, tone,
  type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';

const avenir = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";
const SHADOW = '0px 18px 44px rgba(40,30,90,0.12)';

/** Violet heading, then a round portrait overlapping the left edge of a white shadowed card of two paragraphs. */
function aboutCard(c: Ctx): Section {
  const t = tone(c, 'bg');
  const head = text(c, { text: 'Meet your pathfinder', x: PAD, y: 90, w: CW, size: 40, color: c.pal.accent, font: 'head', name: 'Heading' });
  const cx = 360;
  const cw = 1140 - cx;
  const pad = 48;
  const inner = cw - pad * 2;
  const pct = (inner / cw) * 100;
  const p1 = text(c, { slot: 'about', x: pad, y: pad, w: inner, pct, size: 16, color: t.body, name: 'Paragraph' });
  const p2 = text(c, { slot: 'mission', x: pad, y: bottom(p1) + 16, w: inner, pct, size: 16, color: t.body, name: 'Paragraph 2' });
  const ch = Math.max(300, bottom(p2) + pad);
  const top = bottom(head) + 50;
  const card = group(c, { name: 'About card', x: cx, y: top, w: cw, h: ch, children: [p1, p2], fill: '#ffffff', radius: 20, shadow: SHADOW, flow: { gap: 16, pad } });
  // the portrait leans over the card's left edge (drawn after it, so it sits on top)
  const face = image(c, { key: avatarsFor(c.site, 3)[0], x: PAD, y: top + (ch - 330) / 2, w: 330, h: 330, circle: true });
  return section([head, card, ...stackLast([face])], Math.max(bottom(card), bottom(face)) + 90, t.bg);
}

/** Violet heading over a single white card that holds a 2×2 grid of title + text cells. */
function howCard(c: Ctx): Section {
  const t = tone(c, 'bg');
  const head = text(c, { text: 'How the path unfolds', x: PAD, y: 40, w: CW, size: 40, color: c.pal.accent, font: 'head', align: 'center', name: 'Heading' });
  const pad = 48;
  const gridW = CW - pad * 2;
  const cellW = (gridW - 60) / 2;
  const cells: Node[] = [0, 1, 2, 3].map((i) => {
    const ti = text(c, { slot: 'offering.title', index: i, x: 0, y: 0, w: cellW, pct: 100, size: 22, color: t.ink, font: 'head', name: 'Title' });
    const bo = text(c, { slot: 'offering.body', index: i, x: 0, y: bottom(ti) + 10, w: cellW, pct: 100, size: 15, color: t.body, name: 'Body' });
    return group(c, { name: `Step ${i + 1}`, x: 0, y: 0, w: cellW, h: bottom(bo), children: [ti, bo], flow: { gap: 10, pad: 0 } });
  });
  const cellH = Math.max(...cells.map((n) => n.box.desktop.h));
  for (const n of cells) n.box.desktop.h = cellH;
  const grid = group(c, { name: 'Grid', x: pad, y: pad, w: gridW, h: cellH * 2 + 44, children: cells, layout: { cols: 2, bp: { tablet: 2, mobile: 1 }, gap: 44 } });
  const card = group(c, { name: 'How card', x: PAD, y: bottom(head) + 40, w: CW, h: bottom(grid) + pad, children: [grid], fill: '#ffffff', radius: 20, shadow: SHADOW });
  const b = button(c, { slot: 'cta', href: '/sessions', x: (1200 - 180) / 2, y: bottom(card) + 50, w: 180, look: 'dark' });
  return section([head, card, b], bottom(b) + 90, t.bg);
}

const spec: TemplateSpec = {
  key: 'afd7b05a',
  ref: 'afd7b05a',
  name: 'Peakpebble Paths',
  industry: 'coach',
  category: 'Coach',
  description: 'A cheerful gnome pathfinder’s tutoring nook: a rounded mountain hero, a portrait leaning on its card, one tidy how-to card.',
  palette: {
    bg: '#f5f5f7',
    surface: '#ebe8f8',
    ink: '#1e1b33',
    body: '#4b4862',
    muted: '#807d96',
    accent: '#5533cc',
    accentInk: '#ffffff',
    dark: '#ff8a6a',
    darkInk: '#2a1406',
    darkBody: 'rgba(42,20,6,0.86)',
    darkAccent: '#2a1406',
    line: 'rgba(30,27,51,0.12)',
  },
  fonts: { head: avenir, body: avenir, headWeight: 700, headTrack: -0.4, btnRadius: 999, cardRadius: 20 },
  chrome: { nav: 'pale grey bar: little flag mark + wordmark left, links right, Log In', footer: 'pale grey, wordmark + links + small print' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'photo-left', photo: '@landscape|mist', h: 600, buttons: 1, headSize: 50, imageRadius: 24, overlay: 'rgba(14,60,70,0.34)' }),
        aboutCard(c),
        howCard(c),
      ],
    },
    {
      slug: 'sessions',
      title: 'Sessions',
      build: (c) => [pageTitle(c, { title: 'Sessions', tone: 'surface' }), pricing(c, { n: 3, tone: 'bg' }), faq(c, { n: 4, tone: 'surface' })],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [pageTitle(c, { title: 'About me', tone: 'bg' }), steps(c, { n: 3, tone: 'surface' }), reviews(c, { n: 3, cols: 3, tone: 'bg', avatars: avatarsFor(c.site, 0) })],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Send a pebble-note' }), cards(c, { n: 3, cols: 3, kind: 'icon', tone: 'surface', head: false })],
    },
  ],
};
export default spec;

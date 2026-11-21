// Ref — a dark slate print-house: photo hero with words left, a boxed numbers strip, blue pill buttons, a thin geometric sans.
// Kept: photo hero (words left, two buttons) · four-number strip · white tab label + big statement over a photo ·
// white tab + 2×2 icon reasons beside a tall picture · split call-to-action.
import {
  avatarsFor, badge, bottom, button, cards, contact, ctaBand, faq, GLYPHS, group, hero, image, PAD, pageTitle, section, shape,
  splitHeading, stackDown, stackLast, stats, steps, team, text, tone, wash, type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';

const sans = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

/** A white tab label sitting on a band's top edge. */
function tab(c: Ctx, label: string): Node {
  return group(c, {
    name: 'Tab', x: PAD, y: 0, w: 260, h: 44,
    children: [
      shape(c, { x: 0, y: 0, w: 260, h: 44, fill: '#ffffff', radius: 3, name: 'Tab card' }),
      text(c, { text: label, x: 16, y: 11, w: 228, size: 14, color: '#16161a', weight: 700, lh: 1.3, name: 'Tab label' }),
    ],
  });
}

/** One big left-aligned statement over a darkened photo, with a button. */
function statement(c: Ctx, photo: string): Section {
  const ov = 'rgba(18,22,36,0.74)';
  const words = text(c, { slot: 'about', x: PAD, y: 0, w: 640, size: 30, color: '#ffffff', font: 'head', weight: 400, lh: 1.4, name: 'Statement' });
  const b = button(c, { slot: 'cta', href: '/about', x: PAD, y: 0 });
  const st = stackDown([words, b], 190, 40);
  const H = Math.max(st.y + 170, 640);
  return section([tab(c, 'What we weave'), ...st.nodes], H, wash(ov), 'banner-image-atomic', {
    bgPin: { src: c.photo(photo), paintFrame: true, pinned: false, overlay: ov },
  });
}

/** Four reasons in a 2×2 grid on the left, a tall picture on the right. */
function reasonsBeside(c: Ctx, photo: string): Section {
  const t = tone(c, 'dark');
  const cellW = 270;
  const gap = 44;
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < 4; i++) {
    const ti = text(c, { slot: 'offering.title', x: 0, y: 70, w: cellW, pct: 100, size: 22, color: t.head, font: 'head', weight: 400, role: 'h3', name: 'Title' });
    const bo = text(c, { slot: 'offering.body', x: 0, y: bottom(ti) + 12, w: cellW, pct: 100, size: 15, color: t.body, name: 'Body' });
    const kids = [...badge(c, { x: 0, y: 0, d: 46, glyph: GLYPHS[(i * 3) % GLYPHS.length], fill: 'rgba(255,255,255,0.08)', ink: '#ffffff' }), ti, bo];
    maxH = Math.max(maxH, bottom(bo) + 6);
    items.push(group(c, { name: `Reason ${i + 1}`, x: 0, y: 0, w: cellW, h: bottom(bo) + 6, children: kids, flow: { gap: 12, pad: 6 } }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const gy = 160;
  const gh = maxH * 2 + gap;
  const grid = group(c, { name: 'Reasons', x: PAD, y: gy, w: cellW * 2 + gap, h: gh, children: items, layout: { cols: 2, bp: { tablet: 2, mobile: 1 }, gap } });
  const H = gy + gh + 120;
  const pic = image(c, { key: photo, x: 700, y: 0, w: 440, h: H });
  return section([tab(c, 'Why folk choose us'), grid, ...stackLast([pic])], H, t.bg);
}

const spec: TemplateSpec = {
  key: '72184101',
  ref: '72184101',
  name: 'Gearwhistle Works',
  industry: 'agency',
  category: 'Agency',
  description: 'A gnome herald-press after dark: photo hero, a strip of numbers, a statement over smoke, reasons beside a tall picture.',
  palette: {
    bg: '#14161f', surface: '#1d2130', ink: '#f2f4fa', body: 'rgba(242,244,250,0.74)', muted: 'rgba(242,244,250,0.52)',
    accent: '#3b5bff', accentInk: '#ffffff', dark: '#0f2238', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', darkAccent: '#9fb0ff',
    line: 'rgba(255,255,255,0.12)',
  },
  fonts: { head: sans, body: sans, headWeight: 400, btnRadius: 999, cardRadius: 4 },
  chrome: { nav: 'brand-left, links in a dark pill centre-right, blue pill CTA', footer: 'dark, brand left, link columns, fine print' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'photo-left', photo: '@forest|mist', h: 680, buttons: 2, overlay: 'rgba(14,16,26,0.6)' }),
        stats(c, { n: 4, tone: 'surface', boxed: true }),
        statement(c, '@mist|forest#2'),
        reasonsBeside(c, '@moss|mushroom'),
        ctaBand(c, { tone: 'accent', split: true }),
      ],
    },
    {
      slug: 'services',
      title: 'Services',
      build: (c) => [
        pageTitle(c, { title: 'What the press makes', tone: 'surface', align: 'left' }),
        cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'bg', head: false, align: 'left', price: true }),
        steps(c, { n: 4, tone: 'surface', head: { heading: 'From sketch to banner', intro: true } }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'Under one roof', tone: 'dark' }),
        splitHeading(c, { tone: 'bg', paras: 2 }),
        team(c, { n: 4, avatars: avatarsFor(c.site, 4), tone: 'surface', head: { heading: 'The hands at the press' } }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', photo: '@forest|mist' }), faq(c, { n: 5, tone: 'surface' })],
    },
  ],
};
export default spec;

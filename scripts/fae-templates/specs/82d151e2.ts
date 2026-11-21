// Ref — a grey gadget store: a violet offer strip, a photo hero with left-set words, then shelf after shelf of
// devices (heading + hairline, five items with title and price, a centred button), a row of maker wordmarks.
// Kept: thin accent strip · left-aligned photo hero · three product shelves (heading, rule, five-up grid, button) ·
// wordmark row.
import { avatarsFor, button, cards, contact, faq, group, hero, logos, pageTitle, reviews, section, shape, splitHeading, stats, text, tone, W, CW, PAD, type Ctx, type Node, type Section, type TemplateSpec } from '../kit.ts';

const grot = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

function strip(c: Ctx, words: string): Section {
  const t = tone(c, 'accent');
  const line = text(c, { text: words, x: PAD, y: 12, w: CW, size: 13, color: t.ink, weight: 600, align: 'center', lh: 1.5, name: 'Offer' });
  return section([line], line.box.desktop.h + 24, t.bg);
}

/** Gadget glows: each shelf item is a drawn device — a dark rounded body with a glowing screen — not a photo. */
const GLOWS = [
  'linear-gradient(135deg, #8a5cff, #2ad1c9)',
  'linear-gradient(160deg, #ff9a62, #ff4e8a)',
  'radial-gradient(circle at 30% 30%, #b8f7a1, #2a8f6b)',
  'linear-gradient(200deg, #6cc8ff, #3a3aa8)',
  'radial-gradient(circle at 70% 40%, #ffe27a, #e07b1f)',
];

/** A shelf: heading + hairline, five drawn devices with name and price, a centred button. */
function shelf(c: Ctx, heading: string, offset: number, t: 'bg' | 'surface'): Section {
  const tn = tone(c, t);
  const head = text(c, { text: heading, x: PAD, y: 80, w: 700, size: 30, color: tn.head, font: 'head', name: 'Shelf heading' });
  const rule = shape(c, { x: PAD, y: head.box.desktop.y + head.box.desktop.h + 18, w: CW, h: 1, fill: tn.line, name: 'Rule' });
  const n = 5;
  const gap = 20;
  const cellW = (CW - gap * (n - 1)) / n;
  const devH = 190;
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < n; i++) {
    const k = offset + i;
    const ti = text(c, { slot: 'offering.title', index: k, x: 0, y: devH + 16, w: cellW, pct: 100, size: 16, color: tn.head, font: 'head', role: 'h3', name: 'Name' });
    const pr = text(c, { slot: 'offering.price', index: k, x: 0, y: ti.box.desktop.y + ti.box.desktop.h + 6, w: cellW, pct: 100, size: 15, color: c.pal.accent, weight: 700, name: 'Price' });
    const h = pr.box.desktop.y + pr.box.desktop.h + 6;
    maxH = Math.max(maxH, h);
    items.push(group(c, {
      name: `Item ${i + 1}`, x: 0, y: 0, w: cellW, h,
      children: [
        shape(c, { x: 0, y: 0, w: cellW, h: devH, pct: 100, fill: '#ffffff', radius: 14, border: tn.line, name: 'Card' }),
        shape(c, { x: 22, y: 22, w: cellW - 44, h: devH - 44, pct: 78, fill: '#1c1c22', radius: 18, name: 'Device' }),
        shape(c, { x: 30, y: 30, w: cellW - 60, h: devH - 60, pct: 70, fill: GLOWS[k % GLOWS.length], radius: 12, name: 'Screen' }),
        ti,
        pr,
      ],
    }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const gh = maxH;
  const grid = group(c, { name: 'Shelf', x: PAD, y: rule.box.desktop.y + 34, w: CW, h: gh, children: items, layout: { cols: n, bp: { tablet: 3, mobile: 2 }, gap } });
  const b = button(c, { text: 'See the whole shelf', href: '/shop', x: 0, y: grid.box.desktop.y + gh + 40, look: 'outline' });
  b.box.desktop.x = Math.round((W - b.box.desktop.w) / 2);
  return section([head, rule, grid, b], b.box.desktop.y + 50 + 80, tn.bg);
}

const spec: TemplateSpec = {
  key: '82d151e2',
  ref: '82d151e2',
  name: 'Glimmerwick Gizmos',
  industry: 'ecommerce',
  category: 'Ecommerce',
  description: 'A tinkering gnome gadget shop: a violet strip of offers, a photo welcome, then shelf after shelf of glowing contraptions.',
  palette: { bg: '#efefef', surface: '#ffffff', ink: '#16161a', body: '#45454d', muted: '#6e6e78', accent: '#6c3cf5', accentInk: '#ffffff', dark: '#16161a', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#b9a2ff', line: 'rgba(22,22,26,0.14)' },
  fonts: { head: grot, body: sans, headWeight: 700, headTrack: -0.5, btnRadius: 8, cardRadius: 14 },
  chrome: { nav: 'logo left, search field centre, account + basket right; category links on a second row', footer: 'dark, four link columns, newsletter field, payment glyphs' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        strip(c, 'Free wing-post on every contraption this moon  ·  Mended for life by the workshop gnomes'),
        hero(c, { variant: 'photo-left', photo: '@product|light', h: 500, buttons: 1, overlay: 'rgba(20,10,50,0.5)' }),
        shelf(c, 'New on the bench', 0, 'bg'),
        shelf(c, 'Lanterns & glowstones', 5, 'surface'),
        shelf(c, 'Pocket contraptions', 10, 'bg'),
        logos(c, { n: 5, tone: 'surface', label: 'Tinkered alongside these workshops', seeds: ['gizmo-a', 'gizmo-b', 'gizmo-c', 'gizmo-d', 'gizmo-e'] }),
      ],
    },
    {
      slug: 'shop',
      title: 'Shop All',
      build: (c) => [
        pageTitle(c, { title: 'Every contraption', tone: 'surface', align: 'left' }),
        shelf(c, 'Fresh from the bench', 0, 'bg'),
        shelf(c, 'Glow & spark', 5, 'surface'),
        faq(c, { n: 4, tone: 'bg' }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'The workshop under the root', tone: 'dark' }),
        splitHeading(c, { tone: 'bg', paras: 2, button: false }),
        stats(c, { n: 4, tone: 'surface', boxed: true }),
        reviews(c, { n: 3, tone: 'bg', avatars: avatarsFor(c.site, 3) }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [
        contact(c, { tone: 'bg', heading: 'Ring the workshop bell' }),
        cards(c, { n: 3, cols: 3, kind: 'icon', tone: 'surface', head: { heading: 'Help at the bench' } }),
      ],
    },
  ],
};
export default spec;

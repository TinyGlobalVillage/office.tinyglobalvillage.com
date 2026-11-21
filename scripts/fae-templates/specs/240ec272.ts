// Ref — a lavender-and-pink performer site: huge purple capitals, picture right, an "upcoming shows" list with pink
// RSVP buttons, a merch row on lilac.
// Kept: split hero on pale lavender (huge heading, pink eyebrow) · upcoming-nights list with a button per night and a
// "see all" button · three merch picture cards with prices on lilac · pink call band.
import {
  CW, PAD, W, button, contact, ctaBand, faq, group, cards, hero, pageTitle, reviews, section, shape, stackDown, text, tone, centered, avatarsFor,
  type Ctx, type Node, type Section, type TemplateSpec, type Tone,
} from '../kit.ts';

const round = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** Upcoming nights: a pale panel of rows (date, title, place, a button each), then a "see every night" button. */
function nights(c: Ctx, tn: Tone, n = 4, heading = 'Nights under the lanterns'): Section {
  const t = tone(c, tn);
  const head = text(c, { text: heading, x: PAD, y: 0, w: CW, size: 44, color: t.head, font: 'head', align: 'center', upper: true, name: 'Heading' });
  const gap = 18;
  const cols = 2;
  const cellW = (CW - gap * (cols - 1)) / cols;
  const pad = 26;
  const pct = ((cellW - pad * 2) / cellW) * 100;
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < n; i++) {
    const d = text(c, { slot: 'event.date', index: i, x: pad, y: 26, w: cellW - pad * 2, pct, size: 13, color: c.pal.accent, weight: 700, upper: true, track: 1.6, name: 'Date' });
    const ti = text(c, { slot: 'event.title', index: i, x: pad, y: d.box.desktop.y + d.box.desktop.h + 8, w: cellW - pad * 2, pct, size: 22, color: t.head, font: 'head', role: 'h3', name: 'Night' });
    const pl = text(c, { slot: 'address', index: 0, x: pad, y: ti.box.desktop.y + ti.box.desktop.h + 6, w: cellW - pad * 2, pct, size: 14, color: t.body, name: 'Place' });
    const b = button(c, { text: 'Save a seat', href: '/contact', x: pad, y: pl.box.desktop.y + pl.box.desktop.h + 16, pct: 50, look: 'solid', size: 14 });
    const h = b.box.desktop.y + 50 + 26;
    maxH = Math.max(maxH, h);
    items.push(group(c, { name: `Night ${i + 1}`, x: 0, y: 0, w: cellW, h, children: [d, ti, pl, b], flow: { gap: 8, pad: 26 }, fill: t.card, border: c.pal.line, radius: c.fonts.cardRadius ?? 0 }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const rows = Math.ceil(n / cols);
  const gh = rows * maxH + (rows - 1) * gap;
  const grid = group(c, { name: 'Nights', x: PAD, y: 0, w: CW, h: gh, children: items, layout: { cols, bp: { tablet: 1, mobile: 1 }, gap } });
  const rule = shape(c, { x: PAD, y: 0, w: CW, h: 2, fill: c.pal.accent, name: 'Rule' });
  const all = button(c, { text: 'See every night', href: '/shows', x: 0, y: 0, look: 'outline' });
  all.box.desktop.x = Math.round((W - all.box.desktop.w) / 2);
  const st = stackDown([head, rule, grid, all], 96, [26, 30, 40]);
  return section(st.nodes, st.y + 100, t.bg);
}

const MERCH = ['@bakery|bread', '@mushroom|moss', '@books|study'];

const spec: TemplateSpec = {
  key: '240ec272',
  ref: '240ec272',
  name: 'Foxglove Fancy',
  industry: 'actor',
  category: 'Actor',
  description: 'A foxglove-purple show-sprite\'s page: huge capitals on lavender, a run of lantern nights with seat buttons, trinkets on lilac.',
  palette: {
    bg: '#ffffff',
    surface: '#eef1fd',
    ink: '#3d1a78',
    body: '#4b3a6e',
    muted: '#c93a72',
    accent: '#d63a74',
    accentInk: '#ffffff',
    dark: '#3d1a78',
    darkInk: '#ffffff',
    darkBody: 'rgba(255,255,255,0.84)',
    darkAccent: '#ffb3cf',
    line: 'rgba(214,58,116,0.35)',
  },
  fonts: { head: round, body: sans, headWeight: 800, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'brand-left in purple capitals, links right, pink side-tab "book" button', footer: 'lavender, centred brand, socials row' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'split', tone: 'surface', photo: '@light|candle', eyebrow: true, headSize: 72, buttons: 1, h: 720 }),
        nights(c, 'bg', 4),
        cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'surface', photos: MERCH, price: true, imgH: 300, head: { heading: 'Trinkets from the wings' }, button: true }),
        ctaBand(c, { tone: 'accent', split: true }),
      ],
    },
    {
      slug: 'shows',
      title: 'Shows',
      build: (c) => [
        pageTitle(c, { title: 'Every lantern night', tone: 'surface' }),
        nights(c, 'bg', 6, 'Coming moons'),
        faq(c, { n: 4, tone: 'surface' }),
      ],
    },
    {
      slug: 'shop',
      title: 'Shop',
      build: (c) => [
        pageTitle(c, { title: 'The trinket chest', tone: 'dark' }),
        cards(c, { n: 6, cols: 3, kind: 'photo', tone: 'bg', photos: MERCH, price: true, head: false }),
        reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 3) }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Book the sprite' }), centered(c, { tone: 'dark', heading: 'Lantern letters', slot: 'newsletter' })],
    },
  ],
};
export default spec;

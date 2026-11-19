// Ref — a soft boutique's collection page: a short photo banner with a centred title, then a filter column on the
// left beside a three-wide product grid with sale tags and stars, a newsletter strip, and a grey footer.
// Kept: short photo banner · filter sidebar + 3-col product grid · newsletter strip.
import {
  CW, PAD, avatarsFor, bottom, centered, faq, group, hOf, hero, imageStory, pageTitle, posts, reviews, section, shape, stackLast, text, tone,
  type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';
import { shelfGrid } from './91242216.ts';

const serif2 = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const avenir = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

const FILTERS: Array<[string, string[]]> = [
  ['Kind', ['Lanterns', 'Blankets', 'Cups & jars', 'Scarves']],
  ['Shade', ['Moss', 'Dusk', 'Honey', 'Frost']],
  ['Price', ['Under 20 silver', '20 – 60 silver', 'Over 60 silver']],
];

/** Filter column (flowing, so it stacks above the grid on phones) beside a 3-wide product grid. */
function collection(ctx: Ctx): Section {
  const t = tone(ctx, 'bg');
  const sw = 210;
  const kids: Node[] = [text(ctx, { text: 'Sift the shelves', x: 0, y: 0, w: sw, pct: 100, size: 20, color: t.head, font: 'head', role: 'h2', name: 'Filter heading' })];
  FILTERS.forEach(([label, opts], gi) => {
    kids.push(shape(ctx, { x: 0, y: 0, w: sw, h: 1, pct: 100, fill: t.line, name: 'Rule' }));
    kids.push(text(ctx, { text: label, x: 0, y: 0, w: sw, pct: 100, size: 12, color: t.muted, weight: 700, upper: true, track: 1.5, name: 'Filter group' }));
    opts.forEach((o, i) => kids.push(group(ctx, {
      name: `Option ${gi + 1}.${i + 1}`, x: 0, y: 0, w: sw, h: 22, pct: 100,
      children: [
        shape(ctx, { x: 0, y: 3, w: 15, h: 15, fill: i === 0 && gi === 0 ? ctx.pal.accent : '#ffffff', border: t.line, radius: 3, name: 'Box' }),
        text(ctx, { text: o, x: 26, y: 1, w: sw - 26, size: 14, color: t.body, lh: 1.4, name: 'Option' }),
      ],
    })));
  });
  let y = 0;
  for (const k of kids) { k.box.desktop.y = y; y += hOf(k) + 12; }
  const side = group(ctx, { name: 'Filters', x: PAD, y: 80, w: sw, h: y, children: kids, flow: { gap: 12, pad: 0 } });
  const gx = PAD + sw + 50;
  const count = text(ctx, { text: '24 treasures on these shelves', x: gx, y: 80, w: CW - sw - 50, size: 14, color: t.muted, name: 'Count' });
  const grid = shelfGrid(ctx, t, { n: 9, cols: 3, tiles: ['#f6efe9', '#eef0ea', '#f3ecf1'], chips: ['Sale', '', '', '', 'Sale', '', 'New', '', ''], stars: true, variant: true, mobile: 2 }, gx, CW - sw - 50, bottom(count) + 20);
  return section([count, side, ...stackLast([grid], 60)], Math.max(bottom(side), bottom(grid)) + 90, t.bg);
}

const spec: TemplateSpec = {
  key: '8e4c9bf9', ref: '8e4c9bf9', name: 'Bramblewick Boutique', industry: 'ecommerce', category: 'Ecommerce',
  description: 'A gentle faerie boutique that opens straight onto its shelves: a soft photo banner, a sifting column and neat rows of wares.',
  palette: { bg: '#ffffff', surface: '#f7f1ec', ink: '#2b2622', body: '#5a524c', muted: '#8f857d', accent: '#c4766a', accentInk: '#ffffff', dark: '#3a3633', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', darkAccent: '#f2cfc6', line: 'rgba(43,38,34,0.12)' },
  fonts: { head: serif2, body: avenir, headWeight: 500, headTrack: 0, btnRadius: 2, btnUpper: true, cardRadius: 4 },
  chrome: { nav: 'thin promo ribbon; wordmark centre, links left, cart right', footer: 'dark grey, four link columns + newsletter + socials' },
  pages: [
    { slug: 'home', title: 'Shop', build: (c) => [
      hero(c, { variant: 'photo-center', photo: '@flowers|garden', h: 340, buttons: 1, overlay: 'rgba(43,38,34,0.38)', headSize: 46 }),
      collection(c),
      centered(c, { tone: 'surface', heading: 'Letters from the bramble', slot: 'newsletter', button: true, size: 30 }),
    ] },
    { slug: 'our-story', title: 'Our story', build: (c) => [
      pageTitle(c, { title: 'How the boutique grew', tone: 'surface', intro: true }),
      imageStory(c, { photo: '@craft|workshop', side: 'left', tone: 'bg', button: false }),
      reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 0), cols: 3 }),
    ] },
    { slug: 'journal', title: 'Journal', build: (c) => [
      pageTitle(c, { title: 'Bramble notes', tone: 'bg' }),
      posts(c, { n: 3, photos: ['@tea|bakery', '@flowers|garden', '@craft|workshop'], tone: 'bg', head: false }),
    ] },
    { slug: 'faq', title: 'Help', build: (c) => [
      pageTitle(c, { title: 'Questions at the counter', tone: 'surface' }),
      faq(c, { n: 6, tone: 'bg', side: false }),
    ] },
  ],
};
export default spec;

// Ref — a soft beige atelier shop: two photo tiles side by side as the hero (each with a capital title and a light
// button), a running line of words, a new-in shelf with prices, a story beside a portrait, category cards, a dark newsletter.
// Kept: two-tile photo hero · thin text strip · four-up product shelf with prices · picture-left story · three plain
// category cards · centred newsletter band.
import { avatarsFor, button, cards, centered, contact, faq, group, image, imageStory, pageTitle, section, shape, splitHeading, team, text, tone, CW, PAD, type Ctx, type Section, type TemplateSpec } from '../kit.ts';

const serif = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const helv = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** Two photo tiles side by side, each a capital title + a light button over a soft shade; one column on a phone. */
function twoTiles(c: Ctx, tiles: Array<{ photo: string; title: string; href: string }>): Section {
  const gap = 16;
  const tw = (CW - gap) / 2;
  const th = 560;
  const items = tiles.map((t, i) =>
    group(c, {
      name: `Tile ${i + 1}`, x: 0, y: 0, w: tw, h: th,
      children: [
        image(c, { key: t.photo, x: 0, y: 0, w: tw, h: th, pct: 100 }),
        shape(c, { x: 0, y: 0, w: tw, h: th, pct: 100, fill: 'linear-gradient(180deg, rgba(40,32,24,0) 40%, rgba(40,32,24,0.55) 100%)', name: 'Shade' }),
        text(c, { text: t.title, x: 32, y: th - 170, w: tw - 64, pct: 80, size: 34, color: '#ffffff', font: 'head', upper: true, track: 3, role: 'h2', name: 'Tile title' }),
        button(c, { text: 'Look inside', href: t.href, x: 32, y: th - 90, w: 180, look: 'light', size: 13 }),
      ],
    }),
  );
  const g = group(c, { name: 'Tiles', x: PAD, y: 30, w: CW, h: th, children: items, layout: { cols: 2, bp: { tablet: 2, mobile: 1 }, gap } });
  return section([g], th + 60, c.pal.bg, 'banner-image-atomic');
}

/** A thin strip of words (the reference's moving line), set still. */
function strip(c: Ctx, words: string): Section {
  const t = tone(c, 'surface');
  const line = text(c, { text: words, x: PAD, y: 18, w: CW, size: 14, color: t.ink, align: 'center', upper: true, track: 3, lh: 1.5, name: 'Strip' });
  return section([line], line.box.desktop.h + 36, t.bg);
}

const NEW = ['@jewelry|light', '@product|mushroom'];

const spec: TemplateSpec = {
  key: '09f8103e',
  ref: '09f8103e',
  name: 'Silkthread Atelier',
  industry: 'ecommerce',
  category: 'Ecommerce',
  description: 'A linen-soft elven atelier: two photo doorways side by side, a whispered line of words, then a shelf of new-spun pieces.',
  palette: { bg: '#f1ede6', surface: '#e2d9c8', ink: '#3b342d', body: '#5c5349', muted: '#82776a', accent: '#756c62', accentInk: '#ffffff', dark: '#3b342d', darkInk: '#f1ede6', darkBody: 'rgba(241,237,230,0.8)', darkAccent: '#e2d9c8', line: 'rgba(59,52,45,0.18)' },
  fonts: { head: serif, body: helv, headWeight: 400, headTrack: 1.5, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'centred serif wordmark, links split either side in small capitals, basket icon right', footer: 'beige, four link columns and a newsletter field' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        twoTiles(c, [
          { photo: '@candle|warm', title: 'Moonlit wear', href: '/shop' },
          { photo: '@fabric|moss', title: 'Hearth & home', href: '/shop' },
        ]),
        strip(c, 'Spun by moonlight  ·  Dyed with meadow roots  ·  Wrapped in leaves  ·  Sent by wing'),
        cards(c, { n: 4, cols: 4, kind: 'photo', tone: 'bg', photos: NEW, head: { heading: 'Fresh from the loom', align: 'center' }, price: true, cardFill: false, imgH: 320, align: 'center' }),
        imageStory(c, { photo: avatarsFor(c.site, 3)[0], side: 'left', tone: 'surface', eyebrow: true, button: true, h: 620 }),
        cards(c, { n: 3, cols: 3, kind: 'plain', tone: 'bg', head: { heading: 'Wander the rooms', align: 'center' }, link: '/shop', align: 'center' }),
        centered(c, { tone: 'dark', slot: 'newsletter', heading: 'Letters by moth-post', button: true, size: 34 }),
      ],
    },
    {
      slug: 'shop',
      title: 'Shop',
      build: (c) => [
        pageTitle(c, { title: 'The atelier shelves', tone: 'surface' }),
        cards(c, { n: 8, cols: 4, kind: 'photo', tone: 'bg', photos: ['@candle|warm', '@fabric|moss', ...NEW], head: false, price: true, cardFill: false, imgH: 300, align: 'center' }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'Threads and the folk who spin them', tone: 'bg' }),
        splitHeading(c, { tone: 'surface', paras: 2, button: false }),
        team(c, { n: 3, avatars: avatarsFor(c.site, 3), tone: 'bg', head: { heading: 'At the looms' }, bio: true }),
      ],
    },
    {
      slug: 'faqs',
      title: 'FAQs',
      build: (c) => [
        pageTitle(c, { title: 'Questions at the loom', tone: 'surface', intro: false }),
        faq(c, { n: 8, tone: 'bg', head: false, side: false }),
        centered(c, { tone: 'surface', heading: 'Still wondering?', button: true, size: 32 }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Call at the atelier' }), splitHeading(c, { tone: 'dark', paras: 1, button: false, heading: 'Fittings by lantern light' })],
    },
  ],
};
export default spec;

// Ref — a bright juice shop: sun-yellow photo hero, a black three-promise band, a bestseller shelf, a teal
// statement band over a ticker strip, a picture-left delivery story, a three-column about row.
// Kept: centred photo hero · black icon band · centred heading + four product cards with prices · coloured
// statement band · thin ticker strip · picture left / words right story · about split.
import { avatarsFor, cards, centered, contact, faq, hero, imageStory, pageTitle, posts, reviews, section, splitHeading, stats, team, text, tone, CW, PAD, type Ctx, type Section, type TemplateSpec } from '../kit.ts';

const sans = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

/** A one-line ticker band (the scrolling offers strip of the reference), set still. */
function ticker(c: Ctx, words: string, t: 'dark' | 'accent' | 'bg' | 'surface'): Section {
  const tn = tone(c, t);
  const line = text(c, { text: words, x: PAD, y: 14, w: CW, size: 13, color: tn.body, align: 'center', lh: 1.5, name: 'Ticker' });
  return section([line], line.box.desktop.h + 28, tn.bg);
}

const BOTTLES = ['@product|candle', '@product|candle#2'];

const spec: TemplateSpec = {
  key: 'f26065d2',
  ref: 'f26065d2',
  name: 'Sunpress Dewery',
  industry: 'ecommerce',
  category: 'Ecommerce',
  description: 'A sunny faerie juice-press market: golden photo hero, a black promise band, a shelf of bestselling bottles.',
  palette: { bg: '#ffffff', surface: '#fff6dc', ink: '#121212', body: '#454545', muted: '#767676', accent: '#12b394', accentInk: '#ffffff', dark: '#0a0a0a', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#ffc21a', line: 'rgba(18,18,18,0.12)' },
  fonts: { head: sans, body: sans, headWeight: 700, headTrack: -0.4, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'thin offer bar on top; logo left, links centre, account + basket icons right, transparent over hero', footer: 'white, three text columns, fine print row' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'photo-center', photo: '@food|bread', h: 560, buttons: 1, overlay: 'rgba(120,70,0,0.32)' }),
        cards(c, { n: 3, cols: 3, kind: 'icon', tone: 'dark', head: false, cardFill: false }),
        cards(c, { n: 4, cols: 4, kind: 'photo', tone: 'bg', photos: BOTTLES, head: { heading: 'Best-loved bottles', intro: true }, price: true, cardFill: false, align: 'center', imgH: 260 }),
        centered(c, { tone: 'accent', size: 46, button: false, slot: 'subhead' }),
        ticker(c, '✦  Bring back an empty bottle for a dewdrop off  ✦  Free wing-post on baskets over fifty acorns  ✦', 'dark'),
        imageStory(c, { photo: '@bakery|warm', side: 'left', tone: 'bg', eyebrow: true, button: true, h: 640 }),
        splitHeading(c, { tone: 'surface', paras: 2, button: false, heading: 'Pressed at sunrise' }),
      ],
    },
    {
      slug: 'shop',
      title: 'Shop',
      build: (c) => [
        pageTitle(c, { title: 'The pressing shelf', tone: 'surface' }),
        cards(c, { n: 8, cols: 4, kind: 'photo', tone: 'bg', photos: BOTTLES, head: false, price: true, cardFill: false, align: 'center', imgH: 240 }),
        reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 4) }),
        faq(c, { n: 5, tone: 'bg' }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'From orchard to bottle', tone: 'accent' }),
        splitHeading(c, { tone: 'bg', paras: 2, button: false }),
        stats(c, { n: 3, tone: 'dark' }),
        team(c, { n: 3, avatars: avatarsFor(c.site, 4), tone: 'bg', head: { heading: 'The pressers', intro: true } }),
        contact(c, { tone: 'surface', heading: 'Find the press' }),
      ],
    },
    {
      slug: 'journal',
      title: 'Journal',
      build: (c) => [
        pageTitle(c, { title: 'Notes from the press', tone: 'surface' }),
        posts(c, { n: 3, photos: ['@bakery|warm', ...BOTTLES], tone: 'bg', head: false }),
        centered(c, { tone: 'dark', slot: 'newsletter', heading: 'A sip of news each moon', button: true }),
      ],
    },
  ],
};
export default spec;

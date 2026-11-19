// Ref — a loud electric-blue, lime and red creator site: heavy serif, pill buttons, scrolling "connect" tickers.
// Kept: split hero on lime · red scrolling ticker · three picture cards on blue + button · portrait story on lime ·
// three offer cards with prices · second ticker · journal cards on blue · red newsletter band.
import {
  avatarsFor, cards, centered, contact, copy, faq, hero, imageStory, pageTitle, posts, reviews, section, stats, team, text, tone,
  type Ctx, type Section, type TemplateSpec, type Tone,
} from '../kit.ts';

const serif = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** A one-line ticker that scrolls across its band. */
function ticker(c: Ctx, tn: Tone, glyph: string, offset = 0): Section {
  const t = tone(c, tn);
  const words = Array.from({ length: 4 }, (_, i) => copy(c, 'offering.title', i + offset).text);
  const line = { ...text(c, { text: `${words.join(`  ${glyph}  `)}  ${glyph}`, x: 0, y: 24, w: 6000, pct: 100, size: 30, color: t.head, font: 'head', role: 'p', lh: 1.2, name: 'Ticker' }), anim: { type: 'marquee', direction: offset % 2 ? 'right' : 'left', durationMs: 24000 } };
  return section([line], line.box.desktop.y + line.box.desktop.h + 24, t.bg);
}

const WORK = ['@bakery|bread', '@candle|warm', '@nature'];

const spec: TemplateSpec = {
  key: 'd200195b',
  ref: 'd200195b',
  name: 'Lilypad Splashers',
  industry: 'actor',
  category: 'Actor',
  description: 'A pond-bright troupe in electric blue, lime and poppy red: scrolling tickers, picture cards and a splashy newsletter band.',
  palette: {
    bg: '#eaff4a',
    surface: '#ffffff',
    ink: '#0b2a6b',
    body: '#1f3b78',
    muted: '#c41e24',
    accent: '#e8262c',
    accentInk: '#ffffff',
    dark: '#0a6fd6',
    darkInk: '#ffffff',
    darkBody: 'rgba(255,255,255,0.9)',
    darkAccent: '#eaff4a',
    line: 'rgba(11,42,107,0.2)',
  },
  fonts: { head: serif, body: sans, headWeight: 800, headTrack: -0.5, btnRadius: 999, cardRadius: 20 },
  chrome: { nav: 'links left, brand centred, outlined pill CTA right', footer: 'red band, brand left, socials right, big sign-off line' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'split', tone: 'bg', photo: '@mushroom|moss', buttons: 2, headSize: 62, imageRadius: 24, h: 680 }),
        ticker(c, 'accent', '✺', 0),
        cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'dark', photos: WORK, cardFill: false, imgH: 300, head: { heading: 'Splashes from the pond' }, button: true }),
        imageStory(c, { photo: avatarsFor(c.site, 0)[0], side: 'left', tone: 'bg', button: true, heading: 'Who makes the ripples' }),
        cards(c, { n: 3, cols: 3, kind: 'icon', tone: 'surface', price: true, head: { heading: 'Order a splash', intro: true } }),
        ticker(c, 'accent', '❂', 1),
        posts(c, { n: 3, photos: [...WORK].reverse(), tone: 'dark', head: { heading: 'Ripples in the journal' } }),
        centered(c, { tone: 'accent', heading: 'Get a lily-letter', slot: 'newsletter', button: true }),
      ],
    },
    {
      slug: 'work',
      title: 'Work',
      build: (c) => [
        pageTitle(c, { title: 'Every splash so far', tone: 'dark' }),
        cards(c, { n: 6, cols: 3, kind: 'photo', tone: 'bg', photos: [...WORK, '@mushroom|moss'], head: false, link: '/contact' }),
        reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 0) }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'A splash of a story', tone: 'bg' }),
        imageStory(c, { photo: avatarsFor(c.site, 0)[1], side: 'right', tone: 'surface', eyebrow: true }),
        stats(c, { n: 4, tone: 'accent' }),
        team(c, { n: 3, avatars: avatarsFor(c.site, 0), tone: 'dark', head: { heading: 'The pond crew' } }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Make a ripple' }), faq(c, { n: 4, tone: 'surface' }), ticker(c, 'dark', '✦', 2)],
    },
  ],
};
export default spec;

// Ref — a pastel party-characters site: pink, blue and butter-yellow bands, rounded type, crowned package cards.
// Kept: split hero with a rounded picture · blue band with one big centred quote · story with picture right ·
// four "why us" icon points on yellow · three package cards · reviews · blue call band.
import {
  W, avatarsFor, cards, contact, ctaBand, faq, hero, imageStory, pageTitle, pricing, reviews, section, stackDown, team, text, tone,
  type Ctx, type Section, type TemplateSpec, type Tone,
} from '../kit.ts';

const round = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

/** One big quote centred on a coloured band, the speaker under it. */
function quoteBand(c: Ctx, tn: Tone): Section {
  const t = tone(c, tn);
  const mark = text(c, { text: '❦', x: 0, y: 0, w: W, size: 40, color: t.head, align: 'center', lh: 1.1, name: 'Mark' });
  const q = text(c, { slot: 'review.quote', index: 0, x: 200, y: 0, w: 800, size: 30, color: t.head, font: 'head', align: 'center', lh: 1.35, name: 'Quote' });
  const a = text(c, { slot: 'review.author', index: 0, x: 300, y: 0, w: 600, size: 15, color: t.body, weight: 600, align: 'center', name: 'Author' });
  const st = stackDown([mark, q, a], 90, [14, 22]);
  return section(st.nodes, st.y + 90, t.bg);
}

const spec: TemplateSpec = {
  key: '9acaf094',
  ref: '9acaf094',
  name: 'Bluebell Revels',
  industry: 'actor',
  category: 'Actor',
  description: 'Party players in sugared pastels: a rounded split hero, a big blue quote, butter-yellow reasons and crowned packages.',
  palette: {
    bg: '#fff7fb',
    surface: '#fff3c4',
    ink: '#2f4d7a',
    body: '#4a5d7e',
    muted: '#c94f84',
    accent: '#3a78c2',
    accentInk: '#ffffff',
    dark: '#2f4d7a',
    darkInk: '#ffffff',
    darkBody: 'rgba(255,255,255,0.86)',
    darkAccent: '#ffd1e3',
    line: 'rgba(47,77,122,0.16)',
  },
  fonts: { head: round, body: round, headWeight: 800, btnRadius: 999, cardRadius: 18 },
  chrome: { nav: 'brand-left with a crown glyph, links centred, pink pill CTA right', footer: 'blue band, wavy top edge, three columns' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'split', tone: 'bg', photo: '@flowers|nature', eyebrow: true, buttons: 2, imageRadius: 28, h: 660 }),
        quoteBand(c, 'accent'),
        imageStory(c, { photo: '@mushroom|moss', side: 'right', tone: 'bg', button: true }),
        cards(c, { n: 4, cols: 4, kind: 'icon', tone: 'surface', cardFill: false, head: { heading: 'Why the revel comes to you' } }),
        pricing(c, { n: 3, tone: 'bg', head: { heading: 'Crowns for every party', intro: true } }),
        reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 5) }),
        ctaBand(c, { tone: 'accent', buttons: 2 }),
      ],
    },
    {
      slug: 'characters',
      title: 'Characters',
      build: (c) => [
        pageTitle(c, { title: 'Meet the party folk', tone: 'surface' }),
        team(c, { n: 6, avatars: avatarsFor(c.site, 5), tone: 'bg', bio: true, ring: '#ffd1e3', head: false }),
        quoteBand(c, 'dark'),
      ],
    },
    {
      slug: 'packages',
      title: 'Packages',
      build: (c) => [
        pageTitle(c, { title: 'Pick a party crown', tone: 'accent' }),
        pricing(c, { n: 3, tone: 'bg', head: false }),
        cards(c, { n: 3, cols: 3, kind: 'numbered', tone: 'surface', head: { heading: 'How the day unfolds' } }),
        faq(c, { n: 5, tone: 'bg', side: false }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', photo: '@flowers|nature', heading: 'Book a bluebell day' })],
    },
  ],
};
export default spec;

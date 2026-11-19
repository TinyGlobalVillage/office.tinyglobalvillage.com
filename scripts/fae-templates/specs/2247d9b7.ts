// Ref 0 — a coaching-style accounting site: cream + deep green + gold, serif heads.
// Layout kept: full-photo hero with centred headline · heading-left/paragraph-right ·
// dark-green story band with a tall portrait · centred programmes intro + three picture cards.
import { avatarsFor, cards, centered, contact, ctaBand, faq, hero, imageStory, pageTitle, pricing, reviews, splitHeading, stats, team, type TemplateSpec } from '../kit.ts';

const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

const spec: TemplateSpec = {
  key: '2247d9b7',
  ref: '2247d9b7',
  name: 'Hearth & Ledger',
  industry: 'accounting',
  category: 'Accounting',
  description: 'A warm one-gnome practice: big misty hero, a personal story on deep green, three programmes.',
  palette: {
    bg: '#f6f1e7',
    surface: '#ece3d2',
    ink: '#1d2a24',
    body: '#45514b',
    muted: '#8a7a5c',
    accent: '#0d3b33',
    accentInk: '#f6f1e7',
    dark: '#0d3b33',
    darkInk: '#f6f1e7',
    darkBody: 'rgba(246,241,231,0.84)',
    darkAccent: '#d6b46a',
    line: 'rgba(29,42,36,0.16)',
  },
  fonts: { head: serif, body: sans, headWeight: 500, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'brand-left, hairline under, links left, phone + socials right', footer: 'centred brand, three columns', note: 'thin-rule nav' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'photo-center', photo: 'p-2b41cdf1', h: 720, buttons: 1, sideNote: true, overlay: 'rgba(8,24,20,0.56)' }),
        splitHeading(c, { tone: 'bg' }),
        imageStory(c, { photo: 'p-e40a56f8', side: 'left', tone: 'dark', inset: false, h: 700 }),
        cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', photos: ['p-3b904265', 'p-17787ae6', 'p-6d951def'], head: { heading: 'Ledger Programmes', intro: true }, link: '/services', cardFill: false, imgH: 280 }),
        reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 3), big: true }),
        ctaBand(c, { tone: 'dark', photo: 'p-72ffc22a' }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'Our story', tone: 'surface' }),
        imageStory(c, { photo: 'p-64fedca1', side: 'right', tone: 'bg', button: true, eyebrow: true }),
        stats(c, { n: 4, tone: 'dark' }),
        team(c, { n: 4, avatars: avatarsFor(c.site), tone: 'bg', bio: true, ring: '#d6b46a', head: { heading: 'The hands at the abacus', intro: true } }),
      ],
    },
    {
      slug: 'services',
      title: 'Services',
      build: (c) => [
        pageTitle(c, { title: 'Programmes', photo: 'p-297607c7' }),
        cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'bg', head: false, price: true }),
        pricing(c, { n: 3, tone: 'surface' }),
        faq(c, { n: 5, tone: 'bg' }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', photo: 'p-d3dd23de' }), centered(c, { tone: 'dark', button: false, headSlot: 'headline', slot: 'newsletter' })],
    },
  ],
};
export default spec;

// Ref — a one-colour burnt-orange troupe site: big black serif headline, small paragraph + outlined button to the
// right, full-bleed toned photo, large paragraphs beside a small photo, an inset closing photo.
// Kept: heading-left / paragraph + outline button-right opener · full-bleed picture · big text with a smaller picture
// beside it · inset wide picture · two big quotes · black call band.
import { avatarsFor, cards, centered, contact, ctaBand, hero, imageStory, pageTitle, photoBand, reviews, splitHeading, team, type TemplateSpec } from '../kit.ts';

const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const spec: TemplateSpec = {
  key: 'bbe73921',
  ref: 'bbe73921',
  name: 'Ashbloom Troupe',
  industry: 'actor',
  category: 'Actor',
  description: 'A troupe drenched in ember orange: a bold serif opener, a full-bleed misty glade, then quiet pictures between big words.',
  palette: {
    bg: '#f26a2a',
    surface: '#f4824a',
    ink: '#111111',
    body: '#1e1410',
    muted: '#3a2418',
    accent: '#111111',
    accentInk: '#f26a2a',
    dark: '#111111',
    darkInk: '#f6905d',
    darkBody: 'rgba(255,236,224,0.85)',
    line: 'rgba(17,17,17,0.35)',
  },
  fonts: { head: serif, body: sans, headWeight: 400, headTrack: -1, btnRadius: 999, cardRadius: 0 },
  chrome: { nav: 'brand-left in serif, links right, outlined pill CTA', footer: 'orange, big serif sign-off left, link columns right' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'plain-center', tone: 'bg', headSize: 72, buttons: 1, h: 600 }),
        photoBand(c, { photo: '@mist|forest', tone: 'bg', h: 600, inset: false }),
        splitHeading(c, { tone: 'bg', paras: 2, heading: 'Embers, not footlights' }),
        imageStory(c, { photo: '@candle|light', side: 'right', tone: 'bg', button: true }),
        photoBand(c, { photo: '@mushroom|moss', tone: 'bg', h: 520 }),
        reviews(c, { n: 2, cols: 2, tone: 'surface', big: true, head: false }),
        ctaBand(c, { tone: 'dark' }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'Who keeps the embers', tone: 'bg', align: 'left' }),
        imageStory(c, { photo: avatarsFor(c.site, 2)[0], side: 'left', tone: 'surface', eyebrow: true }),
        team(c, { n: 4, avatars: avatarsFor(c.site, 2), tone: 'bg', head: { heading: 'The ash-and-bloom folk' } }),
      ],
    },
    {
      slug: 'shows',
      title: 'Shows',
      build: (c) => [
        pageTitle(c, { title: 'What we kindle', tone: 'dark' }),
        cards(c, { n: 4, cols: 2, kind: 'numbered', tone: 'bg', cardFill: false, head: false, link: '/contact' }),
        centered(c, { tone: 'surface', heading: 'Ask for a private glade', button: true }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', photo: '@candle|light', heading: 'Fan the embers' })],
    },
  ],
};
export default spec;

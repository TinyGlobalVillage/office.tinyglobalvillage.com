// Ref — an all-black solo-actor site: condensed white capitals, a full-bleed picture hero, film/TV rows, a short bio.
// Kept: full-photo hero · statement left / paragraph right · alternating picture rows (screen, stage) ·
// portrait story · dark call band.
import { avatarsFor, cards, contact, ctaBand, hero, imageStory, pageTitle, reviews, splitHeading, stats, zigzag, type TemplateSpec } from '../kit.ts';

const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const spec: TemplateSpec = {
  key: '8b6b45ce',
  ref: '8b6b45ce',
  name: 'Duskmoth Players',
  industry: 'actor',
  category: 'Actor',
  description: 'A player of the night glades in stark black: a misty full-bleed hero, then glade and lantern-stage rows and a drawn portrait.',
  palette: {
    bg: '#0b0b0b',
    surface: '#161616',
    ink: '#f2f2f2',
    body: 'rgba(242,242,242,0.78)',
    muted: '#9a9a9a',
    accent: '#f2f2f2',
    accentInk: '#0b0b0b',
    dark: '#000000',
    darkInk: '#ffffff',
    darkBody: 'rgba(255,255,255,0.78)',
    line: 'rgba(255,255,255,0.16)',
  },
  fonts: { head: sans, body: sans, headWeight: 700, headTrack: 0.5, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'brand-left in capitals, links right, no CTA, black bar', footer: 'one black row: brand, socials, small print' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'photo-left', photo: '@mist|forest', h: 760, buttons: 1, overlay: 'rgba(0,0,0,0.5)' }),
        splitHeading(c, { tone: 'bg', heading: 'Glade and lantern-stage' }),
        zigzag(c, { tone: 'bg', rows: [{ photo: '@candle|light', pill: true }, { photo: '@mist|forest#2', pill: true }] }),
        imageStory(c, { photo: avatarsFor(c.site, 1)[0], side: 'right', tone: 'dark', heading: 'The face behind the masque', button: true }),
        ctaBand(c, { tone: 'dark', buttons: 2 }),
      ],
    },
    {
      slug: 'reel',
      title: 'Reel',
      build: (c) => [
        pageTitle(c, { title: 'Glade and lantern-stage', tone: 'bg', align: 'left' }),
        cards(c, { n: 4, cols: 2, kind: 'photo', tone: 'bg', photos: ['@candle|light', '@mist|forest', '@mist|forest#2'], head: false, cardFill: false, imgH: 320 }),
        reviews(c, { n: 3, tone: 'surface', head: { heading: 'From the moss-seats' } }),
      ],
    },
    {
      slug: 'biography',
      title: 'Biography',
      build: (c) => [
        pageTitle(c, { title: 'A life in the glades', tone: 'surface' }),
        imageStory(c, { photo: avatarsFor(c.site, 1)[0], side: 'left', tone: 'bg', eyebrow: true }),
        stats(c, { n: 4, tone: 'dark' }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', photo: '@candle|light', heading: 'Send a moth' })],
    },
  ],
};
export default spec;

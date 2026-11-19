// Ref — a near-black freelance-designer portfolio in plain Helvetica: big opening line, label/paragraph intro row,
// a two-column grid of selected works with captions, a short about with button, a two-column services list,
// experience rows.
// Kept: big plain opener · label-left / paragraph-right intro · two-column captioned work grid · centred about + button ·
// two-column numbered services · experience rows · split call band.
import { avatarsFor, cards, centered, contact, ctaBand, hero, imageStory, logos, pageTitle, reviews, splitHeading, stats, type TemplateSpec } from '../kit.ts';

const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const WORKS = ['@mist|forest', '@library|books', '@candle|warm', '@moss|mushroom'];

const spec: TemplateSpec = {
  key: 'd630f74c',
  ref: 'd630f74c',
  name: 'Glimmerpane Workshop',
  industry: 'agency',
  category: 'Agency',
  description: 'A lone glass-rune maker\'s dark portfolio: one plain bold line, then a quiet two-column wall of chosen works and lists.',
  palette: {
    bg: '#111111',
    surface: '#1b1b1b',
    ink: '#f5f5f5',
    body: 'rgba(245,245,245,0.74)',
    muted: '#8c8c8c',
    accent: '#f5f5f5',
    accentInk: '#111111',
    dark: '#000000',
    darkInk: '#f5f5f5',
    darkBody: 'rgba(245,245,245,0.74)',
    line: 'rgba(255,255,255,0.14)',
  },
  fonts: { head: sans, body: sans, headWeight: 500, headTrack: -1.5, btnRadius: 999, cardRadius: 6 },
  chrome: { nav: 'small brand-left, three links right, no button', footer: 'one dark row: email left, socials right, hairline above' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'plain-center', tone: 'bg', headSize: 78, buttons: 1, h: 620 }),
        splitHeading(c, { tone: 'bg', headSlot: 'eyebrow', button: false }),
        cards(c, { n: 6, cols: 2, kind: 'photo', tone: 'bg', photos: WORKS, cardFill: false, imgH: 360, bodySlot: 'caption', head: { heading: 'Chosen panes', align: 'left' } }),
        centered(c, { tone: 'surface', heading: 'A rune-maker who works alone', slot: 'about', button: true }),
        cards(c, { n: 6, cols: 2, kind: 'numbered', tone: 'bg', cardFill: false, head: { heading: 'What the workshop makes', align: 'left' } }),
        cards(c, { n: 4, cols: 1, kind: 'plain', tone: 'bg', titleSlot: 'person.role', bodySlot: 'event.date', head: { heading: 'Halls I have served', align: 'left' } }),
        ctaBand(c, { tone: 'dark', split: true }),
      ],
    },
    {
      slug: 'work',
      title: 'Work',
      build: (c) => [
        pageTitle(c, { title: 'Every pane so far', tone: 'bg', align: 'left' }),
        cards(c, { n: 4, cols: 2, kind: 'photo', tone: 'bg', photos: [...WORKS].reverse(), cardFill: false, imgH: 420, bodySlot: 'caption', head: false }),
        reviews(c, { n: 2, cols: 2, tone: 'surface', head: false }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'The one behind the glass', tone: 'surface' }),
        imageStory(c, { photo: avatarsFor(c.site, 4)[0], side: 'left', tone: 'bg', button: true }),
        stats(c, { n: 3, tone: 'dark' }),
        logos(c, { n: 5, tone: 'bg', label: 'Workshops and halls I have glazed for', seeds: ['glass', 'lantern', 'reed', 'quill', 'hearth'] }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Tap on the glass' })],
    },
  ],
};
export default spec;

// Ref — a cheerful children's art school: a pink split hero, a mint strip of words, picture/words class rows,
// a row of teachers, a navy contact block with yellow headings.
// Kept: split hero on a pastel band · centred colour strip · alternating picture rows with points · team circles ·
// dark contact band.
import { avatarsFor, cards, centered, contact, faq, hero, pageTitle, pricing, reviews, splitHeading, stats, team, zigzag, type Ctx, type Section, type TemplateSpec } from '../kit.ts';

const avenir = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

/** A centred interlude painted mint (a fifth colour the palette has no slot for). */
function mint(c: Ctx, heading: string): Section {
  const s = centered(c, { tone: 'bg', heading, size: 36 });
  s.layersFrame.background = '#c8f1e3';
  return s;
}

const spec: TemplateSpec = {
  key: '9aa93d1b',
  ref: '9aa93d1b',
  name: 'Puddlebrush Academy',
  industry: 'education',
  category: 'Education',
  description: 'A rainbow-bright pixie art school: a pink split welcome, a mint ribbon, then class rows that hop side to side.',
  palette: { bg: '#ffffff', surface: '#fde3e6', ink: '#0c2272', body: '#33407a', muted: '#5d6896', accent: '#1d3fb8', accentInk: '#ffffff', dark: '#0c2272', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.84)', darkAccent: '#ffd400', line: 'rgba(12,34,114,0.14)' },
  fonts: { head: avenir, body: avenir, headWeight: 600, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'logo left, links right, yellow "book a class" button', footer: 'navy, logo + three columns + social glyphs' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'split', tone: 'surface', photo: '@art|craft', h: 620, eyebrow: true, buttons: 2 }),
        mint(c, 'Every puddle is a palette'),
        zigzag(c, {
          rows: [{ photo: '@craft|mushroom', bullets: 3 }, { photo: '@studio|light', bullets: 3, pill: true }],
          tone: 'bg',
          head: { heading: 'Classes for little wings', intro: true },
        }),
        team(c, { n: 4, avatars: avatarsFor(c.site, 0), tone: 'surface', head: { heading: 'Our brush-keepers' } }),
        contact(c, { tone: 'dark', heading: 'Come paint with us' }),
      ],
    },
    {
      slug: 'classes',
      title: 'Classes',
      build: (c) => [
        pageTitle(c, { title: 'Classes & camps', tone: 'surface' }),
        cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'bg', head: false }),
        pricing(c, { n: 3, tone: 'surface', head: { heading: 'Term tickets', intro: true } }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'Why we paint', tone: 'bg' }),
        splitHeading(c, { tone: 'surface', paras: 2 }),
        stats(c, { n: 3, tone: 'dark' }),
        reviews(c, { n: 3, tone: 'bg', avatars: avatarsFor(c.site, 2) }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'surface', heading: 'Say hello to the studio' }), faq(c, { n: 5, tone: 'bg' })],
    },
  ],
};
export default spec;

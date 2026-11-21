// Ref — a woodworking studio: one full-bleed workbench photo, the words low on the left, an outlined button.
// Kept: full-photo hero with left text + one button (the reference shows only its hero; the rest is a sober
// studio follow-through) · heading-left/paragraph-right · icon services · a dark picture row · numbers · split CTA.
import { avatarsFor, cards, contact, ctaBand, hero, pageTitle, reviews, splitHeading, stats, team, zigzag, type TemplateSpec } from '../kit.ts';

const avenir = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

const spec: TemplateSpec = {
  key: '44da55d8',
  ref: '44da55d8',
  name: 'Shaving & Spire',
  industry: 'architecture',
  category: 'Architecture',
  description: 'An elven hall-wright’s timber studio: one big workbench photo, the words low and left, then quiet craft.',
  palette: {
    bg: '#f5efe6',
    surface: '#ebe0d0',
    ink: '#2a1d14',
    body: '#56463a',
    muted: '#8b7563',
    accent: '#8a5a33',
    accentInk: '#ffffff',
    dark: '#2a1d14',
    darkInk: '#f5efe6',
    darkBody: 'rgba(245,239,230,0.82)',
    darkAccent: '#d9a86c',
    line: 'rgba(42,29,20,0.14)',
  },
  fonts: { head: avenir, body: avenir, headWeight: 500, headTrack: -0.4, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'brand-left, socials right, transparent over the hero photo', footer: 'dark wood, brand + address + socials in one row' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'photo-left', photo: '@workshop|craft', h: 720, buttons: 1, overlay: 'rgba(24,14,6,0.46)' }),
        splitHeading(c, { tone: 'bg' }),
        cards(c, { n: 3, cols: 3, kind: 'icon', tone: 'surface', head: { eyebrow: true, heading: 'What we raise from the timber', intro: true } }),
        zigzag(c, { rows: [{ photo: '@architecture|interior', bullets: 3 }], tone: 'dark' }),
        stats(c, { n: 4, tone: 'bg' }),
        ctaBand(c, { tone: 'accent', split: true }),
      ],
    },
    {
      slug: 'projects',
      title: 'Projects',
      build: (c) => [
        pageTitle(c, { title: 'Halls we have raised', photo: '@forest|moss', align: 'left' }),
        cards(c, { n: 6, cols: 3, kind: 'numbered', tone: 'bg', head: false }),
        reviews(c, { n: 2, cols: 2, tone: 'surface', big: true }),
      ],
    },
    {
      slug: 'studio',
      title: 'Studio',
      build: (c) => [
        pageTitle(c, { title: 'The studio', tone: 'surface', align: 'left' }),
        splitHeading(c, { tone: 'bg', paras: 2, button: false }),
        team(c, { n: 3, avatars: avatarsFor(c.site, 4), tone: 'surface', bio: true, head: { heading: 'Hands at the bench' } }),
        stats(c, { n: 3, tone: 'dark' }),
      ],
    },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', photo: '@garden|nature', heading: 'Visit the bench' })] },
  ],
};
export default spec;

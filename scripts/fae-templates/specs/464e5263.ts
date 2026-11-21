// Ref 2 — warm tan photo hero with the words on the left and an orange button; a three-item strip;
// a split picture with a list; three service picture cards; the team in circles. Serif heads.
import { avatarsFor, cards, contact, ctaBand, hero, pageTitle, reviews, stats, team, zigzag, type TemplateSpec } from '../kit.ts';
const serif = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const spec: TemplateSpec = {
  key: '464e5263', ref: '464e5263', name: 'Burrow & Hearth', industry: 'accounting', category: 'Accounting',
  description: 'A family gnome tally-house in tan and ember orange: photo hero, service cards, the whole family at the abacus.',
  palette: { bg: '#fbf7f1', surface: '#f1e6d6', ink: '#2b211a', body: '#5a4c40', muted: '#8f7c69', accent: '#d9692b', accentInk: '#ffffff', dark: '#3a2a1f', darkInk: '#fbf7f1', darkBody: 'rgba(251,247,241,0.8)', darkAccent: '#f0a868', line: 'rgba(43,33,26,0.14)' },
  fonts: { head: serif, body: sans, headWeight: 600, btnRadius: 6, cardRadius: 8 },
  chrome: { nav: 'brand-left, links right, orange CTA', footer: 'four columns on dark brown' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: 'p-d68edc63', h: 680, buttons: 2, overlay: 'rgba(43,25,12,0.5)' }),
      stats(c, { n: 3, tone: 'surface', boxed: false }),
      zigzag(c, { rows: [{ photo: 'p-55a4d011', bullets: 4 }], tone: 'bg' }),
      cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'surface', photos: ['p-0d929805', 'p-cf46e6be', 'p-791a8a1a'], head: { eyebrow: true, heading: 'What we tally', intro: true }, link: '/services' }),
      team(c, { n: 4, avatars: avatarsFor(c.site, 1), tone: 'bg', head: { heading: 'The family at the abacus', intro: true } }),
      ctaBand(c, { tone: 'accent' }),
    ] },
    { slug: 'services', title: 'Services', build: (c) => [
      pageTitle(c, { title: 'Services', photo: 'p-54b73726' }),
      zigzag(c, { rows: [{ photo: 'p-5a01c18f', bullets: 3 }, { photo: 'p-9577aa79', bullets: 3 }, { photo: 'p-d4c1f73b', bullets: 3 }], tone: 'bg' }),
      reviews(c, { n: 3, tone: 'surface' }),
    ] },
    { slug: 'team', title: 'Our family', build: (c) => [
      pageTitle(c, { title: 'Our family', tone: 'surface' }),
      team(c, { n: 4, avatars: avatarsFor(c.site, 1), tone: 'bg', bio: true, head: false }),
      ctaBand(c, { tone: 'dark', split: true }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', photo: 'p-2b421510' })] },
  ],
};
export default spec;

// Ref 9 — red and white: photo hero with the words in a red block; "we make the complex simple" in
// three columns; four service picture cards; a red band with a list and a photo; trust + checklist.
import { cards, centered, contact, ctaBand, hero, pageTitle, splitHeading, zigzag, team, avatarsFor, type TemplateSpec } from '../kit.ts';
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const spec: TemplateSpec = {
  key: '2ba95296', ref: '2ba95296', name: 'Redcap Ledger', industry: 'accounting', category: 'Accounting',
  description: 'A bold gnome abacus office in redcap red: photo hero, three plain promises, four services, a red band.',
  palette: { bg: '#ffffff', surface: '#f6f4f2', ink: '#1a1a1a', body: '#4d4d4d', muted: '#7a7a7a', accent: '#c8102e', accentInk: '#ffffff', dark: '#1a1a1a', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#ff6b7f', line: 'rgba(26,26,26,0.12)' },
  fonts: { head: sans, body: sans, headWeight: 700, headTrack: -0.5, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'brand-left, links right, red CTA block', footer: 'dark, logo + columns + red rule' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: 'p-d3dd23de', h: 680, buttons: 1, overlay: 'rgba(120,8,24,0.55)' }),
      cards(c, { n: 3, cols: 3, kind: 'plain', tone: 'bg', cardFill: false, head: { heading: 'We make the knotty simple', align: 'left' } }),
      cards(c, { n: 4, cols: 4, kind: 'photo', tone: 'surface', photos: ['p-d4c1f73b', 'p-2b421510', 'p-cf46e6be', 'p-5a01c18f'], head: false, link: '/services', imgH: 200 }),
      zigzag(c, { rows: [{ photo: 'p-eba4cd6a', bullets: 5 }], tone: 'accent' }),
      zigzag(c, { rows: [{ photo: 'p-73228230', bullets: 4 }], tone: 'bg', startRight: true }),
      ctaBand(c, { tone: 'dark', split: true }),
    ] },
    { slug: 'services', title: 'Services', build: (c) => [pageTitle(c, { title: 'Services', tone: 'surface', align: 'left' }), cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'bg', head: false, align: 'left', link: '/contact' }), centered(c, { tone: 'accent', button: true })] },
    { slug: 'about', title: 'About', build: (c) => [pageTitle(c, { title: 'About us', photo: 'p-297607c7', align: 'left' }), splitHeading(c, { tone: 'bg', paras: 2 }), team(c, { n: 4, avatars: avatarsFor(c.site, 2), tone: 'surface', head: false })] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', photo: 'p-0d929805' })] },
  ],
};
export default spec;

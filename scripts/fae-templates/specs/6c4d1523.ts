// Ref 3 — slate blue + deep navy: hero with words left and a card on the right; a text band; two columns;
// numbers beside a list; a photo band asking you in for free help.
import { artBand, centered, contact, ctaBand, faq, hero, listPanel, pageTitle, splitHeading, stats, cards, type TemplateSpec } from '../kit.ts';
const sans = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";
const spec: TemplateSpec = {
  key: '6c4d1523', ref: '6c4d1523', name: 'Slate Tally', industry: 'accounting', category: 'Accounting',
  description: 'A sober gnome ledgerworks in slate and navy: hero with a tally card, numbers, a free-help band.',
  palette: { bg: '#f4f6f9', surface: '#e3e9f1', ink: '#16212e', body: '#46546a', muted: '#6b7a90', accent: '#3d6a9e', accentInk: '#ffffff', dark: '#1b2a3b', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', darkAccent: '#9cc2ec', line: 'rgba(22,33,46,0.12)' },
  fonts: { head: sans, body: sans, headWeight: 700, btnRadius: 4, cardRadius: 6 },
  chrome: { nav: 'brand-left, links right, outlined CTA, on navy', footer: 'navy, three columns + fine print' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'split-art', tone: 'dark', h: 640, buttons: 1, art: listPanel({ card: '#ffffff', ink: '#16212e', muted: '#6b7a90', accent: '#3d6a9e', line: '#e3e9f1', radius: 10 }) }),
      centered(c, { tone: 'bg', eyebrow: true }),
      splitHeading(c, { tone: 'surface', paras: 2 }),
      stats(c, { n: 4, tone: 'bg', boxed: true, head: { heading: 'The ledger, in numbers' } }),
      ctaBand(c, { tone: 'dark', photo: 'p-0c59506e', buttons: 2 }),
    ] },
    { slug: 'services', title: 'Services', build: (c) => [
      pageTitle(c, { title: 'How we help', tone: 'dark' }),
      cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'bg', head: false, align: 'left' }),
      artBand(c, { tone: 'surface', art: listPanel({ card: '#ffffff', ink: '#16212e', muted: '#6b7a90', accent: '#3d6a9e', line: '#e3e9f1', radius: 10 }), w: 720, h: 380 }),
      faq(c, { n: 5, tone: 'bg' }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg' })] },
  ],
};
export default spec;

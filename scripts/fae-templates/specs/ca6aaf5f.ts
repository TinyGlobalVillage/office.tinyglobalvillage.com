// Ref 4 — mint on dark slate: photo hero; two promise cards; a centred intro; three alternating
// picture/text rows; a dark closing band.
import { cards, centered, contact, ctaBand, hero, pageTitle, pricing, reviews, zigzag, type TemplateSpec } from '../kit.ts';
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const spec: TemplateSpec = {
  key: 'ca6aaf5f', ref: 'ca6aaf5f', name: 'Mintleaf', industry: 'accounting', category: 'Accounting',
  description: 'An elven abacus office in mint and slate: photo hero, two promises, three alternating rows.',
  palette: { bg: '#ffffff', surface: '#eefaf4', ink: '#17232b', body: '#4b5a63', muted: '#71828c', accent: '#1fbf7a', accentInk: '#ffffff', dark: '#1e2a32', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', darkAccent: '#5ee6a8', line: 'rgba(23,35,43,0.1)' },
  fonts: { head: sans, body: sans, headWeight: 800, headTrack: -0.8, btnRadius: 10, cardRadius: 14 },
  chrome: { nav: 'brand-left, links centre, mint CTA, transparent over hero', footer: 'dark slate, newsletter row + links' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: 'p-72ffc22a', h: 660, buttons: 2, overlay: 'rgba(14,26,32,0.55)' }),
      cards(c, { n: 2, cols: 2, kind: 'icon', tone: 'surface', head: false, titleSlot: 'headline', bodySlot: 'mission', align: 'left' }),
      centered(c, { tone: 'bg', eyebrow: true, slot: 'about' }),
      zigzag(c, { rows: [{ photo: 'p-73228230', pill: true }, { photo: 'p-0c59506e', pill: true }, { photo: 'p-eba4cd6a', pill: true }], tone: 'bg' }),
      ctaBand(c, { tone: 'dark', buttons: 2 }),
    ] },
    { slug: 'pricing', title: 'Pricing', build: (c) => [pageTitle(c, { title: 'Pricing', tone: 'surface' }), pricing(c, { n: 3, tone: 'bg', head: false }), reviews(c, { n: 3, tone: 'surface' })] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', photo: 'p-791a8a1a' })] },
  ],
};
export default spec;

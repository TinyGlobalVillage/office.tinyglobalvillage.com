// Ref 6 — white and orange: centred hero with floating number cards; three features; a feature showcase.
import { cards, chartPanel, ctaBand, hero, pricing, reviews, stats, zigzag, pageTitle, contact, faq, type TemplateSpec } from '../kit.ts';
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const spec: TemplateSpec = {
  key: 'a42e2507', ref: 'a42e2507', name: 'Ember Count', industry: 'accounting', category: 'Accounting',
  description: 'A bright elven ledgerworks in white and ember: centred hero, number cards, a feature showcase.',
  palette: { bg: '#ffffff', surface: '#fff4ee', ink: '#1a1410', body: '#5b524c', muted: '#8c827a', accent: '#ff6a3d', accentInk: '#ffffff', dark: '#1a1410', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', darkAccent: '#ffb199', line: 'rgba(26,20,16,0.1)' },
  fonts: { head: sans, body: sans, headWeight: 800, headTrack: -1, btnRadius: 12, cardRadius: 20 },
  chrome: { nav: 'brand-left, links centre, orange CTA', footer: 'light, four columns + bottom bar' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'plain-center', tone: 'surface', eyebrow: true, buttons: 2, h: 600, headSize: 64 }),
      stats(c, { n: 3, tone: 'surface', boxed: true }),
      cards(c, { n: 3, cols: 3, kind: 'icon', tone: 'bg', head: { eyebrow: true, heading: 'Why folk choose us' } }),
      zigzag(c, { rows: [{ art: chartPanel({ card: '#ffffff', ink: '#1a1410', muted: '#8c827a', bar: '#ff6a3d', bar2: '#ffd9cb', line: '#f1e7e1' }), bullets: 3, pill: true }, { photo: 'p-9577aa79', bullets: 3, pill: true }], tone: 'bg' }),
      reviews(c, { n: 3, tone: 'surface' }),
      pricing(c, { n: 3, tone: 'bg' }),
      ctaBand(c, { tone: 'accent' }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [pageTitle(c, { title: 'About us', tone: 'surface' }), zigzag(c, { rows: [{ photo: 'p-54b73726' }, { photo: 'p-3892bcd6' }], tone: 'bg' }), faq(c, { n: 5, tone: 'surface' })] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg' })] },
  ],
};
export default spec;

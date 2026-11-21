// Ref 7 — white with lilac and lime: split hero with a bar-chart card; a wordmark row; three features;
// a list card beside its words.
import { cards, chartPanel, ctaBand, faq, hero, listPanel, logos, zigzag, pageTitle, pricing, contact, avatarsFor, type TemplateSpec } from '../kit.ts';
const grot = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";
const spec: TemplateSpec = {
  key: 'b77fea78', ref: 'b77fea78', name: 'Dewdrop Ledger', industry: 'accounting', category: 'Accounting',
  description: 'A faerie abacus office in lilac and lime: split hero with a chart card, wordmarks, a tally card.',
  palette: { bg: '#ffffff', surface: '#f3f0fd', ink: '#1c1730', body: '#555070', muted: '#857f9e', accent: '#7c5cf0', accentInk: '#ffffff', dark: '#1c1730', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', darkAccent: '#d4f36b', line: 'rgba(28,23,48,0.1)' },
  fonts: { head: grot, body: grot, headWeight: 700, headTrack: -0.8, btnRadius: 999, cardRadius: 22 },
  chrome: { nav: 'brand-left, links centre, lilac pill CTA', footer: 'lilac panel, newsletter + columns' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'split-art', tone: 'surface', eyebrow: true, buttons: 2, h: 660, art: chartPanel({ card: '#ffffff', ink: '#1c1730', muted: '#857f9e', bar: '#7c5cf0', bar2: '#d4f36b', line: '#ebe7fb', radius: 24 }) }),
      logos(c, { tone: 'bg', seeds: ['dew-a', 'dew-b', 'dew-c', 'dew-d', 'dew-e'] }),
      cards(c, { n: 3, cols: 3, kind: 'icon', tone: 'bg', head: { eyebrow: true, heading: 'Light as a wing, tidy as a ledger', intro: true }, align: 'left' }),
      zigzag(c, { rows: [{ art: listPanel({ card: '#ffffff', ink: '#1c1730', muted: '#857f9e', accent: '#7c5cf0', line: '#ebe7fb', radius: 22, avatars: avatarsFor(c.site) }), bullets: 3 }], tone: 'surface', startRight: true }),
      faq(c, { n: 5, tone: 'bg' }),
      ctaBand(c, { tone: 'dark', split: true }),
    ] },
    { slug: 'pricing', title: 'Pricing', build: (c) => [pageTitle(c, { title: 'Pricing', tone: 'surface' }), pricing(c, { n: 3, tone: 'bg', head: false })] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', photo: 'p-3b904265' })] },
  ],
};
export default spec;

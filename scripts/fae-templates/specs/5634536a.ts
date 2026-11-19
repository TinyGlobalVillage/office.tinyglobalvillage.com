// Ref 5 — all black with a violet glow: a big centred hero, a row of wordmarks, a dark feature grid.
import { cards, ctaBand, faq, hero, logos, pageTitle, stats, contact, zigzag, chartPanel, type TemplateSpec } from '../kit.ts';
const grot = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";
const spec: TemplateSpec = {
  key: '5634536a', ref: '5634536a', name: 'Night Ledger', industry: 'accounting', category: 'Accounting',
  description: 'A gnome tally-house after dark: black and violet, a big centred hero, a grid of what they do.',
  palette: { bg: '#0b0b10', surface: '#14141c', ink: '#f4f2ff', body: 'rgba(244,242,255,0.72)', muted: 'rgba(244,242,255,0.5)', accent: '#8b5cf6', accentInk: '#ffffff', dark: '#0b0b10', darkInk: '#f4f2ff', darkBody: 'rgba(244,242,255,0.72)', darkAccent: '#c4b5fd', line: 'rgba(255,255,255,0.1)' },
  fonts: { head: grot, body: grot, headWeight: 700, headTrack: -1, btnRadius: 999, cardRadius: 18 },
  chrome: { nav: 'brand-left, links centre, pill CTA, on black', footer: 'black, wordmark left, link columns' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'plain-center', tone: 'bg', eyebrow: true, buttons: 2, h: 640, headSize: 68 }),
      logos(c, { tone: 'bg', seeds: ['night-a', 'night-b', 'night-c', 'night-d', 'night-e'] }),
      cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'bg', head: { eyebrow: true, heading: 'Everything the hoard needs', intro: true }, align: 'left' }),
      zigzag(c, { rows: [{ art: chartPanel({ card: '#14141c', ink: '#f4f2ff', muted: 'rgba(244,242,255,0.5)', bar: '#8b5cf6', bar2: '#2e2a45', line: 'rgba(255,255,255,0.1)', dark: true }), bullets: 3 }], tone: 'surface' }),
      stats(c, { n: 4, tone: 'bg' }),
      faq(c, { n: 5, tone: 'surface' }),
      ctaBand(c, { tone: 'accent', buttons: 2 }),
    ] },
    { slug: 'features', title: 'Features', build: (c) => [pageTitle(c, { title: 'Features', tone: 'bg' }), cards(c, { n: 9, cols: 3, kind: 'numbered', tone: 'bg', head: false })] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', photo: 'p-6d951def' })] },
  ],
};
export default spec;

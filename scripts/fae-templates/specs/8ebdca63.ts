// Ref 8 — soft lilac: centred hero over a dashboard card; wordmarks; alternating feature rows with charts.
// The cast rolled an egalitarian collective (elf + faerie + gnome, equal founders) — the team block shows them as equals.
import { artBand, avatarsFor, cards, chartPanel, ctaBand, hero, listPanel, logos, team, zigzag, pageTitle, contact, reviews, type TemplateSpec } from '../kit.ts';
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const look = { card: '#ffffff', ink: '#211a3a', muted: '#7d7699', bar: '#6d4aff', bar2: '#d9d0ff', line: '#ece8fb', radius: 20 };
const spec: TemplateSpec = {
  key: '8ebdca63', ref: '8ebdca63', name: 'Three Roots', industry: 'accounting', category: 'Accounting',
  description: 'A guild of equals — elf, faerie and gnome — keeping one ledger: lilac hero over a dashboard card.',
  palette: { bg: '#f6f3ff', surface: '#ebe5ff', ink: '#211a3a', body: '#56507a', muted: '#7d7699', accent: '#6d4aff', accentInk: '#ffffff', dark: '#211a3a', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', darkAccent: '#c9bbff', line: 'rgba(33,26,58,0.1)' },
  fonts: { head: sans, body: sans, headWeight: 800, headTrack: -1, btnRadius: 12, cardRadius: 20 },
  chrome: { nav: 'brand-left, links centre, two buttons right', footer: 'light, columns, wordmark' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'plain-center', tone: 'bg', eyebrow: true, buttons: 2, h: 560, headSize: 62 }),
      artBand(c, { tone: 'bg', art: chartPanel(look), w: 920, h: 460 }),
      logos(c, { tone: 'bg', seeds: ['root-a', 'root-b', 'root-c', 'root-d', 'root-e'] }),
      zigzag(c, { rows: [{ art: listPanel({ ...look, accent: '#6d4aff' }), bullets: 3, pill: true }, { art: chartPanel({ ...look, bar: '#22b07d', bar2: '#cdeedd' }), bullets: 3, pill: true }], tone: 'surface' }),
      team(c, { n: 3, avatars: avatarsFor(c.site), tone: 'bg', bio: true, head: { heading: 'Three founders, one ledger', intro: true } }),
      ctaBand(c, { tone: 'accent', buttons: 2 }),
    ] },
    { slug: 'features', title: 'Features', build: (c) => [pageTitle(c, { title: 'What the guild keeps', tone: 'surface' }), cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'bg', head: false, align: 'left' }), reviews(c, { n: 3, tone: 'surface' })] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', photo: 'p-55a4d011' })] },
  ],
};
export default spec;

// Ref — a single-home showcase: photo hero with white words on the left, a price line, a pale yellow "visit" button.
// Kept: photo hero (left words + price eyebrow + one pale button) · a picture gallery grid · the home's numbers ·
// an info split · a closing contact.
import { cards, contact, faq, hero, pageTitle, photoBand, splitHeading, stats, type TemplateSpec } from '../kit.ts';

const serif = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const sans = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

const spec: TemplateSpec = {
  key: '572da249', ref: '572da249', name: 'Mossgable Hall', industry: 'architecture', category: 'Architecture',
  description: 'One elven hall laid out for visitors: a big photo hero with its price, a gallery wall, the hall in numbers.',
  palette: { bg: '#ffffff', surface: '#f5f3ec', ink: '#1f2326', body: '#4c5257', muted: '#848a8f', accent: '#f3e9a5', accentInk: '#1f2326', dark: '#1f2a2e', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#f3e9a5', line: 'rgba(31,35,38,0.12)' },
  fonts: { head: serif, body: sans, headWeight: 500, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'transparent over the hero: name left, five links right (home · gallery · info · tour · contact)', footer: 'dark slim band: agent, phone, email' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: '@architecture|interior|forest', h: 760, eyebrow: 'Glade-side hall · four hearths · 1,200 acorns', buttons: 1, overlay: 'rgba(12,16,18,0.46)' }),
      cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', photos: ['@interior|study|library', '@garden|moss|nature', '@forest|mist|nature'], head: { heading: 'Walk through the hall', align: 'left' }, cardFill: false, imgH: 300 }),
      stats(c, { n: 4, tone: 'surface', boxed: true }),
      splitHeading(c, { tone: 'bg', paras: 2, heading: 'Under the old oaks' }),
      contact(c, { tone: 'dark', heading: 'Come and see it' }),
    ] },
    { slug: 'gallery', title: 'Gallery', build: (c) => [
      pageTitle(c, { title: 'Gallery', tone: 'surface', intro: false }),
      photoBand(c, { photo: '@architecture|interior|forest', h: 520 }),
      cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', photos: ['@garden|moss|nature', '@forest|mist|nature', '@interior|study|library'], head: false, cardFill: false, imgH: 260 }),
    ] },
    { slug: 'info', title: 'Info', build: (c) => [
      pageTitle(c, { title: 'About the hall', tone: 'bg', align: 'left' }),
      cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'surface', head: false, align: 'left' }),
      faq(c, { n: 4, tone: 'bg', side: true }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', photo: '@forest|mist|nature', heading: 'Book a visit' })] },
  ],
};
export default spec;

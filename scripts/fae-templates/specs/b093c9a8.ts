// Ref — black and white gym-coach page: a black rail of vertical links, a grey photo hero with heavy capitals.
// Kept: photo hero, words left + one button · centred intro + button · alternating photo / centred-words rows
// (three) · a black closing band.
import { cards, centered, contact, ctaBand, faq, hero, pageTitle, posts, pricing, steps, zigzag, type TemplateSpec } from '../kit.ts';
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const rows = ['@moss|forest', '@nature', '@mushroom|moss'];
const spec: TemplateSpec = {
  key: 'b093c9a8', ref: 'b093c9a8', name: 'Bramble Grit', industry: 'coach', category: 'Coach',
  description: 'A hard-training gnome pathfinder in stark black and white: heavy capitals, three alternating training rows.',
  palette: { bg: '#f7f7f7', surface: '#ffffff', ink: '#111111', body: '#3a3a3a', muted: '#777777', accent: '#111111', accentInk: '#ffffff', dark: '#000000', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#ffffff', line: 'rgba(17,17,17,0.12)' },
  fonts: { head: sans, body: sans, headWeight: 800, headTrack: 0.5, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'black left rail with rotated links, logo top-left over hero, white CTA top-right', footer: 'black, brand + links in one row' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: '@mist|forest', h: 700, eyebrow: true, buttons: 1, overlay: 'rgba(12,12,12,0.5)', headSize: 60 }),
      centered(c, { tone: 'bg', button: true, size: 34 }),
      zigzag(c, { rows: rows.map((photo) => ({ photo })), tone: 'bg', startRight: true }),
      ctaBand(c, { tone: 'dark' }),
    ] },
    { slug: 'training', title: 'Training', build: (c) => [
      pageTitle(c, { title: 'Training', tone: 'dark' }),
      cards(c, { n: 3, cols: 3, kind: 'numbered', tone: 'bg', head: false, price: true }),
      pricing(c, { n: 3, tone: 'surface' }),
    ] },
    { slug: 'classes', title: 'Classes', build: (c) => [
      pageTitle(c, { title: 'Classes', tone: 'surface' }),
      cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'bg', head: false, link: '/contact' }),
      steps(c, { n: 3, tone: 'surface', head: { heading: 'Your first moon with us' } }),
      faq(c, { n: 5, tone: 'bg' }),
    ] },
    { slug: 'blog', title: 'Blog', build: (c) => [pageTitle(c, { title: 'Field notes', tone: 'bg' }), posts(c, { n: 3, photos: rows, tone: 'bg', head: false })] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Book a session at the burrow' })] },
  ],
};
export default spec;

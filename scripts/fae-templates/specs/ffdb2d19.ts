// Ref — sage and blush wellness coach: centred-logo nav, airy serif heads with a script line, layered photos.
// Kept: split hero (words left, picture right) · "meet me" picture-left story · "I believe" picture-right story ·
// a big centred quote · "work with me" offerings list · closing band.
import { avatarsFor, cards, centered, contact, ctaBand, faq, hero, imageStory, pageTitle, posts, pricing, splitHeading, stats, team, type TemplateSpec } from '../kit.ts';
const serif = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const pics = ['@garden|flowers', '@tea|food', '@bakery|bread'];
const spec: TemplateSpec = {
  key: 'ffdb2d19', ref: 'ffdb2d19', name: 'Sorrel & Fern', industry: 'coach', category: 'Coach',
  description: 'A gentle faerie pathfinder in sage and blush: split hero, two story rows, a quiet quote, ways to walk together.',
  palette: { bg: '#eef0ea', surface: '#dde4d4', ink: '#1f2a1c', body: '#3e4a3a', muted: '#6f7c68', accent: '#d9a7b5', accentInk: '#1f2a1c', dark: '#2f3d2b', darkInk: '#f4f1ea', darkBody: 'rgba(244,241,234,0.84)', darkAccent: '#e8bfcb', line: 'rgba(31,42,28,0.14)' },
  fonts: { head: serif, body: sans, headWeight: 400, btnRadius: 10, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'links left, logo centred, socials + outlined CTA right', footer: 'sage, centred logo, links + newsletter' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'split', tone: 'surface', photo: pics[0], h: 620, eyebrow: true, buttons: 1, headSize: 50 }),
      imageStory(c, { photo: pics[1], side: 'left', tone: 'bg', eyebrow: true }),
      imageStory(c, { photo: pics[2], side: 'right', tone: 'bg', button: true }),
      centered(c, { tone: 'bg', eyebrow: '❦', headSlot: 'review.quote', slot: 'review.author', size: 32 }),
      cards(c, { n: 3, cols: 3, kind: 'numbered', tone: 'surface', head: { heading: 'Walk the path with us' }, price: true, link: '/services' }),
      ctaBand(c, { tone: 'accent' }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About the glade', tone: 'surface' }),
      splitHeading(c, { tone: 'bg', paras: 2 }),
      stats(c, { n: 3, tone: 'surface' }),
      team(c, { n: 3, avatars: avatarsFor(c.site, 4), tone: 'bg', bio: true, ring: '#e8bfcb', head: { heading: 'Who tends the glade' } }),
    ] },
    { slug: 'services', title: 'Services', build: (c) => [pageTitle(c, { title: 'Ways to begin', tone: 'surface' }), pricing(c, { n: 3, tone: 'bg', head: false }), faq(c, { n: 5, tone: 'surface' })] },
    { slug: 'blog', title: 'Blog', build: (c) => [pageTitle(c, { title: 'From the glade', tone: 'bg' }), posts(c, { n: 3, photos: pics, tone: 'bg', head: false })] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Start where you stand' })] },
  ],
};
export default spec;

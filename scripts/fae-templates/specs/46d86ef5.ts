// Ref — a blush skin-care salon: one huge thin word over a close portrait, then blush/white split rows, soft pill buttons.
// Kept: full-photo hero with one centred line · blush band, words left + bleeding picture right · white band,
// bleeding picture left + words + pill button right · blush band with a centred heading and paragraph.
import { avatarsFor, cards, centered, contact, faq, hero, imageStory, pageTitle, reviews, splitHeading, team, type TemplateSpec } from '../kit.ts';
const sans = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";
const spec: TemplateSpec = {
  key: '46d86ef5', ref: '46d86ef5', name: 'Dewglow Bower', industry: 'barbershop-salon', category: 'Barbershop & Salon',
  description: 'A faerie glow-bower in blush and rose clay: one soft word over a portrait, then calm alternating rows.',
  palette: { bg: '#ffffff', surface: '#f2e6e2', ink: '#8a5646', body: '#9a6b5c', muted: '#b08878', accent: '#ac7462', accentInk: '#ffffff', dark: '#4b2f27', darkInk: '#fbf3f0', darkBody: 'rgba(251,243,240,0.82)', darkAccent: '#e9c6b9', line: 'rgba(138,86,70,0.16)' },
  fonts: { head: sans, body: sans, headWeight: 400, headTrack: -0.5, btnRadius: 999, cardRadius: 0 },
  chrome: { nav: 'links left, brand centred, socials + white pill CTA right, over the hero', footer: 'blush, centred brand + socials' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-center', photo: '@flowers|light', h: 720, buttons: 1, overlay: 'rgba(70,36,26,0.34)', headSize: 72 }),
      imageStory(c, { photo: '@flowers|garden', side: 'right', tone: 'surface', inset: false, button: true }),
      imageStory(c, { photo: '@candle|light', side: 'left', tone: 'bg', inset: false, button: true }),
      centered(c, { tone: 'surface', heading: 'The dewglow rituals', slot: 'about' }),
      cards(c, { n: 3, cols: 3, kind: 'plain', tone: 'surface', head: false, price: true, align: 'center' }),
      reviews(c, { n: 3, tone: 'bg', big: true }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About the bower', tone: 'surface' }),
      splitHeading(c, { tone: 'bg', paras: 2 }),
      team(c, { n: 3, avatars: avatarsFor(c.site, 3), tone: 'surface', bio: true, head: { heading: 'The hands that tend you' } }),
    ] },
    { slug: 'shop', title: 'Shop', build: (c) => [
      pageTitle(c, { title: 'Bottled glow', tone: 'bg' }),
      cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', cardFill: false, head: false, price: true, photos: ['@flowers|light', '@flowers|garden', '@candle|light'] }),
      centered(c, { tone: 'surface', button: true }),
    ] },
    { slug: 'services', title: 'Services', build: (c) => [
      pageTitle(c, { title: 'Rituals', tone: 'surface' }),
      cards(c, { n: 6, cols: 2, kind: 'price-row', tone: 'bg', cardFill: false, head: false, price: true }),
      faq(c, { n: 5, tone: 'surface' }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Visit the bower' })] },
  ],
};
export default spec;

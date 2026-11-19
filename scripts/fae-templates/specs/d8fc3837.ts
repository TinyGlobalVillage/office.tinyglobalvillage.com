// Ref — a small dog salon on cool grey: a framed photo hero with words left, four service pictures in a 2×2 grid, a brown
// card overlapping a portrait for the owner's hello. Rounded sans, pill buttons, a brown CTA.
// Kept: photo hero with words left + one pill button · centred heading over a grid of picture cards + button ·
// portrait beside a brown words panel · (booking and contact pages).
import { avatarsFor, cards, contact, ctaBand, faq, hero, imageStory, pageTitle, pricing, reviews, splitHeading, stats, type TemplateSpec } from '../kit.ts';
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const spec: TemplateSpec = {
  key: 'd8fc3837', ref: 'd8fc3837', name: 'Bramblepaw Parlour', industry: 'barbershop-salon', category: 'Barbershop & Salon',
  description: 'A faerie parlour where hedge-hounds get tidied: framed photo hero, picture cards, a warm brown hello from the keeper.',
  palette: { bg: '#eef1f5', surface: '#ffffff', ink: '#2b2f36', body: '#50555e', muted: '#7a808a', accent: '#8c5e4f', accentInk: '#ffffff', dark: '#2f343b', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#e3c2b6', line: 'rgba(43,47,54,0.12)' },
  fonts: { head: sans, body: sans, headWeight: 700, btnRadius: 999, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'mark + brand left, small links right, socials, brown pill CTA', footer: 'light grey, brand + contact line' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: '@forest|nature', h: 600, buttons: 1, overlay: 'rgba(16,18,24,0.5)' }),
      cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', cardFill: false, align: 'center', photos: ['@moss|mushroom', '@garden|flowers', '@water|nature'], head: { heading: 'How we tidy them' }, button: true, imgH: 240 }),
      imageStory(c, { photo: avatarsFor(c.site, 0)[0], side: 'left', tone: 'accent', button: true }),
      reviews(c, { n: 3, tone: 'bg', avatars: avatarsFor(c.site, 3) }),
      ctaBand(c, { tone: 'dark', split: true }),
    ] },
    { slug: 'book', title: 'Book online', build: (c) => [
      pageTitle(c, { title: 'Book a tidy', tone: 'surface' }),
      pricing(c, { n: 3, tone: 'bg', head: false }),
      faq(c, { n: 5, tone: 'surface' }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'The keeper of the parlour', tone: 'bg' }),
      splitHeading(c, { tone: 'surface', paras: 2 }),
      stats(c, { n: 3, tone: 'accent' }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Bring them by' })] },
  ],
};
export default spec;

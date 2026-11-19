// Ref — a pastel sushi bar: hand-script title over a full photo, a butter-yellow strip of four icons, black square buttons.
// Kept: full-photo hero, centred words + one button · yellow strip of four icons · picture left with words + button right ·
// a centred heading over a wide picture strip · founders' words left with a portrait right.
import { avatarsFor, cards, centered, contact, ctaBand, hero, imageStory, pageTitle, photoBand, reviews, stats, type TemplateSpec } from '../kit.ts';
const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const spec: TemplateSpec = {
  key: '3282fb66', ref: '3282fb66', name: 'Butterwing Pantry', industry: 'bakery', category: 'Bakery',
  description: 'A sunny gnome pantry in butter yellow and ink black: photo hero, a strip of four comforts, a pantry founded by two friends.',
  palette: { bg: '#ffffff', surface: '#f5e1a4', ink: '#141414', body: '#4a4a4a', muted: '#6e6e6e', accent: '#111111', accentInk: '#ffffff', dark: '#141414', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#f5e1a4', line: 'rgba(20,20,20,0.12)' },
  fonts: { head: serif, body: sans, headWeight: 400, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'mark-left, links centre, black block CTA right', footer: 'white, brand + links + socials row' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-center', photo: '@food|bakery', h: 620, buttons: 1, overlay: 'rgba(30,20,40,0.38)', headSize: 64 }),
      cards(c, { n: 4, cols: 4, kind: 'icon', tone: 'surface', cardFill: false, head: false }),
      imageStory(c, { photo: '@bakery|bread', side: 'left', tone: 'bg', button: true }),
      centered(c, { tone: 'bg', heading: 'Everything the pantry loves' }),
      photoBand(c, { photo: '@bread|candle', tone: 'bg', inset: false, h: 420 }),
      imageStory(c, { photo: avatarsFor(c.site, 2)[0], side: 'right', tone: 'bg', eyebrow: true, h: 640 }),
    ] },
    { slug: 'menu', title: 'Our menu', build: (c) => [
      pageTitle(c, { title: 'From the pantry shelves', tone: 'surface' }),
      cards(c, { n: 8, cols: 2, kind: 'price-row', tone: 'bg', head: false, price: true, cardFill: false }),
      ctaBand(c, { tone: 'dark', split: true }),
    ] },
    { slug: 'reviews', title: 'Reviews', build: (c) => [
      pageTitle(c, { title: 'Crumbs of praise', tone: 'bg' }),
      reviews(c, { n: 6, cols: 3, tone: 'surface', avatars: avatarsFor(c.site, 2), head: false }),
      stats(c, { n: 4, tone: 'bg' }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Pull up a stool' }), centered(c, { tone: 'surface', heading: 'Notes from the pantry', slot: 'newsletter' })] },
  ],
};
export default spec;

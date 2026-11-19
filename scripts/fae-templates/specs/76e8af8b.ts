// Ref — a pink-and-leaf bowl shop: script-over-condensed caps on a full photo, pale green "four parts" band, dark green buttons.
// Kept: full-photo hero, centred words, one button · pale green band with four numbered parts + button ·
// framed picture left with heading/paragraph/button right · heading/paragraph left with a picture right.
import { avatarsFor, cards, contact, ctaBand, hero, imageStory, pageTitle, reviews, splitHeading, stats, team, zigzag, type TemplateSpec } from '../kit.ts';
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const spec: TemplateSpec = {
  key: '76e8af8b', ref: '76e8af8b', name: 'Four-Leaf Bowlery', industry: 'bakery', category: 'Bakery',
  description: 'A gnome oven that fills baskets in four layers: big photo hero, a pale-leaf band of four numbered parts, two stories.',
  palette: { bg: '#ffffff', surface: '#d4e6b2', ink: '#2e4234', body: '#4c5a4f', muted: '#6d7b70', accent: '#33493a', accentInk: '#ffffff', dark: '#33493a', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.82)', darkAccent: '#d4e6b2', line: 'rgba(46,66,52,0.14)' },
  fonts: { head: sans, body: sans, headWeight: 700, headTrack: -0.5, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'brand-left, links centre, outlined CTA right, transparent over hero', footer: 'light, brand + socials, one row' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-center', photo: '@food|bakery', h: 640, buttons: 1, overlay: 'rgba(60,24,40,0.42)' }),
      cards(c, { n: 4, cols: 4, kind: 'numbered', tone: 'surface', cardFill: false, align: 'center', head: { eyebrow: 'From the oven', heading: 'Four layers in every basket' }, button: true }),
      imageStory(c, { photo: '@bread|bakery', side: 'left', tone: 'bg', button: true, h: 640 }),
      zigzag(c, { rows: [{ photo: '@bread|bakery#2' }], tone: 'bg' }),
      reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 4) }),
    ] },
    { slug: 'menu', title: 'Basket menu', build: (c) => [
      pageTitle(c, { title: 'The basket menu', tone: 'surface' }),
      cards(c, { n: 6, cols: 3, kind: 'plain', tone: 'bg', head: false, price: true }),
      ctaBand(c, { tone: 'accent', split: true }),
    ] },
    { slug: 'story', title: 'Our story', build: (c) => [
      pageTitle(c, { title: 'How the oven was lit', tone: 'bg' }),
      splitHeading(c, { tone: 'surface', paras: 2, button: false }),
      stats(c, { n: 3, tone: 'bg' }),
      team(c, { n: 3, avatars: avatarsFor(c.site, 4), tone: 'surface', bio: true, head: { heading: 'Hands in the dough' } }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Come by the oven' })] },
  ],
};
export default spec;

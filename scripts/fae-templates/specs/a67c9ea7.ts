// Ref — a gentlemen's barbershop: dark photo hero with tall condensed caps, an orange "our story" heading, an orange price list.
// Kept: full dark photo hero, centred eyebrow + headline · tall picture left with heading + paragraphs right ·
// accent-orange band listing services with prices · (gallery and contact pages from the nav).
import { avatarsFor, cards, contact, ctaBand, faq, hero, imageStory, pageTitle, reviews, splitHeading, stats, team, type TemplateSpec } from '../kit.ts';
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const spec: TemplateSpec = {
  key: 'a67c9ea7', ref: 'a67c9ea7', name: 'Thistle & Shears', industry: 'barbershop-salon', category: 'Barbershop & Salon',
  description: 'A faerie barber-parlour in ember orange and smoke: dark photo hero, a tall story picture, an orange list of chairs and prices.',
  palette: { bg: '#ffffff', surface: '#f7efe7', ink: '#221a14', body: '#4e443c', muted: '#857668', accent: '#c4652a', accentInk: '#ffffff', dark: '#221a14', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#f3a66e', line: 'rgba(34,26,20,0.12)' },
  fonts: { head: sans, body: sans, headWeight: 700, headTrack: 0.5, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'round mark + brand left, links centre, socials + basket right, smoky bar over hero', footer: 'dark, centred brand + socials' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-center', photo: '@barber|warm|candle', h: 700, eyebrow: true, buttons: 1, overlay: 'rgba(20,12,6,0.55)', headSize: 64 }),
      imageStory(c, { photo: '@barber|warm#2', side: 'left', tone: 'bg', h: 700 }),
      cards(c, { n: 6, cols: 2, kind: 'price-row', tone: 'accent', cardFill: false, price: true, head: { heading: 'The chair list' } }),
      team(c, { n: 3, avatars: avatarsFor(c.site, 5), tone: 'bg', head: { heading: 'Who holds the shears', intro: true } }),
      ctaBand(c, { tone: 'dark' }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About the parlour', tone: 'surface' }),
      splitHeading(c, { tone: 'bg', paras: 2 }),
      stats(c, { n: 4, tone: 'dark' }),
      team(c, { n: 3, avatars: avatarsFor(c.site, 5), tone: 'bg', bio: true, head: false }),
    ] },
    { slug: 'services', title: 'Services', build: (c) => [
      pageTitle(c, { title: 'Chairs and prices', tone: 'dark' }),
      cards(c, { n: 8, cols: 2, kind: 'price-row', tone: 'bg', cardFill: false, price: true, head: false }),
      faq(c, { n: 5, tone: 'surface' }),
    ] },
    { slug: 'gallery', title: 'Gallery', build: (c) => [
      pageTitle(c, { title: 'From the chair', tone: 'bg' }),
      cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', cardFill: false, head: false, photos: ['@barber|warm|candle', '@barber|warm#2', '@light|candle'], imgH: 360 }),
      reviews(c, { n: 3, tone: 'surface', head: false }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Take a seat' })] },
  ],
};
export default spec;

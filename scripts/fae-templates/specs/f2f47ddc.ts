// Ref — a one-agent home-finder site: white, navy ink, a bright blue accent, photo hero with the pitch on the left.
// Kept: photo hero (left words, one button) · "featured" homes as four big picture cards in two columns with a
// price line · a pale band of three "why me" columns · reviews · a closing contact band.
import { avatarsFor, cards, contact, ctaBand, faq, hero, imageStory, pageTitle, reviews, stats, type TemplateSpec } from '../kit.ts';

const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const spec: TemplateSpec = {
  key: 'f2f47ddc', ref: 'f2f47ddc', name: 'Silverbough Dwellings', industry: 'architecture', category: 'Architecture',
  description: 'An elven finder of treetop homes: a bright photo hero, four featured dwellings, three plain reasons on a pale band.',
  palette: { bg: '#ffffff', surface: '#f1f3f7', ink: '#14213d', body: '#4a5470', muted: '#7d869c', accent: '#2453e6', accentInk: '#ffffff', dark: '#14213d', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#ffffff', line: 'rgba(20,33,61,0.12)' },
  fonts: { head: sans, body: sans, headWeight: 700, headTrack: -0.4, btnRadius: 2, cardRadius: 0 },
  chrome: { nav: 'hamburger left, three centred links (find · let · sell), agent name + phone right; a vertical "see homes" tab on the edge', footer: 'navy band: name, phone, email, socials' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: '@architecture|interior|garden', h: 700, buttons: 1, overlay: 'rgba(14,22,44,0.4)' }),
      cards(c, { n: 4, cols: 2, kind: 'photo', tone: 'bg', photos: ['@interior|architecture#2', '@garden|nature|forest', '@forest|moss|nature', '@architecture|interior|garden'], head: { heading: 'Dwellings on the branch', align: 'left' }, price: true, link: '/homes', cardFill: false, imgH: 340 }),
      cards(c, { n: 3, cols: 3, kind: 'plain', tone: 'surface', head: { heading: 'Why walk the boughs with me', intro: true }, cardFill: false, align: 'left' }),
      reviews(c, { n: 3, tone: 'bg', avatars: avatarsFor(c.site, 2), cols: 3 }),
      ctaBand(c, { tone: 'dark', split: true }),
    ] },
    { slug: 'homes', title: 'Homes', build: (c) => [
      pageTitle(c, { title: 'Homes in the canopy', tone: 'surface', align: 'left' }),
      cards(c, { n: 4, cols: 2, kind: 'photo', tone: 'bg', photos: ['@garden|nature|forest', '@forest|moss|nature', '@interior|architecture#2', '@architecture|interior|garden'], head: false, price: true, cardFill: false, imgH: 300 }),
      faq(c, { n: 5, tone: 'surface', side: true }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'Your guide in the boughs', tone: 'bg', align: 'left' }),
      imageStory(c, { photo: avatarsFor(c.site, 2)[0], side: 'left', tone: 'surface', button: true }),
      stats(c, { n: 4, tone: 'dark' }),
      reviews(c, { n: 2, tone: 'bg', avatars: avatarsFor(c.site, 4), cols: 2, big: true }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Find your branch' })] },
  ],
};
export default spec;

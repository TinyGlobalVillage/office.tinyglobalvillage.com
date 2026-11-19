// Ref — a lifestyle journal in sand and cream: a tan header over a collage of framed pictures, a widely spaced serif title
// in pale tan, two offset picture + white card rows, a full-bleed sea photo with spaced capitals.
// Kept: picture-led opening band · centred eyebrow + spaced heading + paragraph + flat button · two alternating
// picture/words rows · a full-photo closing band.
import { avatarsFor, cards, centered, contact, ctaBand, hero, pageTitle, posts, splitHeading, team, zigzag, type TemplateSpec } from '../kit.ts';
const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const spec: TemplateSpec = {
  key: 'f96e4fe2', ref: 'f96e4fe2', name: 'Saltmoss Studio', industry: 'agency', category: 'Agency',
  description: 'An elven-run studio journal in sand and cream: a picture-led opening, spaced serif titles, offset stories, a sea-photo close.',
  palette: { bg: '#f4f2ef', surface: '#e4cebc', ink: '#3b2f28', body: '#6a5d54', muted: '#8f7f73', accent: '#a5826a', accentInk: '#ffffff', dark: '#24333a', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.84)', darkAccent: '#e4cebc', line: 'rgba(59,47,40,0.12)' },
  fonts: { head: serif, body: sans, headWeight: 400, headTrack: 3, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'brand centred on a tan band, small spaced links centred beneath', footer: 'cream, centred brand + links' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'split', photo: '@study|desk|books', tone: 'surface', h: 600, buttons: 1, imageRadius: 0 }),
      centered(c, { tone: 'bg', eyebrow: true, button: true }),
      zigzag(c, { rows: [{ photo: '@library|books', pill: true }, { photo: '@mist|forest', pill: true }], tone: 'bg', startRight: true }),
      ctaBand(c, { tone: 'dark', photo: '@water|mist|nature' }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About the studio', tone: 'surface' }),
      splitHeading(c, { tone: 'bg', paras: 2 }),
      team(c, { n: 3, avatars: avatarsFor(c.site, 2), tone: 'surface', head: { heading: 'The weavers of banners' } }),
    ] },
    { slug: 'journal', title: 'Journal', build: (c) => [
      pageTitle(c, { title: 'The journal', tone: 'bg' }),
      posts(c, { n: 3, photos: ['@study|desk|books', '@library|books', '@mist|forest'], tone: 'bg', head: false }),
      cards(c, { n: 3, cols: 3, kind: 'plain', tone: 'surface', head: { heading: 'What we make' }, link: '/contact' }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Send a scroll' })] },
  ],
};
export default spec;

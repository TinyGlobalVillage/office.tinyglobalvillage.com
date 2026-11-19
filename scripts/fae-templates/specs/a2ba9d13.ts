// Ref — a calm studio in warm ivory, navy serif heads, sage buttons and a tan box: centred photo hero, a big
// heading left with a paragraph right, a picture overlapped by a tan text card, a centred row of offerings.
// Kept: photo hero (centred) · heading-left/paragraph-right · photo + tan text card story · three offerings · closing photo band.
import { avatarsFor, cards, contact, ctaBand, hero, imageStory, pageTitle, posts, pricing, reviews, splitHeading, team, type TemplateSpec } from '../kit.ts';
const serif = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const spec: TemplateSpec = {
  key: 'a2ba9d13', ref: 'a2ba9d13', name: 'Fernlight Studio', industry: 'agency', category: 'Agency',
  description: 'A slow faerie studio in ivory, navy and fern green: soft photo hero, a tan story card, three quiet offerings.',
  palette: { bg: '#f7f2ee', surface: '#c2a27f', ink: '#1d2a5b', body: '#36406a', muted: '#6c7192', accent: '#8fa889', accentInk: '#1d2a5b', dark: '#1d2a5b', darkInk: '#f7f2ee', darkBody: 'rgba(247,242,238,0.82)', darkAccent: '#c8d9c3', line: 'rgba(29,42,91,0.16)' },
  fonts: { head: serif, body: sans, headWeight: 700, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'round logo + script brand left, tracked mono links right, sage CTA', footer: 'ivory, brand centre, links + newsletter' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-center', photo: '@forest|mist|nature', h: 560, buttons: 1, overlay: 'rgba(29,42,91,0.34)' }),
      splitHeading(c, { tone: 'bg', button: false }),
      imageStory(c, { photo: '@moss|mushroom', side: 'left', tone: 'surface', inset: false, heading: 'Let us talk about the whole wood', h: 640 }),
      cards(c, { n: 3, cols: 3, kind: 'icon', tone: 'bg', head: { heading: 'What we offer' }, link: '/offerings' }),
      ctaBand(c, { tone: 'dark', photo: '@candle|warm|light' }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About', tone: 'bg' }),
      team(c, { n: 2, avatars: avatarsFor(c.site, 2), tone: 'bg', bio: true, head: false, ring: '#8fa889' }),
      reviews(c, { n: 3, tone: 'surface' }),
    ] },
    { slug: 'offerings', title: 'Offerings', build: (c) => [
      pageTitle(c, { title: 'Offerings', photo: '@forest|mist|nature' }),
      pricing(c, { n: 3, tone: 'bg', head: false }),
    ] },
    { slug: 'journal', title: 'Journal', build: (c) => [
      pageTitle(c, { title: 'Journal', tone: 'bg' }),
      posts(c, { n: 3, photos: ['@moss|mushroom', '@candle|warm|light', '@forest|mist|nature'], tone: 'bg', head: false }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg' })] },
  ],
};
export default spec;

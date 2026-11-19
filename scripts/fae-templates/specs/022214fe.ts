// Ref — a holiday home in white and harbour blue, wide extended capitals: an inset photo band as the hero, a big
// left heading, a two-photo collage beside a short pitch with an underlined link, then textured rows of text
// left and a photo right.
// Kept: inset photo band hero · photo-left story · text-left/photo-right rows · icon features · faq · closing band.
import { cards, contact, ctaBand, faq, imageStory, pageTitle, photoBand, reviews, zigzag, type TemplateSpec } from '../kit.ts';
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const spec: TemplateSpec = {
  key: '022214fe', ref: '022214fe', name: 'Saltwind Heralds', industry: 'agency', category: 'Agency',
  description: 'An elven herald-house by the harbour in white and sea blue: a wide photo band, a collage pitch, tidy text-and-picture rows.',
  palette: { bg: '#ffffff', surface: '#f1f1ef', ink: '#2b2b2b', body: '#4a4a4a', muted: '#7a7a7a', accent: '#1d4f91', accentInk: '#ffffff', dark: '#163a6b', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.82)', darkAccent: '#9cc3f2', line: 'rgba(43,43,43,0.16)' },
  fonts: { head: sans, body: sans, headWeight: 700, headTrack: 1.5, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'big blue wordmark left, plain links right, outlined mono CTA; hairline under', footer: 'white, wordmark + link row + fine print' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      photoBand(c, { photo: '@water|mist|nature', tone: 'bg', h: 440, radius: 0 }),
      imageStory(c, { photo: '@architecture|forest', side: 'left', tone: 'bg', button: true, heading: 'A home away from the hollow', h: 680 }),
      zigzag(c, { rows: [{ photo: '@sky|mist' }, { photo: '@city|nature' }], tone: 'surface' }),
      faq(c, { n: 5, tone: 'bg' }),
      ctaBand(c, { tone: 'accent', split: true }),
    ] },
    { slug: 'features', title: 'Features', build: (c) => [
      pageTitle(c, { title: 'Features', tone: 'surface', align: 'left' }),
      cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'bg', head: false, align: 'left', cardFill: false }),
      reviews(c, { n: 3, tone: 'surface' }),
    ] },
    { slug: 'favourites', title: 'Local Favourites', build: (c) => [
      pageTitle(c, { title: 'Local favourites', tone: 'bg', align: 'left' }),
      cards(c, { n: 6, cols: 2, kind: 'numbered', tone: 'surface', head: false }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', photo: '@water|mist|nature' })] },
  ],
};
export default spec;

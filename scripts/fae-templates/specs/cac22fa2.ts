// Ref — an investment firm all in black with a lime-yellow button, a narrow technical sans: split hero (words
// left, a big photo right), a staggered pair of photos beside a heading and two paragraphs, a lone text column.
// Kept: split hero with large photo · photo-left story + button · two-paragraph text block · wide photo band.
import { cards, contact, faq, hero, imageStory, pageTitle, photoBand, posts, splitHeading, steps, type TemplateSpec } from '../kit.ts';
const grot = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";
const spec: TemplateSpec = {
  key: 'cac22fa2', ref: 'cac22fa2', name: 'Moonmoth & Co.', industry: 'agency', category: 'Agency',
  description: 'A faerie studio that backs bright ideas, all in night-black with a moth-yellow glow: big split hero, staggered stories.',
  palette: { bg: '#050505', surface: '#131313', ink: '#ffffff', body: 'rgba(255,255,255,0.72)', muted: 'rgba(255,255,255,0.5)', accent: '#e6f27a', accentInk: '#111111', dark: '#000000', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.72)', darkAccent: '#e6f27a', line: 'rgba(255,255,255,0.12)' },
  fonts: { head: grot, body: grot, headWeight: 500, headTrack: -0.6, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'black: brand left, small grey links beside it, socials + yellow CTA right', footer: 'black, brand, link columns, socials' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'split', tone: 'bg', photo: '@interior|warm|candle', buttons: 1, h: 700, headSize: 56 }),
      imageStory(c, { photo: '@desk|study', side: 'left', tone: 'bg', button: true, h: 760 }),
      splitHeading(c, { tone: 'bg', paras: 2, button: false }),
      photoBand(c, { photo: '@workshop|books|library', tone: 'bg', h: 460 }),
      cards(c, { n: 3, cols: 3, kind: 'numbered', tone: 'surface', cardFill: false, head: { heading: 'How the journey runs', align: 'left' } }),
    ] },
    { slug: 'how-it-works', title: 'How It Works', build: (c) => [
      pageTitle(c, { title: 'How it works', tone: 'bg', align: 'left' }),
      steps(c, { n: 4, tone: 'surface' }),
      faq(c, { n: 5, tone: 'bg' }),
    ] },
    { slug: 'journal', title: 'Notes & Tips', build: (c) => [
      pageTitle(c, { title: 'Notes & tips', tone: 'surface', align: 'left' }),
      posts(c, { n: 3, photos: ['@desk|study', '@workshop|books|library', '@interior|warm|candle'], tone: 'bg', head: false }),
    ] },
    { slug: 'contact', title: 'Support', build: (c) => [contact(c, { tone: 'bg', heading: 'Let us talk it over' })] },
  ],
};
export default spec;

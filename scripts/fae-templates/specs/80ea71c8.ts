// Ref — a coming-soon page for a studio: one full-screen photo with a soft wash, huge stacked uppercase words
// on the left, and on the right a short intro, an e-mail field and a grey sign-up button.
// Kept: full-bleed photo opening (big stacked words left · intro + e-mail field + button right) ·
// a quiet about page · contact.
import { PAD, bottom, button, cards, contact, group, imageStory, pageTitle, section, shape, splitHeading, text, wash, type Ctx, type Section, type TemplateSpec } from '../kit.ts';

const sans = "'Futura', 'Century Gothic', 'Avenir Next', Arial, sans-serif";
const body = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** The whole opening: photo behind, stacked words left, a sign-up column right. */
function soonHero(c: Ctx, photo: string): Section {
  const H = 760;
  const ov = 'rgba(40,40,40,0.38)';
  const words = text(c, { text: 'Opening soon', x: PAD, y: 250, w: 560, size: 96, color: '#ffffff', font: 'head', weight: 700, upper: true, lh: 0.98, track: 1, role: 'h1', name: 'Big words' });
  const rx = 760;
  const rw = 380;
  const intro = text(c, { slot: 'subhead', x: rx, y: 300, w: rw, size: 17, color: '#ffffff', name: 'Intro' });
  const field = group(c, { name: 'E-mail field', x: rx, y: bottom(intro) + 28, w: rw, h: 50, children: [
    shape(c, { x: 0, y: 0, w: rw, h: 50, pct: 100, fill: 'rgba(255,255,255,0.12)', border: '#ffffff', name: 'Field' }),
    text(c, { text: 'Your owl-post address', x: 16, y: 14, w: rw - 32, size: 14, color: 'rgba(255,255,255,0.8)', lh: 1.4, name: 'Placeholder' }),
  ] });
  const b = button(c, { text: 'Tell me first', href: '/contact', x: rx, y: bottom(field) + 14, w: rw, look: 'solid' });
  return section([words, intro, field, b], Math.max(H, bottom(b) + 160), wash(ov), 'banner-image-atomic', {
    bgPin: { src: c.photo(photo), paintFrame: true, pinned: false, overlay: ov },
  });
}

const spec: TemplateSpec = {
  key: '80ea71c8',
  ref: '80ea71c8',
  name: 'Cloudmantle Studio',
  industry: 'business',
  category: 'Business',
  description: 'A sprite workshop not yet open: one misty full-screen photo, giant stacked words and a place to leave your owl-post.',
  palette: { bg: '#f2f0ec', surface: '#e6e3dd', ink: '#1d1d1d', body: '#4a4a4a', muted: '#7a7a7a', accent: '#8c8c8c', accentInk: '#ffffff', dark: '#262626', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#cfcfcf', line: 'rgba(29,29,29,0.14)' },
  fonts: { head: sans, body, headWeight: 700, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'small wordmark left, two links right, transparent over the photo', footer: 'none on home; a thin grey line of fine print inside' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [soonHero(c, '@mist|forest')],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'Behind the mantle', tone: 'surface', align: 'left' }),
        imageStory(c, { photo: '@forest', side: 'left', tone: 'bg', button: false }),
        splitHeading(c, { tone: 'surface', heading: 'What we are weaving', paras: 2, button: false }),
        cards(c, { n: 3, cols: 3, kind: 'numbered', tone: 'bg', head: { heading: 'Three promises' }, cardFill: false }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Knock on the workshop door', photo: '@mist|forest' })],
    },
  ],
};
export default spec;

// Ref — a crisp white architecture studio: black boxed wordmark, inset photo hero with words on the left, bold sans.
// Kept: inset photo hero (left words) · picture + "welcome" words · full-bleed picture beside a grey philosophy
// panel · four line-icon values across · a closing photo band.
import { avatarsFor, cards, contact, ctaBand, faq, hero, imageStory, pageTitle, splitHeading, stats, team, type TemplateSpec } from '../kit.ts';

const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

const spec: TemplateSpec = {
  key: 'f5154f63', ref: 'f5154f63', name: 'Spireleaf Studio', industry: 'architecture', category: 'Architecture',
  description: 'An elven hall-builders’ studio in stark white and ink: inset photo hero, a philosophy panel, four quiet values.',
  palette: { bg: '#ffffff', surface: '#f4f4f4', ink: '#111111', body: '#555555', muted: '#8a8a8a', accent: '#111111', accentInk: '#ffffff', dark: '#111111', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', darkAccent: '#d9d9d9', line: 'rgba(17,17,17,0.12)' },
  fonts: { head: sans, body: sans, headWeight: 700, headTrack: -0.5, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'black boxed wordmark left, hamburger right, no visible links', footer: 'white, slim: wordmark, socials, fine print' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: '@architecture|interior|forest', h: 640, eyebrow: true, buttons: 1, overlay: 'rgba(20,24,36,0.42)' }),
      imageStory(c, { photo: '@interior', side: 'right', tone: 'bg', button: true, heading: 'Welcome to the glade studio' }),
      imageStory(c, { photo: '@architecture|landscape|forest#2', side: 'left', tone: 'surface', inset: false, h: 620, button: true, heading: 'How we raise a hall' }),
      cards(c, { n: 4, cols: 4, kind: 'icon', tone: 'bg', head: false, cardFill: false, align: 'left' }),
      ctaBand(c, { tone: 'dark', photo: '@city|mist|nature', buttons: 2 }),
    ] },
    { slug: 'projects', title: 'Projects', build: (c) => [
      pageTitle(c, { title: 'Halls we have raised', tone: 'surface', align: 'left' }),
      cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', head: false, cardFill: false, photos: ['@architecture|interior|forest', '@interior', '@architecture|landscape|forest#2'], link: '/contact', imgH: 300 }),
      cards(c, { n: 6, cols: 3, kind: 'numbered', tone: 'surface', head: { heading: 'From first sketch to last beam', align: 'left' } }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'The studio', tone: 'bg', align: 'left' }),
      splitHeading(c, { tone: 'surface', paras: 2, button: false }),
      stats(c, { n: 4, tone: 'dark' }),
      team(c, { n: 4, avatars: avatarsFor(c.site, 4), tone: 'bg', head: { heading: 'The drafting table', intro: true } }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Bring us your glade' }), faq(c, { n: 4, tone: 'surface' })] },
  ],
};
export default spec;

// Ref — a minimalist architect: white left rail (wordmark, stacked links, socials), one framed building photo with
// huge black capitals and a small dark button.
// Kept: big centred-capitals photo hero · then (beyond the one screen) a quiet intro, two big project pictures,
// numbers and a split closing band — all in the same stark white.
import { avatarsFor, cards, centered, contact, ctaBand, hero, pageTitle, splitHeading, stats, team, zigzag, type TemplateSpec } from '../kit.ts';
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const works = ['@architecture|forest', '@landscape|sky|mist'];
const spec: TemplateSpec = {
  key: '9d0da8ca', ref: '9d0da8ca', name: 'Hollowspire Studio', industry: 'architecture', category: 'Architecture',
  description: 'An elven hall-builder at its barest: white rail, one vast picture with heavy capitals, two halls shown large.',
  palette: { bg: '#ffffff', surface: '#f3f3f1', ink: '#0d0d0d', body: '#4a4a4a', muted: '#8a8a8a', accent: '#141414', accentInk: '#ffffff', dark: '#141414', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.76)', darkAccent: '#e8e2d6', line: 'rgba(13,13,13,0.1)' },
  fonts: { head: sans, body: sans, headWeight: 800, headTrack: -1.2, btnRadius: 4, btnUpper: false, cardRadius: 0 },
  chrome: { nav: 'white left rail: wordmark top, stacked links middle, socials bottom; content framed to the right', footer: 'one fine-print line under the frame' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-center', photo: '@mist|architecture', h: 720, buttons: 1, overlay: 'rgba(10,10,10,0.38)', headSize: 76 }),
      centered(c, { tone: 'bg', eyebrow: true }),
      cards(c, { n: 2, cols: 2, kind: 'photo', tone: 'bg', photos: works, head: false, cardFill: false, imgH: 440, link: '/projects' }),
      stats(c, { n: 3, tone: 'surface' }),
      ctaBand(c, { tone: 'dark', split: true }),
    ] },
    { slug: 'projects', title: 'Projects', build: (c) => [
      pageTitle(c, { title: 'Halls we raised', tone: 'bg', align: 'left' }),
      zigzag(c, { rows: works.map((photo) => ({ photo, pill: true })), tone: 'bg' }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About the studio', tone: 'surface', align: 'left' }),
      splitHeading(c, { tone: 'bg', paras: 2 }),
      team(c, { n: 3, avatars: avatarsFor(c.site, 1), tone: 'surface', head: { heading: 'Drawn by these hands' } }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', photo: '@sky|landscape', heading: 'Bring us your glade' })] },
  ],
};
export default spec;

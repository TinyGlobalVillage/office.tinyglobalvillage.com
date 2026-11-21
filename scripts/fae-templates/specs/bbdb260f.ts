// Ref — a dark architecture portfolio: pale left panel (wordmark, three links, socials), the rest one full-bleed
// near-black building photo with a faint caption low on the left.
// Kept: full dark photo hero with the words low-key on the left · then works as large picture cards, a dark
// statement band and a split close, keeping the pale-panel / black-photo contrast.
import { avatarsFor, cards, contact, ctaBand, hero, imageStory, pageTitle, splitHeading, stats, team, zigzag, type TemplateSpec } from '../kit.ts';
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const works = ['@architecture|moss', '@city|mist', '@sky|nature'];
const spec: TemplateSpec = {
  key: 'bbdb260f', ref: 'bbdb260f', name: 'Nightroot Plans', industry: 'architecture', category: 'Architecture',
  description: 'An elven plan-drawer after dusk: a pale side panel against one black picture, then the works shown large.',
  palette: { bg: '#f0f2f6', surface: '#ffffff', ink: '#16181d', body: '#4d525c', muted: '#878c96', accent: '#1e2026', accentInk: '#ffffff', dark: '#1e2026', darkInk: '#f0f2f6', darkBody: 'rgba(240,242,246,0.7)', darkAccent: '#c8ccd6', line: 'rgba(22,24,29,0.12)' },
  fonts: { head: sans, body: sans, headWeight: 700, headTrack: -0.5, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'pale left panel: bold wordmark top, three uppercase links mid, socials foot', footer: 'none beyond the panel — a fine-print line' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: '@mist|forest', h: 760, buttons: 1, overlay: 'rgba(18,20,24,0.72)', headSize: 46 }),
      cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', photos: works, head: { eyebrow: true, heading: 'Works', align: 'left' }, cardFill: false, imgH: 320, link: '/works' }),
      splitHeading(c, { tone: 'dark' }),
      ctaBand(c, { tone: 'bg', split: true }),
    ] },
    { slug: 'works', title: 'Works', build: (c) => [
      pageTitle(c, { title: 'Works', tone: 'dark', align: 'left' }),
      zigzag(c, { rows: works.map((photo) => ({ photo, bullets: 2 })), tone: 'bg' }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About', tone: 'bg', align: 'left' }),
      imageStory(c, { photo: avatarsFor(c.site, 3)[0], side: 'right', tone: 'surface', eyebrow: true }),
      stats(c, { n: 4, tone: 'dark' }),
      team(c, { n: 2, avatars: avatarsFor(c.site, 3), tone: 'bg', bio: true, head: { heading: 'At the drafting table' } }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Send word by moth' })] },
  ],
};
export default spec;

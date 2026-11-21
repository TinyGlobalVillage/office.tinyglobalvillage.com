// Ref 1 — a webinar-style practice page: pale grey, near-black type, a yellow accent, a geometric sans.
// Kept: centred eyebrow + headline + one button · wide picture strip · "about the session" text + framed
// picture · speakers in yellow rings · what you will learn (numbered) · sign-up band.
import { avatarsFor, cards, contact, ctaBand, faq, hero, imageStory, pageTitle, photoBand, steps, team, type TemplateSpec } from '../kit.ts';
const grot = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";
const spec: TemplateSpec = {
  key: '5e76223d', ref: '5e76223d', name: 'Lantern Talk', industry: 'accounting', category: 'Accounting',
  description: 'An elven counting-house hosting a lantern-lit talk: centred hero, speakers, what you will learn.',
  palette: { bg: '#eceef1', surface: '#ffffff', ink: '#14161a', body: '#4a4f58', muted: '#6b7280', accent: '#f5c84c', accentInk: '#14161a', dark: '#14161a', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', darkAccent: '#f5c84c', line: 'rgba(20,22,26,0.12)' },
  fonts: { head: grot, body: grot, headWeight: 700, headTrack: -0.5, btnRadius: 999, cardRadius: 16 },
  chrome: { nav: 'brand-left, links centre, pill CTA right', footer: 'single row: brand, links, socials' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'plain-center', tone: 'bg', eyebrow: true, buttons: 1, h: 560, headSize: 64 }),
      photoBand(c, { photo: 'p-3892bcd6', tone: 'bg', h: 520, radius: 24 }),
      imageStory(c, { photo: 'p-20c3f888', side: 'right', tone: 'surface', heading: 'About the talk', button: true }),
      team(c, { n: 4, avatars: avatarsFor(c.site), tone: 'bg', ring: '#f5c84c', head: { heading: 'Meet the speakers', intro: true } }),
      steps(c, { n: 4, tone: 'surface', head: { heading: 'What you will learn', intro: true } }),
      ctaBand(c, { tone: 'accent', split: true }),
    ] },
    { slug: 'programme', title: 'Programme', build: (c) => [
      pageTitle(c, { title: 'The programme', tone: 'bg' }),
      cards(c, { n: 6, cols: 3, kind: 'numbered', tone: 'bg', head: false }),
      faq(c, { n: 6, tone: 'surface' }),
    ] },
    { slug: 'register', title: 'Register', build: (c) => [contact(c, { tone: 'bg', heading: 'Save a seat by the lantern' })] },
  ],
};
export default spec;

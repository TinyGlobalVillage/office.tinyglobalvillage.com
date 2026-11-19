// Ref — a one-screen builder's page: full photo of weathered timber, italic gold "welcome" over a big serif name,
// charcoal band, mustard footer strip.
// Kept: photo hero with centred words (gold eyebrow line) · a charcoal band beneath · mustard accents.
// The reference stops there; the rest of the home and the inner pages are sensible builder sections in its look.
import { avatarsFor, cards, contact, ctaBand, hero, imageStory, pageTitle, splitHeading, stats, steps, team, type TemplateSpec } from '../kit.ts';
const serif = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const yard = ['@forest|nature', '@moss|nature', '@workshop|craft', '@forest|nature#2'];
const spec: TemplateSpec = {
  key: '72a6ebc4', ref: '72a6ebc4', name: 'Oakbeam Yard', industry: 'construction', category: 'Construction',
  description: 'A gnome timber-and-stone yard in charcoal and mustard: a photo-wide welcome, then plain sturdy bands.',
  palette: { bg: '#262626', surface: '#303030', ink: '#f5f1e6', body: 'rgba(245,241,230,0.78)', muted: 'rgba(245,241,230,0.58)', accent: '#f6d47a', accentInk: '#1e1e1e', dark: '#1b1b1b', darkInk: '#f5f1e6', darkBody: 'rgba(245,241,230,0.78)', darkAccent: '#f6d47a', line: 'rgba(255,255,255,0.12)' },
  fonts: { head: serif, body: sans, headWeight: 500, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'gold wordmark left, uppercase links centre, mustard phone CTA right — transparent over the hero', footer: 'mustard strip: fine print left, socials right' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-center', photo: yard[0], h: 640, eyebrow: true, buttons: 1, overlay: 'rgba(30,20,10,0.5)', headSize: 64 }),
      splitHeading(c, { tone: 'bg' }),
      cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'surface', head: { heading: 'What the yard builds' }, align: 'left' }),
      stats(c, { n: 4, tone: 'accent' }),
      ctaBand(c, { tone: 'dark', split: true }),
    ] },
    { slug: 'about', title: 'About Us', build: (c) => [
      pageTitle(c, { title: 'About the yard', tone: 'dark' }),
      imageStory(c, { photo: yard[1], side: 'left', tone: 'bg', button: true }),
      team(c, { n: 4, avatars: avatarsFor(c.site, 2), tone: 'surface', head: { heading: 'The crew with the mallets' } }),
    ] },
    { slug: 'services', title: 'Services', build: (c) => [
      pageTitle(c, { title: 'Services', tone: 'surface' }),
      cards(c, { n: 4, cols: 2, kind: 'numbered', tone: 'bg', head: false, price: true }),
      steps(c, { n: 4, tone: 'dark', head: { heading: 'From first stake to last stone' } }),
    ] },
    { slug: 'gallery', title: 'Gallery', build: (c) => [
      pageTitle(c, { title: 'Built by hand', tone: 'dark' }),
      cards(c, { n: 4, cols: 2, kind: 'photo', tone: 'bg', photos: yard, head: false, cardFill: false, imgH: 360 }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Knock at the yard gate' })] },
  ],
};
export default spec;

// Ref — a pop-up fashion sale in peach and cream, a slab serif with tiny tracked capitals: a split hero (words
// left, portrait on a peach panel), a centred about on cream, featured designers as a grid of pastel tiles.
// Kept: split hero with eyebrow date + one black button · centred about + button · two picture tiles · featured people grid.
import { avatarsFor, cards, centered, contact, ctaBand, hero, imageStory, pageTitle, stats, team, type TemplateSpec } from '../kit.ts';
const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const spec: TemplateSpec = {
  key: 'dc8a7f02', ref: 'dc8a7f02', name: 'Thimble Pop-up', industry: 'agency', category: 'Agency',
  description: 'An elven pop-up atelier in peach and cream: split hero for a moonrise sale, a quiet about, the featured makers.',
  palette: { bg: '#fff7f0', surface: '#fbe3d3', ink: '#141414', body: '#3e3a36', muted: '#7c6f66', accent: '#141414', accentInk: '#ffffff', dark: '#141414', darkInk: '#fff7f0', darkBody: 'rgba(255,247,240,0.8)', darkAccent: '#f6c3a6', line: 'rgba(20,20,20,0.12)' },
  fonts: { head: serif, body: sans, headWeight: 400, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'small brand left on a peach tab, tracked capitals right; vertical side links + socials on the edges', footer: 'cream, one line: brand, links, socials' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'split', tone: 'surface', photo: '@fabric|light|warm', eyebrow: 'Moonrise sale · first frost', buttons: 1, h: 680, headSize: 50 }),
      centered(c, { tone: 'bg', heading: 'About the bower', slot: 'about', button: true, size: 34 }),
      cards(c, { n: 2, cols: 2, kind: 'photo', tone: 'bg', cardFill: false, photos: ['@jewelry|candle', '@product|craft|warm'], head: { heading: 'From the rails', size: 32 }, imgH: 420 }),
      team(c, { n: 4, avatars: avatarsFor(c.site, 3), tone: 'surface', head: { heading: 'Featured makers', size: 32 } }),
    ] },
    { slug: 'about', title: 'About Us', build: (c) => [
      pageTitle(c, { title: 'About the bower', tone: 'surface' }),
      imageStory(c, { photo: '@craft|studio|light', side: 'right', tone: 'bg', button: true }),
      stats(c, { n: 3, tone: 'dark' }),
    ] },
    { slug: 'makers', title: 'Featured Makers', build: (c) => [
      pageTitle(c, { title: 'Featured makers', tone: 'bg' }),
      team(c, { n: 6, avatars: avatarsFor(c.site, 3), tone: 'bg', bio: true, head: false }),
      cards(c, { n: 3, cols: 3, kind: 'numbered', tone: 'surface', cardFill: false, head: { heading: 'How the pop-up works' } }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Come by the bower' }), ctaBand(c, { tone: 'dark', split: true })] },
  ],
};
export default spec;

// Ref — a black stage-company site with a hot-pink accent box, bold grotesk heads, split hero, alternating photo rows.
// Kept: split hero (words left, picture right) · pink block with heading-left and a grid of short points + button ·
// two alternating picture/text rows · dark reviews · pink call band.
import { avatarsFor, cards, contact, ctaBand, faq, hero, imageStory, pageTitle, posts, reviews, steps, team, zigzag, type TemplateSpec } from '../kit.ts';

const grotesk = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

const spec: TemplateSpec = {
  key: 'c3c97182',
  ref: 'c3c97182',
  name: 'Emberwick Masquers',
  industry: 'actor',
  category: 'Actor',
  description: 'A loud, ember-lit troupe on black with a hot-pink block of promises and alternating lantern-light rows.',
  palette: {
    bg: '#0a0a0a',
    surface: '#161616',
    ink: '#ffffff',
    body: 'rgba(255,255,255,0.8)',
    muted: '#b5b5b5',
    accent: '#e8104c',
    accentInk: '#ffffff',
    dark: '#141414',
    darkInk: '#ffffff',
    darkBody: 'rgba(255,255,255,0.78)',
    darkAccent: '#ff6a93',
    line: 'rgba(255,255,255,0.16)',
  },
  fonts: { head: grotesk, body: sans, headWeight: 700, headTrack: -0.5, btnRadius: 4, btnUpper: true, cardRadius: 6 },
  chrome: { nav: 'brand-left, links centred, pink CTA button right', footer: 'black, four link columns, pink rule on top' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'split', tone: 'bg', photo: '@candle|warm', buttons: 2, headSize: 60, h: 700 }),
        cards(c, { n: 6, cols: 3, kind: 'plain', tone: 'accent', cardFill: false, head: { heading: 'What the embers promise', align: 'left', intro: true }, button: true }),
        zigzag(c, { tone: 'bg', rows: [{ photo: '@light|candle', pill: true, bullets: 2 }, { photo: '@nature', bullets: 2 }] }),
        reviews(c, { n: 3, tone: 'dark', avatars: avatarsFor(c.site, 2), head: { heading: 'Heard after the curtain' } }),
        ctaBand(c, { tone: 'accent', buttons: 2 }),
      ],
    },
    {
      slug: 'meet',
      title: 'Meet us',
      build: (c) => [
        pageTitle(c, { title: 'The ember folk', tone: 'surface' }),
        imageStory(c, { photo: avatarsFor(c.site, 2)[0], side: 'left', tone: 'bg', button: true }),
        team(c, { n: 4, avatars: avatarsFor(c.site, 2), tone: 'dark', bio: true, ring: '#e8104c', head: { heading: 'Who takes the stage' } }),
      ],
    },
    {
      slug: 'how-it-works',
      title: 'How it works',
      build: (c) => [
        pageTitle(c, { title: 'From spark to stage', tone: 'accent' }),
        steps(c, { n: 4, tone: 'bg' }),
        faq(c, { n: 5, tone: 'surface' }),
      ],
    },
    {
      slug: 'journal',
      title: 'Journal',
      build: (c) => [
        pageTitle(c, { title: 'Notes from the wings', tone: 'bg', align: 'left' }),
        posts(c, { n: 3, photos: ['@light|candle', '@nature', '@candle|warm'], tone: 'bg', head: false }),
        contact(c, { tone: 'surface', heading: 'Light a lantern' }),
      ],
    },
  ],
};
export default spec;

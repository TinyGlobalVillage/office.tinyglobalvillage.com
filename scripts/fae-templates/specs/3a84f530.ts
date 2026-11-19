// Ref — a dance-lesson site: off-white, black, a violet accent, heavy uppercase display, black pill buttons.
// Kept: split hero (words left, photo right) · a black running ticker of one word · "how it works": a picture
// beside three short steps and a violet button · a row of style cards · prices · a call band.
import { avatarsFor, cards, ctaBand, faq, hero, pageTitle, pricing, section, stats, team, text, tone, zigzag, type Ctx, type Section, type TemplateSpec, type Tone } from '../kit.ts';

const grotesk = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** A band with one word repeating across it, sliding sideways (a marquee). */
function ticker(ctx: Ctx, word: string, t: Tone): Section {
  const tt = tone(ctx, t);
  const line = Array(10).fill(word).join('   ✸   ');
  const n = text(ctx, { text: line, x: 0, y: 26, w: 1200, pct: 100, size: 40, color: tt.head, font: 'head', weight: 800, upper: true, lh: 1.2, name: 'Ticker' });
  n.box.desktop.h = 50;
  (n as Record<string, unknown>).anim = { type: 'marquee', direction: 'left', durationMs: 28000 };
  return section([n], 102, tt.bg);
}

const spec: TemplateSpec = {
  key: '3a84f530', ref: '3a84f530', name: 'Ringdance Hollow', industry: 'artist', category: 'Artist',
  description: 'A faerie ring-dance school in loud violet and black: split hero, a running word band, three steps in, a row of styles.',
  palette: { bg: '#f4f4ef', surface: '#ffffff', ink: '#111111', body: '#3c3c3c', muted: '#777770', accent: '#7b3fe4', accentInk: '#ffffff', dark: '#111111', darkInk: '#f4f4ef', darkBody: 'rgba(244,244,239,0.78)', darkAccent: '#ffb894', line: 'rgba(17,17,17,0.12)' },
  fonts: { head: grotesk, body: sans, headWeight: 800, headTrack: -1, btnRadius: 999, btnUpper: true, cardRadius: 18 },
  chrome: { nav: 'name left, six links centred, black pill "sign in" right', footer: 'black: big name, link columns, socials' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'split', photo: '@stage|studio|light', tone: 'bg', h: 700, eyebrow: true, buttons: 2, headSize: 64, imageRadius: 18 }),
      ticker(c, 'Dance', 'dark'),
      zigzag(c, { rows: [{ photo: '@studio|stage|warm#2', bullets: 3, pill: true }], tone: 'surface', head: { heading: 'How the ring works', align: 'left' } }),
      cards(c, { n: 4, cols: 4, kind: 'photo', tone: 'bg', photos: avatarsFor(c.site, 2), head: { heading: 'Pick a step', eyebrow: true }, cardFill: true, imgH: 240, link: '/styles' }),
      pricing(c, { n: 3, tone: 'surface' }),
      ctaBand(c, { tone: 'accent', buttons: 2 }),
    ] },
    { slug: 'styles', title: 'Styles', build: (c) => [
      pageTitle(c, { title: 'Styles', tone: 'dark', align: 'left' }),
      cards(c, { n: 6, cols: 3, kind: 'photo', tone: 'bg', photos: avatarsFor(c.site, 4), head: false, imgH: 260, price: true }),
      ticker(c, 'Spin', 'accent'),
    ] },
    { slug: 'pricing', title: 'Pricing', build: (c) => [
      pageTitle(c, { title: 'Join the ring', tone: 'surface' }),
      pricing(c, { n: 3, tone: 'bg', head: false }),
      faq(c, { n: 5, tone: 'surface', side: true }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'The teachers', tone: 'bg', align: 'left' }),
      team(c, { n: 4, avatars: avatarsFor(c.site, 0), tone: 'surface', bio: true, ring: '#7b3fe4' }),
      stats(c, { n: 4, tone: 'dark' }),
    ] },
  ],
};
export default spec;

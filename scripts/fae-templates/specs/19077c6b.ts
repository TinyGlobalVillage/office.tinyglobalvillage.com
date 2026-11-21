// Ref — a stylist's portfolio: pale grey ground, everything in one hot red-orange, a huge serif display word.
// Kept: split hero (giant word + short bio left, portrait right) · "select works" small thumbnails over a big
// uppercase list of works · a black-and-white portrait beside words · a "latest project" wide picture · a call band.
import { avatarsFor, button, cards, contact, CW, ctaBand, hero, imageStory, PAD, pageTitle, photoBand, section, stackDown, stats, text, tone, type Ctx, type Node, type Section, type TemplateSpec, type Tone } from '../kit.ts';

const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** A run of giant uppercase lines (the works list), a small label above, an optional underlined link below. */
function bigList(ctx: Ctx, o: { tone: Tone; n: number; size: number; label: string; from?: number; link?: string }): Section {
  const t = tone(ctx, o.tone);
  const nodes: Node[] = [text(ctx, { text: o.label, x: PAD, y: 0, w: CW, size: 14, color: t.head, italic: true, font: 'head', name: 'Label' })];
  for (let i = 0; i < o.n; i++) nodes.push(text(ctx, { slot: 'offering.title', index: (o.from ?? 0) + i, x: PAD, y: 0, w: CW, size: o.size, color: t.head, font: 'head', upper: true, lh: 1, track: -1, role: 'h3', name: 'Work' }));
  if (o.link) nodes.push(button(ctx, { text: o.link, href: '/works', x: PAD, y: 0, look: o.tone === 'dark' ? 'ghost-light' : 'outline' }));
  const st = stackDown(nodes, 90, [20, ...Array(o.n - 1).fill(4), 36]);
  return section(st.nodes, st.y + 100, t.bg);
}

const spec: TemplateSpec = {
  key: '19077c6b', ref: '19077c6b', name: 'Foxglove Atelier', industry: 'artist', category: 'Artist',
  description: 'A faerie dresser of moth-silk in one blazing ember colour: a giant display word, a long list of works, one latest piece.',
  palette: { bg: '#f2f2f2', surface: '#e6e6e6', ink: '#d9330f', body: '#2b2b2b', muted: '#6d6d6d', accent: '#d9330f', accentInk: '#ffffff', dark: '#d9330f', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.9)', darkAccent: '#ffffff', line: 'rgba(217,51,15,0.3)' },
  fonts: { head: serif, body: sans, headWeight: 400, headTrack: -1.5, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'name left in ember, two links right (info · works); no bar, no rule', footer: 'grey, ember: email, socials, a tiny credit' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'split', photo: '@fabric|art|craft', tone: 'bg', h: 720, headSize: 76, buttons: 1 }),
      cards(c, { n: 4, cols: 4, kind: 'photo', tone: 'bg', photos: avatarsFor(c.site, 3), head: { heading: 'Select works', align: 'left', size: 28 }, cardFill: false, imgH: 220 }),
      bigList(c, { tone: 'bg', n: 5, size: 70, label: 'and more, stitched by moonlight —', link: 'All the works' }),
      imageStory(c, { photo: '@studio|craft|art', side: 'left', tone: 'surface', button: true, eyebrow: true }),
      photoBand(c, { photo: '@jewelry|product|craft', tone: 'bg', h: 560 }),
      ctaBand(c, { tone: 'dark', split: true }),
    ] },
    { slug: 'works', title: 'Works', build: (c) => [
      pageTitle(c, { title: 'Select works', tone: 'bg', align: 'left' }),
      cards(c, { n: 6, cols: 3, kind: 'photo', tone: 'bg', photos: avatarsFor(c.site, 0), head: false, cardFill: false, imgH: 320, link: '/contact' }),
      bigList(c, { tone: 'dark', n: 4, size: 56, label: 'Earlier seasons', from: 5 }),
    ] },
    { slug: 'info', title: 'Info', build: (c) => [
      pageTitle(c, { title: 'Info', tone: 'surface', align: 'left' }),
      imageStory(c, { photo: avatarsFor(c.site, 3)[0], side: 'right', tone: 'bg' }),
      stats(c, { n: 3, tone: 'dark' }),
      contact(c, { tone: 'bg', heading: 'Write to the atelier' }),
    ] },
  ],
};
export default spec;

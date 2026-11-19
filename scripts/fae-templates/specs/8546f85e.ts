// Ref — a musician's site in black and red: thin uppercase display, square outline buttons, red-washed photo hero.
// Kept: red-washed photo hero (words left) · two photos side by side · a black band with an eyebrow, a giant
// uppercase list and an outline button · a second full photo hero · (tour dates and listening on inner pages).
import { avatarsFor, bottom, button, cards, contact, CW, group, headBlock, hero, PAD, pageTitle, reviews, section, stackDown, text, tone, type Ctx, type Node, type Section, type TemplateSpec, type Tone } from '../kit.ts';

const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** A band of giant uppercase lines (the songs/places list), with an eyebrow above and an outline button below. */
function bigList(ctx: Ctx, o: { tone: Tone; n: number; size: number; eyebrow: string; button?: string }): Section {
  const t = tone(ctx, o.tone);
  const nodes: Node[] = [text(ctx, { text: o.eyebrow, x: PAD, y: 0, w: CW, size: 13, color: ctx.pal.accent, weight: 600, upper: true, track: 3, name: 'Eyebrow' })];
  for (let i = 0; i < o.n; i++) nodes.push(text(ctx, { slot: 'offering.title', index: i, x: PAD, y: 0, w: CW, size: o.size, color: t.head, font: 'head', upper: true, lh: 1.05, track: 1, role: 'h3', name: 'List line' }));
  if (o.button) nodes.push(button(ctx, { text: o.button, href: '/contact', x: PAD, y: 0, look: o.tone === 'dark' ? 'ghost-light' : 'outline' }));
  const st = stackDown(nodes, 110, [28, ...Array(o.n - 1).fill(6), 44]);
  return section(st.nodes, st.y + 110, t.bg);
}

/** Dated rows in three columns (date · title · action) that stack per row on a phone; alternate rows are shaded. */
function eventRows(ctx: Ctx, o: { n: number; tone: Tone; heading: string; btn: string; zebra: string }): Section {
  const t = tone(ctx, o.tone);
  const hb = headBlock(ctx, t, { heading: o.heading, y: 96, align: 'left' });
  const y = hb.y + 44;
  const cw = CW / 3;
  const cells: Node[] = [];
  let rowH = 86;
  for (let i = 0; i < o.n; i++) {
    const fill = i % 2 === 0 ? o.zebra : undefined;
    const d = text(ctx, { slot: 'event.date', index: i, x: 24, y: 30, w: cw - 48, pct: 86, size: 14, color: ctx.pal.accent, weight: 700, upper: true, track: 1.6, name: 'Date' });
    const ti = text(ctx, { slot: 'event.title', index: i, x: 24, y: 26, w: cw - 48, pct: 86, size: 20, color: t.head, font: 'head', upper: true, role: 'h3', name: 'Title' });
    const b = button(ctx, { text: o.btn, href: '/contact', x: 24, y: 18, w: 150, look: o.tone === 'dark' ? 'ghost-light' : 'outline', size: 13 });
    rowH = Math.max(rowH, bottom(ti) + 26);
    for (const [name, kid] of [['Date', d], ['Title', ti], ['Action', b]] as const) cells.push(group(ctx, { name, x: 0, y: 0, w: cw, h: 86, children: [kid], fill, flow: { gap: 8, pad: 22 } }));
  }
  for (const c of cells) c.box.desktop.h = rowH;
  const grid = group(ctx, { name: 'Dates', x: PAD, y, w: CW, h: o.n * rowH, children: cells, layout: { cols: 3, bp: { tablet: 3, mobile: 1 }, gap: 0 } });
  return section([...hb.nodes, grid], y + o.n * rowH + 100, t.bg);
}

const spec: TemplateSpec = {
  key: '8546f85e', ref: '8546f85e', name: 'Emberwing Hollow', industry: 'artist', category: 'Artist',
  description: 'A faerie songsmith in black and ember red: washed photo heroes, a twin-photo strip, a giant list of songs.',
  palette: { bg: '#0d0d0d', surface: '#191919', ink: '#f4f1ee', body: 'rgba(244,241,238,0.74)', muted: '#9a9590', accent: '#d8262e', accentInk: '#ffffff', dark: '#000000', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.74)', darkAccent: '#ffffff', line: 'rgba(255,255,255,0.14)' },
  fonts: { head: sans, body: sans, headWeight: 300, headTrack: 2, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'links left, name centred, sign-in · socials · bag right; transparent over the hero', footer: 'black: name, socials row, a sign-up line' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: '@stage|light', h: 760, eyebrow: true, buttons: 1, overlay: 'rgba(150,12,22,0.58)', headSize: 64 }),
      cards(c, { n: 2, cols: 2, kind: 'photo', tone: 'bg', photos: ['@stage|candle#2', '@light|candle|warm'], head: false, cardFill: false, imgH: 460 }),
      bigList(c, { tone: 'dark', n: 4, size: 62, eyebrow: 'Songs from the hollow', button: 'Join the circle' }),
      hero(c, { variant: 'photo-center', photo: '@mist|forest|moss', h: 640, buttons: 2, overlay: 'rgba(8,8,8,0.5)' }),
    ] },
    { slug: 'music', title: 'Music', build: (c) => [
      pageTitle(c, { title: 'Listen', tone: 'surface', align: 'left' }),
      cards(c, { n: 6, cols: 3, kind: 'numbered', tone: 'bg', head: false, cardFill: false }),
      bigList(c, { tone: 'surface', n: 3, size: 48, eyebrow: 'Old songs' }),
    ] },
    { slug: 'tour', title: 'Tour', build: (c) => [
      pageTitle(c, { title: 'On the road', photo: '@stage|light', align: 'left' }),
      eventRows(c, { n: 7, tone: 'bg', heading: 'Moon dates', btn: 'Seats', zebra: '#181818' }),
      reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 1), cols: 3 }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Send a moth' })] },
  ],
};
export default spec;

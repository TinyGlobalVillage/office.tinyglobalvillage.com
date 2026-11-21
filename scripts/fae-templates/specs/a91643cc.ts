// Ref — a DJ's one-person site: white with loud orange blocks, a blue "book" tab, poster-bold heads.
// Kept: split hero (words left, portrait right) · "latest mixes": a picture beside a numbered track list and a
// play-all link · upcoming gigs on a full orange band, each row with a white info button · reviews · a call band.
import { avatarsFor, bottom, button, cards, contact, ctaBand, CW, faq, group, headBlock, hero, image, PAD, pageTitle, reviews, section, shape, stackLast, text, tone, W, type Ctx, type Node, type Section, type TemplateSpec, type Tone } from '../kit.ts';

const grotesk = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** A picture on the left, a numbered track list on the right (each line: number · title · length), a link under it. */
function mixes(ctx: Ctx, o: { tone: Tone; photo: string; heading: string; n: number }): Section {
  const t = tone(ctx, o.tone);
  const hb = headBlock(ctx, t, { heading: o.heading, y: 96, align: 'left' });
  const y = hb.y + 44;
  const pic = image(ctx, { key: o.photo, x: PAD, y, w: 460, h: 460 });
  const lw = CW - 520;
  const kids: Node[] = [];
  let ly = 6;
  for (let i = 0; i < o.n; i++) {
    const mins = 40 + ((i * 17 + ctx.site.seed.length) % 50);
    const line = text(ctx, { text: `${String(i + 1).padStart(2, '0')}  ·  ${mins}:${String((i * 23) % 60).padStart(2, '0')}`, x: 0, y: ly, w: lw, pct: 100, size: 13, color: ctx.pal.accent, weight: 700, track: 1.4, name: 'Number' });
    const title = text(ctx, { slot: 'offering.title', index: i, x: 0, y: bottom(line) + 2, w: lw, pct: 100, size: 20, color: t.head, font: 'head', name: 'Track' });
    const rule = shape(ctx, { x: 0, y: bottom(title) + 14, w: lw, h: 1, pct: 100, fill: t.line, name: 'Rule' });
    kids.push(line, title, rule);
    ly = bottom(rule) + 16;
  }
  const list = group(ctx, { name: 'Tracks', x: PAD + 520, y, w: lw, h: ly, children: kids, flow: { gap: 6, pad: 0 } });
  const play = text(ctx, { text: 'Play the whole set →', x: PAD + 520, y: y + ly + 20, w: 300, size: 15, color: ctx.pal.accent, weight: 700, name: 'Link' });
  const H = Math.max(y + 460, bottom(play)) + 100;
  return section([pic, ...stackLast([list, { ...play, href: '/mixes' }])], H, t.bg);
}

/** Dated rows in three columns (date · title · action) that stack per row on a phone; alternate rows are shaded. */
function eventRows(ctx: Ctx, o: { n: number; tone: Tone; heading: string; btn: string; zebra: string; more?: string }): Section {
  const t = tone(ctx, o.tone);
  const hb = headBlock(ctx, t, { heading: o.heading, y: 96, align: 'left', size: 48 });
  let y = hb.y + 44;
  const cw = CW / 3;
  const cells: Node[] = [];
  let rowH = 88;
  for (let i = 0; i < o.n; i++) {
    const fill = i % 2 === 0 ? o.zebra : undefined;
    const d = text(ctx, { slot: 'event.date', index: i, x: 24, y: 30, w: cw - 48, pct: 86, size: 15, color: o.tone === 'dark' ? t.head : ctx.pal.accent, weight: 700, upper: true, track: 1.4, name: 'Date' });
    const ti = text(ctx, { slot: 'event.title', index: i, x: 24, y: 26, w: cw - 48, pct: 86, size: 21, color: t.head, font: 'head', role: 'h3', name: 'Title' });
    const b = button(ctx, { text: o.btn, href: '/gigs', x: 24, y: 19, w: 130, look: o.tone === 'dark' ? 'light' : 'solid', size: 13 });
    rowH = Math.max(rowH, bottom(ti) + 26);
    for (const [name, kid] of [['Date', d], ['Title', ti], ['Action', b]] as const) cells.push(group(ctx, { name, x: 0, y: 0, w: cw, h: 88, children: [kid], fill, flow: { gap: 8, pad: 22 } }));
  }
  for (const c of cells) c.box.desktop.h = rowH;
  const layers: Node[] = [...hb.nodes, group(ctx, { name: 'Gigs', x: PAD, y, w: CW, h: o.n * rowH, children: cells, layout: { cols: 3, bp: { tablet: 3, mobile: 1 }, gap: 0 } })];
  y += o.n * rowH;
  if (o.more) {
    const m = button(ctx, { text: o.more, href: '/gigs', x: 0, y: y + 44, look: 'dark' });
    m.box.desktop.x = Math.round((W - m.box.desktop.w) / 2);
    layers.push(m);
    y = bottom(m);
  }
  return section(layers, y + 96, t.bg);
}

const spec: TemplateSpec = {
  key: 'a91643cc', ref: 'a91643cc', name: 'Glowmoth Decks', industry: 'artist', category: 'Artist',
  description: 'A fae night-spinner in loud orange: split portrait hero, a mix with its track list, gig nights on an orange band.',
  palette: { bg: '#ffffff', surface: '#fff1e6', ink: '#111111', body: '#333333', muted: '#6b6b6b', accent: '#d9600f', accentInk: '#ffffff', dark: '#f47a2a', darkInk: '#111111', darkBody: 'rgba(17,17,17,0.84)', darkAccent: '#111111', line: 'rgba(17,17,17,0.14)' },
  fonts: { head: grotesk, body: sans, headWeight: 800, headTrack: -0.5, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'name left in orange, a hamburger right; a blue "book" tab fixed on the edge', footer: 'white: name, socials, a booking email' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'split', photo: avatarsFor(c.site, 1)[0], tone: 'bg', h: 680, eyebrow: true, buttons: 1, headSize: 66 }),
      mixes(c, { tone: 'bg', photo: '@stage|light|warm', heading: 'Fresh from the dew deck', n: 4 }),
      eventRows(c, { n: 4, tone: 'dark', heading: 'Where the moth spins next', btn: 'Info', zebra: 'rgba(255,255,255,0.22)', more: 'Every gig' }),
      reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 3), cols: 3 }),
      ctaBand(c, { tone: 'accent', split: true }),
    ] },
    { slug: 'mixes', title: 'Mixes', build: (c) => [
      pageTitle(c, { title: 'Mixes', tone: 'surface', align: 'left' }),
      mixes(c, { tone: 'bg', photo: '@candle|light|mist#2', heading: 'Longer sets', n: 6 }),
      cards(c, { n: 3, cols: 3, kind: 'numbered', tone: 'surface', head: false, cardFill: false }),
    ] },
    { slug: 'gigs', title: 'Gigs', build: (c) => [
      pageTitle(c, { title: 'Gigs', tone: 'dark', align: 'left' }),
      eventRows(c, { n: 8, tone: 'bg', heading: 'Nights ahead', btn: 'Info', zebra: '#fff1e6' }),
    ] },
    { slug: 'book', title: 'Book', build: (c) => [contact(c, { tone: 'bg', heading: 'Bring the moth to your glade' }), faq(c, { n: 4, tone: 'surface' })] },
  ],
};
export default spec;

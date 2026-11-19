// Ref — a music-venue site: charcoal and black, salmon headlines, condensed bold uppercase, a long list of show dates.
// Kept: grey photo hero with words left and an info tab · a black heading band · a charcoal list of dated nights,
// each with a ticket button on the right · a "see more" button · a black stay-in-touch band.
import { bottom, button, centered, contact, ctaBand, CW, faq, group, headBlock, hero, imageStory, PAD, pageTitle, section, stats, text, tone, W, type Ctx, type Node, type Section, type TemplateSpec, type Tone } from '../kit.ts';

const head = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** Dated rows in three columns (date · title · action) that stack per row on a phone; alternate rows are shaded. */
function eventRows(ctx: Ctx, o: { n: number; tone: Tone; heading?: string; btn: string; zebra: string; more?: string }): Section {
  const t = tone(ctx, o.tone);
  const layers: Node[] = [];
  let y = 80;
  if (o.heading) {
    const hb = headBlock(ctx, t, { heading: o.heading, y: 96, align: 'left' });
    layers.push(...hb.nodes);
    y = hb.y + 44;
  }
  const cw = CW / 3;
  const cells: Node[] = [];
  let rowH = 90;
  for (let i = 0; i < o.n; i++) {
    const fill = i % 2 === 0 ? o.zebra : undefined;
    const d = text(ctx, { slot: 'event.date', index: i, x: 24, y: 32, w: cw - 48, pct: 86, size: 15, color: ctx.pal.accent, weight: 700, upper: true, track: 1.6, name: 'Date' });
    const ti = text(ctx, { slot: 'event.title', index: i, x: 24, y: 28, w: cw - 48, pct: 86, size: 22, color: t.head, font: 'head', upper: true, role: 'h3', name: 'Title' });
    const b = button(ctx, { text: o.btn, href: '/shows', x: 24, y: 20, w: 150, look: 'outline', size: 13 });
    rowH = Math.max(rowH, bottom(ti) + 28);
    for (const [name, kid] of [['Date', d], ['Title', ti], ['Action', b]] as const) cells.push(group(ctx, { name, x: 0, y: 0, w: cw, h: 90, children: [kid], fill, flow: { gap: 8, pad: 22 } }));
  }
  for (const c of cells) c.box.desktop.h = rowH;
  layers.push(group(ctx, { name: 'Nights', x: PAD, y, w: CW, h: o.n * rowH, children: cells, layout: { cols: 3, bp: { tablet: 3, mobile: 1 }, gap: 0 } }));
  y += o.n * rowH;
  if (o.more) {
    const m = button(ctx, { text: o.more, href: '/shows', x: 0, y: y + 44, look: 'solid' });
    m.box.desktop.x = Math.round((W - m.box.desktop.w) / 2);
    layers.push(m);
    y = bottom(m);
  }
  return section(layers, y + 90, t.bg);
}

const spec: TemplateSpec = {
  key: 'c7e8dd1f', ref: 'c7e8dd1f', name: 'Toadstool Hall', industry: 'artist', category: 'Artist',
  description: 'A fae music hall under the hill in charcoal and salmon: grey photo hero, a black title band, a long list of nights.',
  palette: { bg: '#3d3d3d', surface: '#2c2c2c', ink: '#ffffff', body: 'rgba(255,255,255,0.78)', muted: '#bdbdbd', accent: '#ff9a7a', accentInk: '#1a1a1a', dark: '#111111', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.76)', darkAccent: '#ff9a7a', line: 'rgba(255,255,255,0.18)' },
  fonts: { head, body: sans, headWeight: 800, headTrack: 0.4, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'black bar: links left, name centred, address right; a slim socials rail on the side', footer: 'black: address, hours, socials, a sign-up line' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: '@stage|light|candle', h: 720, eyebrow: true, buttons: 1, sideNote: true, overlay: 'rgba(20,20,20,0.6)' }),
      centered(c, { tone: 'dark', heading: 'Nights under the hill', slot: 'subhead', size: 52 }),
      eventRows(c, { n: 9, tone: 'bg', btn: 'Seats', zebra: '#474747', more: 'More nights' }),
      ctaBand(c, { tone: 'dark', split: true }),
    ] },
    { slug: 'shows', title: 'Shows', build: (c) => [
      pageTitle(c, { title: 'Every night', photo: '@candle|light|warm', align: 'left' }),
      eventRows(c, { n: 12, tone: 'bg', heading: 'This moon and the next', btn: 'Seats', zebra: '#474747' }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'The hall', tone: 'surface', align: 'left' }),
      imageStory(c, { photo: '@stage|mist|mushroom#2', side: 'right', tone: 'dark', button: true }),
      stats(c, { n: 4, tone: 'surface', boxed: true }),
    ] },
    { slug: 'visit', title: 'Visit', build: (c) => [
      contact(c, { tone: 'bg', heading: 'Find the hill door' }),
      faq(c, { n: 5, tone: 'surface', side: true }),
    ] },
  ],
};
export default spec;

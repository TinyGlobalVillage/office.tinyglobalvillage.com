// Ref — a chef's table: near-black nav, cream strip, a periwinkle band with a giant wordmark, burgundy-black ink,
// beige panels, wide display heads with italic serif touches, oval outline buttons.
// Kept: two photos side by side as the hero with one oval button between · periwinkle band: giant wordmark over a
// large statement · three tall rounded picture cards with labels · beige heading/paragraph split with a pill button ·
// a picture story · reviews · a closing call.
import { avatarsFor, bottom, button, cards, contact, CW, group, ctaBand, faq, image, PAD, pageTitle, reviews, section, splitHeading, imageStory, stackDown, text, tone, W, type Ctx, type Node, type Section, type TemplateSpec, type Tone } from '../kit.ts';

const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

/** Two pictures edge to edge with one light oval button over the seam (on a phone: both pictures, then the button). */
function twinHero(ctx: Ctx, a: string, b: string, h = 640): Section {
  const left = image(ctx, { key: a, x: 0, y: 0, w: W / 2, h });
  const right = image(ctx, { key: b, x: W / 2, y: 0, w: W / 2, h });
  const btn = button(ctx, { slot: 'cta', href: '/contact', x: 0, y: Math.round(h / 2 - 25), w: 220, look: 'light' });
  btn.box.desktop.x = Math.round((W - 220) / 2);
  return section([left, right, btn], h, ctx.pal.surface, 'banner-image-atomic');
}

/** The brand set huge across the band, then one large statement under it. */
function wordmark(ctx: Ctx, t: Tone): Section {
  const tt = tone(ctx, t);
  const nodes: Node[] = [
    text(ctx, { text: ctx.site.brand, x: PAD, y: 0, w: CW, size: 92, color: tt.head, font: 'head', role: 'h1', align: 'center', lh: 1, track: -2, name: 'Wordmark' }),
    text(ctx, { slot: 'about', x: 160, y: 0, w: 880, size: 26, color: tt.body, font: 'head', italic: true, align: 'center', lh: 1.4, name: 'Statement' }),
  ];
  const st = stackDown(nodes, 110, 40);
  return section(st.nodes, st.y + 110, tt.bg);
}

/** Tall, deeply rounded pictures (the reference's arches) with a small label under each, three across. */
function archCards(ctx: Ctx, photos: string[], t: Tone): Section {
  const tt = tone(ctx, t);
  const gap = 32;
  const cw = (CW - gap * 2) / 3;
  const items = photos.map((key, i) => {
    const pic = image(ctx, { key, x: 0, y: 0, w: cw, h: 460, pct: 100, radius: 180 });
    const lab = text(ctx, { slot: 'offering.title', index: i, x: 0, y: 484, w: cw, pct: 100, size: 22, color: tt.head, font: 'head', italic: true, align: 'center', role: 'h3', name: 'Label' });
    return group(ctx, { name: `Arch ${i + 1}`, x: 0, y: 0, w: cw, h: bottom(lab) + 6, children: [pic, lab], flow: { gap: 18, pad: 6 } });
  });
  const h = Math.max(...items.map((g) => g.box.desktop.h));
  for (const g of items) g.box.desktop.h = h;
  return section([group(ctx, { name: 'Arches', x: PAD, y: 100, w: CW, h, children: items, layout: { cols: 3, bp: { tablet: 3, mobile: 1 }, gap } })], h + 200, tt.bg);
}

const spec: TemplateSpec = {
  key: '7a44fec6', ref: '7a44fec6', name: 'Crumbhearth Table', industry: 'bakery', category: 'Bakery',
  description: 'A gnomish bake-table in cream, periwinkle and burgundy-black: twin photo hero, a giant wordmark, three tall loaves.',
  palette: { bg: '#f7f2ea', surface: '#e6ddd1', ink: '#2a0e14', body: '#4d3438', muted: '#8a7570', accent: '#2a0e14', accentInk: '#f7f2ea', dark: '#b8c4e4', darkInk: '#2a0e14', darkBody: 'rgba(42,14,20,0.84)', darkAccent: '#2a0e14', line: 'rgba(42,14,20,0.16)' },
  fonts: { head: serif, body: sans, headWeight: 400, headTrack: -0.5, btnRadius: 999, cardRadius: 24 },
  chrome: { nav: 'near-black bar: italic links left, wordmark centred, basket right; a cream notice strip above', footer: 'burgundy-black: wordmark, hours, address, socials' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      twinHero(c, '@bakery|bread|food', '@bread|bakery|warm#2'),
      wordmark(c, 'dark'),
      archCards(c, ['@food|tea|warm', '@tea|candle|warm', '@bakery|bread|food'], 'bg'),
      splitHeading(c, { tone: 'surface', heading: 'Kneaded under the roots' }),
      imageStory(c, { photo: '@bread|bakery|warm#2', side: 'right', tone: 'bg', eyebrow: true }),
      reviews(c, { n: 3, tone: 'dark', avatars: avatarsFor(c.site, 2), cols: 3 }),
      ctaBand(c, { tone: 'accent', buttons: 1 }),
    ] },
    { slug: 'menu', title: 'Menu', build: (c) => [
      pageTitle(c, { title: 'From the oven', tone: 'dark' }),
      cards(c, { n: 8, cols: 2, kind: 'plain', tone: 'bg', head: false, price: true, cardFill: false }),
      wordmark(c, 'surface'),
    ] },
    { slug: 'events', title: 'Events', build: (c) => [
      pageTitle(c, { title: 'Long-table nights', tone: 'surface' }),
      cards(c, { n: 3, cols: 3, kind: 'numbered', tone: 'bg', head: false, titleSlot: 'event.title', bodySlot: 'event.date' }),
      faq(c, { n: 4, tone: 'surface', side: true }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Book a seat by the oven' })] },
  ],
};
export default spec;

// Ref — a calm mint-and-forest-green wellness label: a full photo hero with the words low on the left, a heading
// beside a three-photo collage, a "the path" heading beside three staggered icon points with a lime button, and a
// deep-green band of journal cards.
// Kept: photo-left hero · heading + 3-photo collage · path heading + staggered icon points · dark journal cards.
import {
  PAD, avatarsFor, badge, bottom, button, cards, contact, faq, group, hOf, hero, image, pageTitle, reviews, section, stackDown, stackLast, team, text, tone,
  GLYPHS, type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';

const serif2 = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** Heading and words on the left, one tall photo and two stacked ones on the right. */
function collage(ctx: Ctx, photos: [string, string, string]): Section {
  const t = tone(ctx, 'bg');
  const st = stackDown([
    text(ctx, { text: 'Cloth that breathes like moss', x: PAD, y: 0, w: 440, size: 40, color: t.head, font: 'head', role: 'h2', name: 'Heading' }),
    text(ctx, { slot: 'paragraph', x: PAD, y: 0, w: 440, size: 16, color: t.body, name: 'Body' }),
  ], 120, 20);
  const a = image(ctx, { key: photos[0], x: 560, y: 90, w: 300, h: 470, radius: 4 });
  const b = image(ctx, { key: photos[1], x: 880, y: 90, w: 260, h: 225, radius: 4 });
  const cimg = image(ctx, { key: photos[2], x: 880, y: 335, w: 260, h: 225, radius: 4 });
  return section([...st.nodes, ...stackLast([a, b, cimg])], Math.max(st.y, bottom(a)) + 90, t.bg);
}

/** Heading + button on the left, three icon points stepping down and right. */
function path(ctx: Ctx): Section {
  const t = tone(ctx, 'surface');
  const st = stackDown([
    text(ctx, { text: '(the path)', x: PAD, y: 0, w: 400, size: 13, color: t.muted, track: 1, name: 'Eyebrow' }),
    text(ctx, { text: 'Three steps through the green', x: PAD, y: 0, w: 420, size: 40, color: t.head, font: 'head', role: 'h2', name: 'Heading' }),
    button(ctx, { slot: 'cta', href: '/shop', x: PAD, y: 0, look: 'solid' }),
  ], 110, [12, 30]);
  const pts: Node[] = [];
  let y = 110;
  for (let i = 0; i < 3; i++) {
    const x = 560 + i * 90;
    const w = 400;
    const kids: Node[] = [
      ...badge(ctx, { x: 0, y: 0, d: 52, glyph: GLYPHS[(i * 3 + 2) % GLYPHS.length], fill: ctx.pal.dark, ink: '#d7f36b' }),
    ];
    const ti = text(ctx, { slot: 'offering.title', index: i, x: 0, y: 66, w, pct: 100, size: 20, color: t.head, font: 'head', role: 'h3', name: 'Point' });
    const bd = text(ctx, { slot: 'offering.body', index: i, x: 0, y: bottom(ti) + 6, w, pct: 100, size: 15, color: t.body, name: 'Point body' });
    kids.push(ti, bd);
    const g = group(ctx, { name: `Point ${i + 1}`, x, y, w, h: bottom(bd), children: kids, flow: { gap: 10, pad: 0 } });
    pts.push(g);
    y += hOf(g) + 40;
  }
  return section([...st.nodes, ...pts], Math.max(st.y, y - 40) + 110, t.bg);
}

const spec: TemplateSpec = {
  key: '54df5609', ref: '54df5609', name: 'Mossmere Weavers', industry: 'fashion', category: 'Fashion',
  description: 'A slow gnome weaving house in mint and deep forest green: soft light serif headings, a photo collage and a path of three quiet steps.',
  palette: { bg: '#eef5f0', surface: '#e2eee6', ink: '#0b3a2e', body: '#355a4f', muted: '#6c8a80', accent: '#0b3a2e', accentInk: '#ffffff', dark: '#0b3a2e', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.82)', darkAccent: '#d7f36b', line: 'rgba(11,58,46,0.14)' },
  fonts: { head: serif2, body: sans, headWeight: 400, headTrack: -0.6, btnRadius: 999, btnUpper: false, cardRadius: 10 },
  chrome: { nav: 'transparent over the hero: wordmark left, links centre, lime pill button right', footer: 'deep green, big wordmark, link columns, newsletter' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: '@moss|forest', h: 680, buttons: 1, overlay: 'rgba(11,58,46,0.42)', headSize: 60 }),
      collage(c, ['@fabric|craft', '@garden|flowers', '@mushroom|nature']),
      path(c),
      cards(c, { n: 3, cols: 3, kind: 'plain', tone: 'dark', titleSlot: 'post.title', bodySlot: 'post.excerpt', link: '/journal', head: { eyebrow: '(from the loom)', heading: 'Notes from the mere', align: 'left' } }),
    ] },
    { slug: 'shop', title: 'Shop', build: (c) => [
      pageTitle(c, { title: 'Woven goods', tone: 'surface', align: 'left' }),
      cards(c, { n: 6, cols: 3, kind: 'price-row', tone: 'bg', head: false }),
      faq(c, { n: 4, tone: 'surface', side: true }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'The weavers of the mere', tone: 'dark', intro: true }),
      team(c, { n: 4, avatars: avatarsFor(c.site, 0), tone: 'bg', ring: '#d7f36b' }),
      reviews(c, { n: 2, tone: 'surface', avatars: avatarsFor(c.site, 2), cols: 2, big: true }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'surface' })] },
  ],
};
export default spec;

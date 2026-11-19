// Ref — clean white activewear shop: grotesk type, black buttons, a full-bleed photo hero and a dark film band.
// Kept: full photo hero with centred headline · "top picks" eyebrow + two filter tabs + four ware cards with
// little badges + black "see all" button · picture collage left with eyebrow, heading, words and two black buttons
// right · dark picture band with a big headline and an outline button · one centred mission line.
import { button, centered, contact, ctaBand, faq, group, headBlock, hero, image, pageTitle, reviews, section, shape, stackDown, stackLast, steps, team, text, tone, avatarsFor, bottom, GLYPHS, CW, PAD, W, type Ctx, type Node, type Section, type TemplateSpec } from '../kit.ts';
const grot = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** Top picks (the kit has no product card or tabs): a heading, two filter tabs, four drawn ware tiles — some with a
 *  small badge — with name and price, then a black "see all" button. */
function topPicks(c: Ctx, n: number, tabs: string[] | null, badges: Array<string | null>) {
  const t = tone(c, 'bg');
  const layers: Node[] = [];
  const hb = headBlock(c, t, { eyebrow: 'Top picks', heading: 'Made for the long way round', y: 90 });
  layers.push(...hb.nodes);
  let y = hb.y + 30;
  if (tabs) {
    const pw = 130;
    const gw = tabs.length * pw + (tabs.length - 1) * 10;
    layers.push(group(c, { name: 'Tabs', x: (W - gw) / 2, y, w: gw, h: 44, children: tabs.map((p, i) => button(c, { text: p, href: '/shop', x: 0, y: 0, w: pw, size: 13, look: i === 0 ? 'dark' : 'outline' })), layout: { cols: tabs.length, bp: { tablet: tabs.length, mobile: tabs.length }, gap: 10 } }));
    y += 50 + 36;
  } else y += 10;
  const gap = 20;
  const cellW = (CW - gap * 3) / 4;
  const th = Math.round(cellW * 1.2);
  const tints = ['#efefec', '#e7e8e4', '#f0eeea', '#e5e6e2'];
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < n; i++) {
    const tileKids: Node[] = [
      shape(c, { x: 0, y: 0, w: cellW, h: th, pct: 100, fill: tints[i % tints.length], name: 'Tile' }),
      text(c, { text: GLYPHS[(i * 7 + 3) % GLYPHS.length], x: 0, y: th / 2 - 42, w: cellW, pct: 100, size: 64, color: '#111111', align: 'center', lh: 1.2, name: 'Ware' }),
    ];
    const bd = badges[i % badges.length];
    if (bd) {
      const bw = bd.length * 8 + 30;
      tileKids.push(group(c, { name: 'Badge', x: 12, y: 12, w: bw, h: 26, fill: '#111111', radius: 13, children: [
        text(c, { text: bd, x: 0, y: 5, w: bw, pct: 100, size: 11, color: '#ffffff', weight: 700, upper: true, track: 1, align: 'center', lh: 1.4, name: 'Badge words' }),
      ] }));
    }
    const tile = group(c, { name: 'Picture', x: 0, y: 0, w: cellW, h: th, pct: 100, children: tileKids });
    const ti = text(c, { slot: 'offering.title', x: 0, y: th + 14, w: cellW, pct: 100, size: 16, color: t.head, font: 'head', role: 'h3', name: 'Name' });
    const pr = text(c, { slot: 'offering.price', x: 0, y: bottom(ti) + 4, w: cellW, pct: 100, size: 15, color: t.body, name: 'Price' });
    maxH = Math.max(maxH, bottom(pr) + 6);
    items.push(group(c, { name: `Ware ${i + 1}`, x: 0, y: 0, w: cellW, h: bottom(pr) + 6, children: [tile, ti, pr], flow: { gap: 8, pad: 6 } }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const rows = Math.ceil(n / 4);
  const gh = rows * maxH + (rows - 1) * gap;
  layers.push(group(c, { name: 'Wares', x: PAD, y, w: CW, h: gh, children: items, layout: { cols: 4, bp: { tablet: 2, mobile: 2 }, gap } }));
  const b = button(c, { slot: 'cta', href: '/shop', x: 0, y: y + gh + 44, look: 'dark' });
  b.box.desktop.x = Math.round((W - b.box.desktop.w) / 2);
  layers.push(b);
  return section(layers, bottom(b) + 90, t.bg);
}

/** A collage of pictures on the left (two photos + a drawn portrait), words and two black buttons on the right. */
function collage(c: Ctx, photos: [string, string]) {
  const t = tone(c, 'surface');
  const tx = 680;
  const tw = W - PAD - tx;
  const st = stackDown([
    text(c, { slot: 'eyebrow', x: tx, y: 0, w: tw, size: 13, color: t.muted, weight: 600, upper: true, track: 2, name: 'Eyebrow' }),
    text(c, { slot: 'headline', x: tx, y: 0, w: tw, size: 40, color: t.head, font: 'head', name: 'Heading' }),
    text(c, { slot: 'about', x: tx, y: 0, w: tw, size: 16, color: t.body, name: 'Paragraph' }),
  ], 0, [12, 20]);
  const H = Math.max(st.y + 50 + 30 + 220, 640);
  const off = Math.round((H - (st.y + 80)) / 2);
  for (const n of st.nodes) n.box.desktop.y += off;
  const by = st.y + off + 30;
  const b1 = button(c, { text: 'For the trail', href: '/shop', x: tx, y: by, w: 180, look: 'dark' });
  const b2 = button(c, { text: 'For the glade', href: '/shop', x: tx + 194, y: by, w: 180, look: 'dark' });
  const pics = stackLast([
    image(c, { key: photos[0], x: PAD, y: 70, w: 300, h: H - 230 }),
    image(c, { key: photos[1], x: PAD + 320, y: 150, w: 260, h: H - 300 }),
    image(c, { key: avatarsFor(c.site, 2)[0], x: PAD + 320, y: H - 140, w: 120, h: 90 }),
  ]);
  return section([...st.nodes, b1, b2, ...pics], H, t.bg);
}

const spec: TemplateSpec = {
  key: '47101e78', ref: '47101e78', name: 'Swiftroot Wear', industry: 'ecommerce', category: 'Ecommerce',
  description: 'An elven running-wear shop in clean white and black: a full photo hero, badged top picks, a picture collage, a dark film band.',
  palette: { bg: '#ffffff', surface: '#f3f3f1', ink: '#111111', body: '#454545', muted: '#767676', accent: '#111111', accentInk: '#ffffff', dark: '#161616', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.82)', darkAccent: '#ffffff', line: 'rgba(17,17,17,0.14)' },
  fonts: { head: grot, body: sans, headWeight: 600, headTrack: -0.5, btnRadius: 0, btnUpper: false, cardRadius: 0 },
  chrome: { nav: 'black notice bar; transparent over the hero: boxed wordmark left, links centre, search + basket right', footer: 'white, newsletter row then four link columns' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-center', photo: '@forest|mist', h: 720, buttons: 1, headSize: 66, overlay: 'rgba(10,10,10,0.35)' }),
      topPicks(c, 4, ['Wanderers', 'Sprinters'], ['Most loved', null, 'Sale', 'Gone till spring']),
      collage(c, ['@moss|nature', '@mushroom|moss']),
      ctaBand(c, { tone: 'dark', photo: '@nature|landscape' }),
      centered(c, { tone: 'bg', headSlot: 'mission', slot: 'tagline', size: 30 }),
    ] },
    { slug: 'shop', title: 'Shop', build: (c) => [
      pageTitle(c, { title: 'Shop', tone: 'surface', align: 'left' }),
      topPicks(c, 8, null, [null, 'New', null, null, 'Sale']),
      faq(c, { n: 4, tone: 'surface', head: { heading: 'Sizes and swaps' } }),
    ] },
    { slug: 'story', title: 'Our story', build: (c) => [
      pageTitle(c, { title: 'Our story', tone: 'bg' }),
      steps(c, { n: 3, tone: 'surface', head: { heading: 'From thread to trail' } }),
      team(c, { n: 4, avatars: avatarsFor(c.site, 0), tone: 'bg', head: { heading: 'The runners behind it' } }),
      reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 3) }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Find the shop' })] },
  ],
};
export default spec;

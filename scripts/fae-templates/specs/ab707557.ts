// Ref — a stylist's portfolio on pale grey with acid lime and black: a full photo hero with one huge centred
// name, a collage (tall photo left, round photo top right, arched photo low right) around a centred call to
// see the work, an "about me" with a round portrait and a right-aligned paragraph.
// Kept: photo hero, huge centred headline · photo collage around a centred heading + button · round-portrait about.
import { avatarsFor, button, cards, contact, ctaBand, hero, image, pageTitle, reviews, section, stackDown, stackLast, text, tone, W, PAD, type Ctx, type Node, type Section, type TemplateSpec } from '../kit.ts';
const sans = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

/** Three pictures (tall, round, arched) scattered around a centred heading and one button. */
function collage(c: Ctx): Section {
  const t = tone(c, 'bg');
  const H = 900;
  const head = text(c, { text: 'Come and see the work', x: 330, y: 0, w: 540, size: 54, color: t.head, font: 'head', weight: 600, upper: true, align: 'center', lh: 1.1, name: 'Heading' });
  const b = button(c, { slot: 'cta', href: '/portfolio', x: 0, y: 0, look: 'solid' });
  const st = stackDown([head, b], 0, 36);
  const top = (H - st.y) / 2;
  for (const n of st.nodes) n.box.desktop.y += Math.round(top);
  b.box.desktop.x = Math.round((W - b.box.desktop.w) / 2);
  const pics: Node[] = [
    image(c, { key: '@flowers|nature', x: 0, y: 120, w: 400, h: 700 }),
    image(c, { key: '@light|warm', x: W - PAD - 280, y: 0, w: 280, h: 280, circle: true }),
    image(c, { key: '@art|craft|moss', x: W - PAD - 340, y: 560, w: 220, h: 320, radius: 110 }),
  ];
  return section([...st.nodes, ...stackLast(pics)], H, t.bg);
}

/** A round portrait on the left, the maker's words right-aligned beside it. */
function aboutRound(c: Ctx, portrait: string): Section {
  const t = tone(c, 'bg');
  const nodes: Node[] = [
    text(c, { text: 'About the maker', x: 560, y: 0, w: 560, size: 50, color: t.head, font: 'head', weight: 600, upper: true, align: 'right', lh: 1.05, name: 'Heading' }),
    text(c, { slot: 'about', x: 640, y: 0, w: 480, size: 16, color: t.body, align: 'right', name: 'Paragraph' }),
  ];
  const b = button(c, { slot: 'cta', href: '/about', x: 0, y: 0, look: 'solid' });
  nodes.push(b);
  const st = stackDown(nodes, 130, [22, 30]);
  b.box.desktop.x = W - PAD - b.box.desktop.w;
  const H = Math.max(st.y + 120, 640);
  const pic = image(c, { key: portrait, x: PAD + 20, y: (H - 420) / 2, w: 420, h: 420, circle: true });
  return section([pic, ...st.nodes], H, t.bg);
}

const spec: TemplateSpec = {
  key: 'ab707557', ref: 'ab707557', name: 'Wren Emberwing', industry: 'agency', category: 'Agency',
  description: 'One faerie stylist’s portfolio in mist grey, black and acid lime: a huge-name hero, a scattered collage, a round portrait.',
  palette: { bg: '#ebecee', surface: '#f7f7f8', ink: '#111111', body: '#3a3a3d', muted: '#6e6e74', accent: '#111111', accentInk: '#d6f03c', dark: '#111111', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', darkAccent: '#d6f03c', line: 'rgba(17,17,17,0.12)' },
  fonts: { head: sans, body: sans, headWeight: 500, headTrack: 0.5, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'transparent over the hero: links left, brand centred, socials + outlined CTA right', footer: 'pale grey, centred brand, socials' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-center', photo: '@fabric|light|warm', h: 600, buttons: 1, headSize: 82, overlay: 'rgba(20,24,8,0.34)' }),
      collage(c),
      aboutRound(c, avatarsFor(c.site, 1)[0]),
      reviews(c, { n: 2, cols: 2, tone: 'surface', big: true, head: false }),
    ] },
    { slug: 'services', title: 'Services', build: (c) => [
      pageTitle(c, { title: 'Services', tone: 'bg' }),
      cards(c, { n: 3, cols: 3, kind: 'numbered', tone: 'bg', price: true, link: '/contact' }),
      ctaBand(c, { tone: 'dark', buttons: 1 }),
    ] },
    { slug: 'portfolio', title: 'Portfolio', build: (c) => [
      pageTitle(c, { title: 'Portfolio', tone: 'surface' }),
      cards(c, { n: 4, cols: 2, kind: 'photo', tone: 'bg', cardFill: false, photos: ['@flowers|nature', '@light|warm', '@art|craft|moss', '@fabric|light|warm'], head: false, imgH: 460 }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Say hello' })] },
  ],
};
export default spec;

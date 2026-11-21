// Ref — a slow-movement studio: off-white and taupe, a tall Didone serif set in capitals, square black buttons.
// Kept: a thin announcement strip · hero of two overlapping pictures left and a huge capitalised title right with
// a "by" line · a centred capitalised statement · three picture cards with capital titles and black buttons ·
// taupe band with the name set huge across it, then "hello" heading, paragraph, two buttons left + a framed picture right.
import {
  CW, PAD, avatarsFor, bottom, button, cards, centered, contact, faq, image, pageTitle, pricing, reviews, section, stackDown, stackLast, steps, team, text, tone,
  type Ctx, type Section, type TemplateSpec,
} from '../kit.ts';

const didone = "'Didot', 'Bodoni 72', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif";
const helv = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const A = '@moss|nature';
const B = '@candle|warm';
const C = '@tea|mushroom';
const FRAME = '@garden|forest';

/** A thin dark strip with one centred line (the reference's announcement bar). */
function strip(c: Ctx): Section {
  const line = text(c, { slot: 'newsletter', x: 160, y: 14, w: 880, size: 13, color: c.pal.darkInk, align: 'center', upper: true, track: 1.4, lh: 1.4, name: 'Notice' });
  return section([line], bottom(line) + 14, c.pal.dark);
}

/** Two overlapping pictures on the left; a huge capitalised title and a "by" line on the right. */
function twinHero(c: Ctx): Section {
  const t = tone(c, 'bg');
  const back = image(c, { key: A, x: PAD, y: 70, w: 340, h: 460 });
  const front = image(c, { key: B, x: PAD + 220, y: 230, w: 300, h: 400 });
  const st = stackDown([
    text(c, { slot: 'headline', x: 640, y: 0, w: 500, size: 64, color: t.ink, font: 'head', role: 'h1', upper: true, lh: 1.02, name: 'Headline' }),
    text(c, { text: 'by the hearth-keepers', x: 640, y: 0, w: 500, size: 16, color: t.muted, italic: true, name: 'By line' }),
    button(c, { href: '/classes', x: 640, y: 0, look: 'dark' }),
  ], 170, [22, 30]);
  return section([...st.nodes, ...stackLast([back, front])], Math.max(bottom(front), st.y) + 90, t.bg, 'banner-image-atomic');
}

/** Taupe band: the studio's name set huge across the top, then words + buttons left and a framed picture right. */
function nameBand(c: Ctx): Section {
  const t = tone(c, 'surface');
  const big = text(c, { slot: 'brand', x: PAD, y: 60, w: CW, size: 110, color: 'rgba(255,255,255,0.75)', font: 'head', upper: true, align: 'center', lh: 1, name: 'Big name' });
  const left = stackDown([
    text(c, { text: 'Well met, wanderer', x: PAD, y: 0, w: 480, size: 40, color: t.ink, font: 'head', name: 'Heading' }),
    text(c, { slot: 'about', x: PAD, y: 0, w: 480, size: 16, color: t.body, name: 'Paragraph' }),
    button(c, { slot: 'cta', href: '/about', x: PAD, y: 0, look: 'dark' }),
    button(c, { href: '/contact', x: PAD, y: 0, look: 'outline' }),
  ], bottom(big) + 70, [20, 30, 12]);
  const pic = image(c, { key: FRAME, x: 660, y: bottom(big) + 60, w: 420, h: 520 });
  const frame = { ...pic, style: { color: { border: '#ffffff', borderWidth: 10 } } };
  return section([big, ...left.nodes, ...stackLast([frame])], Math.max(left.y, bottom(pic)) + 100, t.bg);
}

const spec: TemplateSpec = {
  key: '25094b99',
  ref: '25094b99',
  name: 'Hearthstill Grove',
  industry: 'coach',
  category: 'Coach',
  description: 'A hushed faerie stillness-studio in off-white and taupe: towering capitals, twin overlapping pictures, the name writ huge.',
  palette: {
    bg: '#f8f6f2',
    surface: '#d8cec7',
    ink: '#151311',
    body: '#45403b',
    muted: '#857b72',
    accent: '#151311',
    accentInk: '#f8f6f2',
    dark: '#151311',
    darkInk: '#f8f6f2',
    darkBody: 'rgba(248,246,242,0.82)',
    darkAccent: '#d8cec7',
    line: 'rgba(21,19,17,0.16)',
  },
  fonts: { head: didone, body: helv, headWeight: 400, headTrack: 0.5, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'announcement strip on top; serif wordmark left, capital links, socials, black CTA block right', footer: 'taupe band: wordmark, links, socials, small print' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        strip(c),
        twinHero(c),
        centered(c, { tone: 'bg', heading: 'Breathe slow as the old oaks do', size: 34 }),
        cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', photos: [A, B, C], head: false, cardFill: false, imgH: 380, button: true }),
        nameBand(c),
      ],
    },
    {
      slug: 'classes',
      title: 'Classes',
      build: (c) => [pageTitle(c, { title: 'Classes', tone: 'surface' }), steps(c, { n: 3, tone: 'bg' }), pricing(c, { n: 3, tone: 'surface' })],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'About the grove', tone: 'bg' }),
        team(c, { n: 3, avatars: avatarsFor(c.site, 5), tone: 'surface', bio: true, head: false }),
        reviews(c, { n: 2, cols: 2, tone: 'bg', big: true }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'surface', heading: 'Find the grove' }), faq(c, { n: 4, tone: 'bg' })],
    },
  ],
};
export default spec;

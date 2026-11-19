// Ref — a moss-green boutique frame: an inset photo with a serif title over it, a dusty-rose band, quiet outline buttons.
// Kept: inset photo hero with centred serif title · rose band with a white card laid over a photo · full-bleed photo band ·
// a short centred closing note.
import {
  bottom, button, cards, centered, contact, faq, group, image, imageStory, PAD, pageTitle, photoBand, reviews, section,
  stackDown, team, text, tone, avatarsFor, W, type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';

const serif = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** A photo set inside the green frame, the shop's title centred on it. */
function insetHero(c: Ctx, photo: string): Section {
  const t = tone(c, 'dark');
  const ih = 600;
  const pic = image(c, { key: photo, x: PAD, y: 30, w: W - PAD * 2, h: ih });
  const head = text(c, { slot: 'headline', x: 200, y: 0, w: 800, size: 64, color: '#ffffff', font: 'head', align: 'center', role: 'h1', lh: 1.1, name: 'Headline' });
  const sub = text(c, { slot: 'tagline', x: 300, y: 0, w: 600, size: 17, color: 'rgba(255,255,255,0.9)', align: 'center', name: 'Tagline' });
  const st = stackDown([head, sub], 0, 16);
  const off = 30 + (ih - st.y) / 2;
  for (const n of st.nodes) n.box.desktop.y += off;
  return section([pic, ...st.nodes], ih + 90, t.bg);
}

/** A rose band: a photo on the left, a white card laid over its right edge with centred words and an outline button. */
function roseOverlap(c: Ctx, photo: string): Section {
  const t = tone(c, 'accent');
  const pic = image(c, { key: photo, x: PAD + 40, y: 90, w: 540, h: 520 });
  const cw = 520;
  const cx = 560;
  const kids: Node[] = [];
  const h = text(c, { slot: 'headline', x: 50, y: 0, w: cw - 100, pct: 80, size: 34, color: c.pal.ink, font: 'head', align: 'center', name: 'Heading' });
  const p = text(c, { slot: 'about', x: 50, y: 0, w: cw - 100, pct: 80, size: 16, color: c.pal.body, align: 'center', name: 'Paragraph' });
  const st = stackDown([h, p], 56, 18);
  const b = button(c, { slot: 'cta', href: '/about', x: 0, y: st.y + 30, look: 'outline' });
  b.box.desktop.x = Math.round((cw - b.box.desktop.w) / 2);
  kids.push(...st.nodes, b);
  const ch = bottom(b) + 56;
  const cy = 90 + Math.max(40, (520 - ch) / 2);
  const g = group(c, { name: 'Story card', x: cx, y: cy, w: cw, h: ch, children: kids, fill: '#ffffff', flow: { gap: 18, pad: 40 } });
  return section([pic, g], Math.max(90 + 520, cy + ch) + 90, t.bg);
}


const spec: TemplateSpec = {
  key: '5ec4f011',
  ref: '5ec4f011',
  name: 'Thistledown Finery',
  industry: 'agency',
  category: 'Agency',
  description: 'An old elven finery house in moss and rose: a framed photo title, a white card laid over a picture, one wide band.',
  palette: {
    bg: '#f7f2ee', surface: '#efe4dd', ink: '#2a2622', body: '#5a524b', muted: '#8a8078',
    accent: '#a8746c', accentInk: '#ffffff', dark: '#2f3a2c', darkInk: '#f4efe6', darkBody: 'rgba(244,239,230,0.8)', darkAccent: '#f4efe6',
    line: '#e2d6cd',
  },
  fonts: { head: serif, body: sans, headWeight: 400, headTrack: 0.5, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'moss-green bar: centred serif wordmark, links split either side', footer: 'moss-green: wordmark, address, socials centred' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        insetHero(c, '@fabric|jewelry'),
        roseOverlap(c, '@interior|warm'),
        photoBand(c, { photo: '@candle|light', tone: 'bg', h: 560, inset: false }),
        centered(c, { tone: 'bg', eyebrow: true, button: true }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'Our little house', tone: 'dark' }),
        imageStory(c, { photo: '@interior|warm', side: 'right', tone: 'bg', inset: true }),
        team(c, { n: 3, avatars: avatarsFor(c.site, 2), tone: 'surface', head: { heading: 'Keepers of the rail' } }),
      ],
    },
    {
      slug: 'inventory',
      title: 'Inventory',
      build: (c) => [
        pageTitle(c, { title: 'On the rail', tone: 'surface', intro: true }),
        cards(c, { n: 6, cols: 2, kind: 'price-row', tone: 'bg', head: false }),
        reviews(c, { n: 2, tone: 'surface', head: false, big: true }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', photo: '@fabric|jewelry', heading: 'Ring the shop bell' }), faq(c, { n: 4, tone: 'surface' })],
    },
  ],
};
export default spec;

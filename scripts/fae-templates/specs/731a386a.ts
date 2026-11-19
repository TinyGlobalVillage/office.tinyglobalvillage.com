// Ref — a rust-and-greige interiors studio: dark photo hero with a stacked serif name on the left, centred logo nav.
// Kept: photo hero (words left) · rust band with a centred capital line, a wide inset picture and one button ·
// two big underlined links side by side · a giant wordmark filling the foot.
import { avatarsFor, button, cards, contact, group, hero, image, imageStory, pageTitle, section, shape, splitHeading, stackDown, team, text, CW, PAD, W, type Ctx, type TemplateSpec } from '../kit.ts';
const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** Rust band: a capital line, a wide picture, a button — all centred. */
function showcase(c: Ctx, photo: string) {
  const ink = c.pal.accentInk;
  const line = text(c, { text: 'Rooms grown around your days…', x: 200, y: 0, w: 800, size: 28, color: ink, font: 'head', upper: true, align: 'center', name: 'Line' });
  const img = image(c, { key: photo, x: PAD, y: 0, w: CW, h: 380 });
  const b = button(c, { text: 'Wander the rooms', href: '/spaces', x: 0, y: 0, look: 'light', size: 13 });
  b.box.desktop.x = Math.round((W - b.box.desktop.w) / 2);
  const st = stackDown([line, img, b], 90, [44, 44]);
  return section(st.nodes, st.y + 90, c.pal.accent);
}

/** Two big serif links side by side, each underlined with a hairline. */
function bigLinks(c: Ctx) {
  const links: Array<[string, string]> = [['About the nook', '/about'], ['Come say hello', '/contact']];
  const cellW = (CW - 80) / 2;
  const items = links.map(([label, href]) => {
    const t = { ...text(c, { text: label, x: 0, y: 0, w: cellW, pct: 100, size: 46, color: c.pal.accent, font: 'head', align: 'center', lh: 1.15, name: 'Link' }), href };
    const rule = shape(c, { x: 0, y: t.box.desktop.h + 12, w: cellW, pct: 100, h: 1, fill: c.pal.accent, name: 'Underline' });
    return group(c, { name: label, x: 0, y: 0, w: cellW, h: t.box.desktop.h + 13, children: [t, rule] });
  });
  const h = Math.max(...items.map((i) => i.box.desktop.h));
  const g = group(c, { name: 'Big links', x: PAD, y: 80, w: CW, h, children: items, layout: { cols: 2, bp: { tablet: 2, mobile: 1 }, gap: 80 } });
  return section([g], h + 160, c.pal.bg);
}

/** A giant wordmark across the foot of the page. */
function wordmark(c: Ctx) {
  const t = text(c, { text: 'NOOK', x: PAD, y: 40, w: CW, size: 230, color: c.pal.accent, font: 'head', weight: 700, align: 'center', lh: 1, name: 'Wordmark' });
  return section([t], t.box.desktop.h + 80, c.pal.bg);
}

const spec: TemplateSpec = {
  key: '731a386a', ref: '731a386a', name: 'Ember Nook', industry: 'architecture', category: 'Architecture',
  description: 'An elven room-shaper in rust and warm greige: dark photo hero, a rust showcase band, a giant wordmark at the foot.',
  palette: { bg: '#dcd5d0', surface: '#e8e2dd', ink: '#2a2420', body: '#4f4540', muted: '#8a7a70', accent: '#a0562a', accentInk: '#f5ece6', dark: '#3a3532', darkInk: '#f5ece6', darkBody: 'rgba(245,236,230,0.8)', darkAccent: '#e7c3a8', line: 'rgba(160,86,42,0.3)' },
  fonts: { head: serif, body: sans, headWeight: 400, btnRadius: 4, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'links left, serif wordmark centred, socials + pale CTA right — over the dark hero', footer: 'underlined link row + socials, then a giant rust wordmark and fine print' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: '@interior|candle', h: 620, buttons: 1, overlay: 'rgba(30,26,24,0.5)', headSize: 56 }),
      showcase(c, '@warm|light'),
      bigLinks(c),
      wordmark(c),
    ] },
    { slug: 'spaces', title: 'Spaces', build: (c) => [
      pageTitle(c, { title: 'Spaces', tone: 'dark' }),
      cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', photos: ['@interior|candle', '@warm|light', '@study|books'], head: false, cardFill: false, imgH: 380 }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About the nook', tone: 'surface' }),
      splitHeading(c, { tone: 'bg', paras: 2 }),
      imageStory(c, { photo: '@study|books', side: 'left', tone: 'dark' }),
      team(c, { n: 2, avatars: avatarsFor(c.site, 4), tone: 'bg', bio: true, head: { heading: 'The two who shape the rooms' } }),
    ] },
    { slug: 'connect', title: 'Connect', build: (c) => [contact(c, { tone: 'bg', heading: 'Come say hello' }), wordmark(c)] },
  ],
};
export default spec;

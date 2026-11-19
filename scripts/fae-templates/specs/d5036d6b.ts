// Ref — a warm off-white beauty-and-style studio in deep plum: a centred photo hero, a centred about paragraph framed
// by two round portraits, a centred services heading over an open list with an outline pill button, and a band
// split between a photo and a solid plum block.
// Kept: photo-centre hero · centred about w/ side portraits · services list + button · photo / plum split band.
import {
  W, avatarsFor, bottom, button, cards, contact, faq, hero, image, imageStory, pageTitle, pricing, reviews, section, stackDown, stackLast, team, text, tone,
  type Ctx, type Section, type TemplateSpec,
} from '../kit.ts';

const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const avenir = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

/** Centred about paragraph with a round portrait on each side (portraits go after the words on phones). */
function aboutRing(ctx: Ctx): Section {
  const t = tone(ctx, 'bg');
  const av = avatarsFor(ctx.site, 1);
  const cw = 620;
  const cx = (W - cw) / 2;
  const st = stackDown([
    text(ctx, { text: '(who tends the studio)', x: cx, y: 0, w: cw, size: 13, color: ctx.pal.accent, align: 'center', track: 1, name: 'Eyebrow' }),
    text(ctx, { slot: 'about', x: cx, y: 0, w: cw, size: 26, color: t.head, font: 'head', align: 'center', lh: 1.35, name: 'About' }),
    button(ctx, { text: 'Meet the sisters', href: '/about', x: (W - 200) / 2, y: 0, w: 200, look: 'outline' }),
  ], 110, [20, 34]);
  const mid = Math.round((110 + st.y) / 2);
  const l = image(ctx, { key: av[0], x: 60, y: mid - 150, w: 150, h: 150, circle: true });
  const r = image(ctx, { key: av[1], x: W - 210, y: mid + 10, w: 150, h: 150, circle: true });
  return section([...st.nodes, ...stackLast([l, r])], Math.max(st.y, bottom(r)) + 110, t.bg);
}

const spec: TemplateSpec = {
  key: 'd5036d6b', ref: 'd5036d6b', name: 'Plumbrook Glamourie', industry: 'fashion', category: 'Fashion',
  description: 'A plum-and-cream faerie glamour studio: centred and graceful, with whispered (bracketed) labels, round portraits and an open list of services.',
  palette: { bg: '#f6f3f1', surface: '#efe6e6', ink: '#3d0221', body: '#5b3a47', muted: '#8f7480', accent: '#5a0230', accentInk: '#ffffff', dark: '#5a0230', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.84)', darkAccent: '#f6c7dc', line: 'rgba(90,2,48,0.16)' },
  fonts: { head: serif, body: avenir, headWeight: 700, headTrack: -0.8, btnRadius: 999, btnUpper: false, cardRadius: 18 },
  chrome: { nav: 'off-white bar: wordmark left, links right, outline pill button', footer: 'plum block, big wordmark + links + socials' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-center', photo: '@flowers|garden', h: 660, eyebrow: '(a glamourie by the brook)', buttons: 1, overlay: 'rgba(61,2,33,0.42)', headSize: 64 }),
      aboutRing(c),
      faq(c, { n: 5, tone: 'surface', side: false, head: { eyebrow: '(what we weave)', heading: 'Glamours on offer', align: 'center' } }),
      imageStory(c, { photo: '@candle|light', side: 'left', tone: 'dark', button: true, heading: 'Sit a while by the brook' }),
    ] },
    { slug: 'services', title: 'Services', build: (c) => [
      pageTitle(c, { title: 'Glamours & fittings', tone: 'surface', intro: true }),
      cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'bg', head: false, cardFill: true }),
      pricing(c, { n: 3, tone: 'surface', head: { eyebrow: '(the price of a glamour)', heading: 'Choose your spell', align: 'center' } }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'The plumbrook sisters', tone: 'dark' }),
      team(c, { n: 3, avatars: avatarsFor(c.site, 0), tone: 'bg', bio: true, ring: '#f6c7dc' }),
      reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 3), cols: 3 }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg' })] },
  ],
};
export default spec;

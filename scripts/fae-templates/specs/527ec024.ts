// Ref — cream and olive heirloom studio: thin serif, a split hero, an olive tagline band, rounded service pictures.
// Kept: split hero (picture left half, words + olive button right) · olive band with one centred italic line · three
// rounded service picture cards + button · dark running ribbon · centred heading + two paragraphs flanked by pictures ·
// a row of journal cards.
import { avatarsFor, cards, contact, image, imageStory, pageTitle, posts, section, stackDown, stackLast, steps, team, text, faq, W, PAD, type Ctx, type TemplateSpec } from '../kit.ts';
const serif = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const work = ['@craft|studio', '@candle|warm', '@library|books'];

/** One italic line on the olive band. */
function taglineBand(c: Ctx) {
  const t = text(c, { slot: 'tagline', x: 200, y: 64, w: 800, size: 30, color: c.pal.accentInk, font: 'head', italic: true, align: 'center', name: 'Tagline' });
  return section([t], t.box.desktop.h + 128, c.pal.accent);
}

/** The dark ribbon: our crafts in one running line. */
function ribbon(c: Ctx) {
  const t = text(c, { text: 'Banners  ✦  Rune-marks  ✦  Signposts  ✦  Heralds  ✦  Scrolls  ✦  Banners', x: 0, y: 26, w: W, size: 22, color: c.pal.darkInk, font: 'head', upper: true, track: 3, align: 'center', lh: 1.3, name: 'Ribbon' });
  return section([t], t.box.desktop.h + 52, c.pal.dark);
}

/** A centred heading and two paragraphs with a drawn portrait on either side. */
function flanked(c: Ctx) {
  const av = avatarsFor(c.site, 2);
  const st = stackDown([
    text(c, { text: 'Made to be handed down', x: 380, y: 0, w: 440, size: 38, color: c.pal.ink, font: 'head', align: 'center', name: 'Heading' }),
    text(c, { slot: 'about', x: 380, y: 0, w: 440, size: 16, color: c.pal.body, align: 'center', name: 'Paragraph' }),
    text(c, { slot: 'mission', x: 380, y: 0, w: 440, size: 16, color: c.pal.body, align: 'center', name: 'Paragraph' }),
  ], 110, [22, 16]);
  const H = Math.max(st.y + 110, 560);
  const r = c.fonts.cardRadius ?? 0;
  const pics = stackLast([
    image(c, { key: av[0], x: PAD, y: 90, w: 280, h: H - 180, radius: r }),
    image(c, { key: av[1], x: W - PAD - 280, y: 90, w: 280, h: H - 180, radius: r }),
  ]);
  return section([...st.nodes, ...pics], H, c.pal.surface);
}

const spec: TemplateSpec = {
  key: '527ec024', ref: '527ec024', name: 'Olivebough Studio', industry: 'agency', category: 'Agency',
  description: 'A gnome banner-weaving studio in cream and olive: split hero, an italic tagline band, rounded service pictures, a running ribbon.',
  palette: { bg: '#f6f1e7', surface: '#ece4d4', ink: '#2b2a22', body: '#4f4c40', muted: '#7a7562', accent: '#66662c', accentInk: '#fbf8ef', dark: '#2e2d29', darkInk: '#f6f1e7', darkBody: 'rgba(246,241,231,0.8)', darkAccent: '#d6d39a', line: 'rgba(43,42,34,0.14)' },
  fonts: { head: serif, body: sans, headWeight: 400, headTrack: 0, btnRadius: 0, btnUpper: true, cardRadius: 18 },
  chrome: { nav: 'serif wordmark left, many small links centre, olive CTA box right', footer: 'cream, wordmark + three link columns + newsletter line' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      imageStory(c, { photo: '@studio|craft', side: 'left', tone: 'bg', inset: false, h: 660, button: true, eyebrow: true }),
      taglineBand(c),
      cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', photos: work, cardFill: false, imgH: 300, align: 'center', head: { heading: 'What we weave', eyebrow: 'Services' }, button: true }),
      ribbon(c),
      flanked(c),
      cards(c, { n: 3, cols: 3, kind: 'plain', tone: 'bg', titleSlot: 'post.title', bodySlot: 'post.excerpt', link: '/journal', head: { heading: 'From the bench', align: 'left' } }),
    ] },
    { slug: 'services', title: 'Services', build: (c) => [
      pageTitle(c, { title: 'Services', tone: 'surface' }),
      cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'bg', head: false }),
      steps(c, { n: 3, tone: 'surface', head: { heading: 'From thread to banner' } }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'Our story', tone: 'bg', align: 'left' }),
      imageStory(c, { photo: avatarsFor(c.site, 2)[2], side: 'right', tone: 'accent' }),
      team(c, { n: 4, avatars: avatarsFor(c.site, 0), tone: 'bg', head: { heading: 'The weavers' } }),
      faq(c, { n: 4, tone: 'surface' }),
    ] },
    { slug: 'journal', title: 'Journal', build: (c) => [pageTitle(c, { title: 'Journal', tone: 'surface' }), posts(c, { n: 3, photos: work, tone: 'bg', head: false })] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Start a commission' })] },
  ],
};
export default spec;

// Ref — a navy consulting firm: boxed nav with a border, crisp flared-sans capitals, navy / periwinkle / tan blocks
// and diamond geometry.
// Kept: wide office photo strip · centred capital title over a thick navy rule · a geometric panel · navy band
// with one centred paragraph · four service tiles in two rows · navy "success stories" header · picture-left /
// quote-right story.
import { avatarsFor, cards, contact, faq, fitPhone, group, image, pageTitle, photoBand, reviews, section, shape, stackDown, steps, team, text, CW, PAD, W, type Ctx, type TemplateSpec } from '../kit.ts';
const sans = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";
const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";

/** A centred capital title sitting on a thick navy rule. */
function ruledTitle(c: Ctx, words: string) {
  const t = text(c, { text: words, x: 120, y: 40, w: 960, size: 34, color: c.pal.ink, font: 'head', upper: true, align: 'center', name: 'Title' });
  const rule = shape(c, { x: 0, y: t.box.desktop.y + t.box.desktop.h + 36, w: W, h: 5, fill: c.pal.dark, name: 'Rule' });
  return section([t, rule], rule.box.desktop.y + 5, c.pal.bg);
}

/** Squares in navy, periwinkle and tan, offset like the reference's diamonds. */
function geometry(c: Ctx) {
  const p = c.pal;
  const kids = [
    shape(c, { x: 200, y: 10, w: 250, h: 250, fill: p.dark, name: 'Block' }),
    shape(c, { x: 170, y: 0, w: 250, h: 250, fill: p.surface, name: 'Block' }),
    shape(c, { x: 0, y: 200, w: 110, h: 110, fill: p.surface, name: 'Block' }),
    shape(c, { x: 490, y: 200, w: 110, h: 110, fill: p.dark, name: 'Block' }),
    shape(c, { x: 270, y: 270, w: 60, h: 60, fill: '#cbc3ad', radius: 30, name: 'Dot' }),
  ];
  const g = group(c, { name: 'Geometry', x: (W - 600) / 2, y: 40, w: 600, h: 330, children: kids });
  return section([fitPhone(g)], 410, p.bg);
}

/** One centred paragraph on the navy band. */
function navyWords(c: Ctx) {
  const t = text(c, { slot: 'about', x: 140, y: 80, w: 920, size: 24, color: c.pal.darkInk, align: 'center', lh: 1.4, name: 'Paragraph' });
  return section([t], t.box.desktop.h + 160, c.pal.dark);
}

/** A navy header band with a single capital line. */
function navyHeader(c: Ctx, words: string) {
  const t = text(c, { text: words, x: 200, y: 60, w: 800, size: 30, color: c.pal.darkInk, font: 'head', upper: true, align: 'center', name: 'Heading' });
  return section([t], t.box.desktop.h + 120, c.pal.dark);
}

/** Picture down the left edge, a quote on the right. */
function story(c: Ctx, photo: string) {
  const tx = 380;
  const tw = W - tx - PAD;
  const nodes = [
    text(c, { text: '“', x: tx, y: 0, w: tw, size: 72, color: c.pal.ink, font: 'head', align: 'center', lh: 1, name: 'Mark' }),
    text(c, { slot: 'review.quote', index: 0, x: tx, y: 0, w: tw, size: 17, color: c.pal.body, lh: 1.6, name: 'Quote' }),
    text(c, { slot: 'review.quote', index: 1, x: tx, y: 0, w: tw, size: 17, color: c.pal.body, lh: 1.6, name: 'Quote' }),
    text(c, { slot: 'review.author', index: 0, x: tx, y: 0, w: tw, size: 14, color: c.pal.muted, weight: 600, upper: true, track: 1.4, name: 'Author' }),
  ];
  const st = stackDown(nodes, 110, [10, 18, 22]);
  const H = Math.max(620, st.y + 110);
  const pic = image(c, { key: photo, x: 0, y: 0, w: 300, h: H });
  return section([pic, ...st.nodes], H, c.pal.bg);
}

const spec: TemplateSpec = {
  key: '42ff13d7', ref: '42ff13d7', name: 'Bramblevow Banners', industry: 'agency', category: 'Agency',
  description: 'A sworn guild of banner-weavers in navy, periwinkle and tan: photo strip, ruled title, block geometry, a told tale.',
  palette: { bg: '#ffffff', surface: '#e8ebf5', ink: '#1a2238', body: '#3c4560', muted: '#6e7591', accent: '#1a2238', accentInk: '#ffffff', dark: '#1a2238', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.85)', darkAccent: '#cbc3ad', line: 'rgba(26,34,56,0.18)' },
  fonts: { head: sans, body: serif, headWeight: 500, headTrack: 0.6, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'boxed nav with a navy border: script logo left, links right, periwinkle CTA block', footer: 'navy, logo + columns + fine print' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      photoBand(c, { photo: '@study|desk', inset: false, h: 420 }),
      ruledTitle(c, 'Banners that carry the vow'),
      geometry(c),
      navyWords(c),
      cards(c, { n: 4, cols: 2, kind: 'plain', tone: 'bg', head: false, align: 'center' }),
      navyHeader(c, 'Tales from the hall'),
      story(c, '@library|books'),
    ] },
    { slug: 'what-we-do', title: 'What We Do', build: (c) => [pageTitle(c, { title: 'What we weave', tone: 'surface' }), cards(c, { n: 4, cols: 2, kind: 'icon', tone: 'bg', head: false, align: 'left' }), steps(c, { n: 4, tone: 'surface' })] },
    { slug: 'team', title: 'Our Team', build: (c) => [pageTitle(c, { title: 'Sworn to the loom', tone: 'dark' }), team(c, { n: 4, avatars: avatarsFor(c.site, 5), tone: 'bg', bio: true, head: false })] },
    { slug: 'testimonials', title: 'Testimonials', build: (c) => [pageTitle(c, { title: 'Tales from the hall', tone: 'surface' }), reviews(c, { n: 4, cols: 2, tone: 'bg', head: false }), faq(c, { n: 4, tone: 'surface' })] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', photo: '@desk|study#2', heading: 'Bring us your banner' })] },
  ],
};
export default spec;

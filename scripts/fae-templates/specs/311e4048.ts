// Ref — a cheerful helper studio: cream and sage with coral pills, a huge bold serif wordmark centred in the nav.
// Kept: sage hero with an oval portrait left and a big bold headline right (plus a green call-out line) ·
// bleed picture left / heading + pill right · heading + pill left / bleed picture right · sage band with one
// big centred quote. Added: three icon cards and a coral sign-off band.
import {
  PAD, avatarsFor, button, cards, centered, contact, ctaBand, faq, image, imageStory, pageTitle, section, splitHeading, stackDown, stackLast, steps, team, text, tone,
  type Ctx, type Section, type TemplateSpec,
} from '../kit.ts';

const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const helv = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** Sage band: an oval picture on the left, a big bold headline + intro + a green call-out line on the right. */
function ovalHero(c: Ctx): Section {
  const t = tone(c, 'surface');
  const tx = 520;
  const tw = 600;
  const st = stackDown([
    text(c, { slot: 'headline', x: tx, y: 0, w: tw, size: 52, color: '#ffffff', font: 'head', role: 'h1', lh: 1.06, name: 'Headline' }),
    text(c, { slot: 'subhead', x: tx, y: 0, w: 520, size: 16, color: '#ffffff', name: 'Subhead' }),
    text(c, { slot: 'tagline', x: tx, y: 0, w: 520, size: 22, color: c.pal.ink, font: 'head', weight: 700, name: 'Call-out' }),
    button(c, { href: '/contact', x: tx, y: 0 }),
  ], 0, [24, 22, 30]);
  const H = Math.max(620, st.y + 200);
  const top = (H - st.y) / 2;
  for (const n of st.nodes) n.box.desktop.y += Math.round(top);
  const oval = image(c, { key: '@flowers|garden', x: PAD + 60, y: (H - 440) / 2, w: 300, h: 440, circle: true });
  return section([...st.nodes, ...stackLast([oval])], H, t.bg, 'banner-image-atomic');
}

const spec: TemplateSpec = {
  key: '311e4048',
  ref: '311e4048',
  name: 'Bramble & Bloom',
  industry: 'agency',
  category: 'Agency',
  description: 'A sunny fae errand-and-herald studio in cream, sage and coral: an oval-portrait hero and wide bleeding pictures.',
  palette: {
    bg: '#fff6ee',
    surface: '#9bb893',
    ink: '#2c4413',
    body: '#3b4a2c',
    muted: '#5d6d4a',
    accent: '#e2846a',
    accentInk: '#ffffff',
    dark: '#2c4413',
    darkInk: '#fff6ee',
    darkBody: 'rgba(255,246,238,0.84)',
    darkAccent: '#f2b8a4',
    line: 'rgba(44,68,19,0.16)',
  },
  fonts: { head: serif, body: helv, headWeight: 700, headTrack: -1, btnRadius: 999, cardRadius: 12 },
  chrome: { nav: 'links left, big bold serif wordmark centred, socials + coral pill CTA right', footer: 'cream, wordmark + links + socials' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        ovalHero(c),
        imageStory(c, { photo: '@desk|study', side: 'left', tone: 'bg', inset: false, button: true }),
        imageStory(c, { photo: '@light|warm', side: 'right', tone: 'bg', inset: false, button: true }),
        centered(c, { tone: 'surface', headSlot: 'review.quote', slot: 'review.author', size: 34 }),
        cards(c, { n: 3, cols: 3, kind: 'icon', tone: 'bg', head: { heading: 'Little tasks, lifted', intro: true } }),
        ctaBand(c, { tone: 'accent' }),
      ],
    },
    {
      slug: 'services',
      title: 'Services',
      build: (c) => [pageTitle(c, { title: 'Services', tone: 'surface' }), cards(c, { n: 6, cols: 3, kind: 'plain', tone: 'bg', head: false, price: true }), ctaBand(c, { tone: 'dark', split: true })],
    },
    {
      slug: 'process',
      title: 'Process',
      build: (c) => [pageTitle(c, { title: 'How it begins', tone: 'bg' }), steps(c, { n: 4, tone: 'surface', head: false }), faq(c, { n: 5, tone: 'bg' })],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [pageTitle(c, { title: 'About', tone: 'surface' }), splitHeading(c, { tone: 'bg', paras: 2 }), team(c, { n: 2, avatars: avatarsFor(c.site, 5), tone: 'bg', bio: true, head: { heading: 'The helpers' } })],
    },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', photo: '@garden|nature', heading: 'Get in touch' })] },
  ],
};
export default spec;

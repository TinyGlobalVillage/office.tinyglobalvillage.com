// Ref — greige luxury-homes agent: thin condensed serif capitals with italic accents, hairline rules everywhere.
// Kept: split hero (picture left edge-to-edge, words right) · a running ribbon of one phrase · three portrait
// cards with a label each · centred heading + button · words-left / portrait-right story · wordmark row ·
// one big quote on a dark band.
import { avatarsFor, cards, centered, contact, faq, imageStory, logos, pageTitle, reviews, section, steps, text, type Ctx, type TemplateSpec } from '../kit.ts';
const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const halls = ['@interior|study', '@library|books', '@candle|warm'];

/** The ribbon: one phrase repeated across a thin band between hairlines. */
function ribbon(c: Ctx) {
  const t = text(c, { text: 'Halls of moss and lantern  ⟡  Halls of moss and lantern  ⟡  Halls of moss and lantern', x: 0, y: 22, w: 1200, size: 20, color: c.pal.ink, font: 'head', upper: true, align: 'center', lh: 1.3, name: 'Ribbon' });
  return section([t], t.box.desktop.h + 44, c.pal.surface);
}

const spec: TemplateSpec = {
  key: '294d876f', ref: '294d876f', name: 'Mossgate Halls', industry: 'architecture', category: 'Architecture',
  description: 'An elven hall-finder in greige and hairlines: split hero, a running ribbon, three portrait halls, a quiet quote.',
  palette: { bg: '#eeece7', surface: '#e4e1da', ink: '#1c1b19', body: '#47443f', muted: '#7c776e', accent: '#1c1b19', accentInk: '#eeece7', dark: '#2a2622', darkInk: '#eeece7', darkBody: 'rgba(238,236,231,0.8)', darkAccent: '#d8cfc0', line: 'rgba(28,27,25,0.3)' },
  fonts: { head: serif, body: sans, headWeight: 400, headTrack: -0.5, btnRadius: 999, btnUpper: false, cardRadius: 0 },
  chrome: { nav: 'thin top notice bar; big serif wordmark left, small links + socials + outlined pill CTA right; hairline under', footer: 'dark photo quote band, then hairline-ruled columns' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      imageStory(c, { photo: '@architecture|interior', side: 'left', tone: 'bg', inset: false, h: 640, button: true }),
      ribbon(c),
      cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', photos: halls, head: false, cardFill: false, imgH: 360, align: 'center', bodySlot: 'caption' }),
      centered(c, { tone: 'bg', button: true, size: 38 }),
      imageStory(c, { photo: avatarsFor(c.site, 2)[0], side: 'right', tone: 'bg', inset: false, h: 620, button: true }),
      logos(c, { tone: 'surface', seeds: ['moss-a', 'moss-b', 'moss-c', 'moss-d', 'moss-e'] }),
      reviews(c, { n: 1, cols: 1, tone: 'dark', big: true, head: false }),
    ] },
    { slug: 'services', title: 'Services', build: (c) => [pageTitle(c, { title: 'Services', tone: 'surface' }), cards(c, { n: 3, cols: 3, kind: 'icon', tone: 'bg', head: false }), steps(c, { n: 3, tone: 'surface', head: { heading: 'From glade to hall' } })] },
    { slug: 'listings', title: 'Listings', build: (c) => [pageTitle(c, { title: 'Halls to come home to', tone: 'bg' }), cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'surface', photos: halls, head: false, price: true, link: '/contact' })] },
    { slug: 'faqs', title: 'FAQs', build: (c) => [pageTitle(c, { title: 'Questions', tone: 'surface' }), faq(c, { n: 6, tone: 'bg', side: false, head: false })] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'A free fireside talk' })] },
  ],
};
export default spec;

// Ref — mint-white creative teacher: a giant lime serif wordmark behind a cut-out portrait, sage bands, square dark buttons.
// Kept: display-type hero with a figure over the letters · sage "seen in" wordmark band · centred serif capitals
// heading + dark button · giant section heading over a sage band with three picture cards + a "see all" button.
import { avatarsFor, button, cards, centered, contact, estimateH, image, logos, pageTitle, pricing, reviews, section, splitHeading, steps, team, text, imageStory, W, type Ctx, type TemplateSpec } from '../kit.ts';
const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const LIME = '#a8c93a';

/** The display hero: the house name in huge lime letters, a drawn figure standing over them, a line and a button. */
function displayHero(c: Ctx) {
  const word = c.site.brand.replace(/^The /, '');
  const big = text(c, { text: word, x: 40, y: 50, w: W - 80, size: 150, color: LIME, font: 'head', weight: 400, upper: true, align: 'center', lh: 0.95, track: -2, role: 'h1', name: 'Display' });
  const bh = estimateH(word, W - 80, 150, 0.95, 400, true);
  const fy = 50 + Math.round(bh * 0.45);
  const fig = image(c, { key: avatarsFor(c.site, 1)[0], x: 420, y: fy, w: 360, h: 400, alt: 'Our teacher' });
  const sub = text(c, { slot: 'tagline', x: 300, y: fy + 430, w: 600, size: 19, color: c.pal.body, font: 'head', italic: true, align: 'center', name: 'Tagline' });
  const b = button(c, { slot: 'cta', href: '/workshops', x: 0, y: sub.box.desktop.y + sub.box.desktop.h + 26, look: 'dark' });
  b.box.desktop.x = Math.round((W - b.box.desktop.w) / 2);
  return section([big, fig, sub, b], b.box.desktop.y + 50 + 90, c.pal.surface, 'banner-image-atomic');
}

const spec: TemplateSpec = {
  key: 'c63f9eca', ref: 'c63f9eca', name: 'Fernlight Atelier', industry: 'agency', category: 'Agency',
  description: 'A sprite who teaches banner-weaving to young makers: huge lime letters behind her portrait, sage bands, three featured workshops.',
  palette: { bg: '#f5f9f3', surface: '#e6ece3', ink: '#1d241c', body: '#45503f', muted: '#6f7a69', accent: '#4c6447', accentInk: '#ffffff', dark: '#1d241c', darkInk: '#f5f9f3', darkBody: 'rgba(245,249,243,0.8)', darkAccent: LIME, line: 'rgba(29,36,28,0.14)' },
  fonts: { head: serif, body: sans, headWeight: 400, headTrack: 0, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'small serif wordmark left, a few small links right, no CTA', footer: 'sage band, wordmark + links in one row, socials right' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      displayHero(c),
      logos(c, { tone: 'accent', label: 'As seen at the gatherings of', seeds: ['fern-a', 'fern-b', 'fern-c', 'fern-d', 'fern-e'] }),
      centered(c, { tone: 'bg', heading: 'A teacher for wandering makers', size: 34, button: true }),
      cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'surface', photos: ['@craft|studio', '@books|study', '@moss|mushroom'], cardFill: false, imgH: 380, head: { heading: 'Featured workshops', size: 72 }, button: true, bodySlot: 'caption' }),
      reviews(c, { n: 2, cols: 2, tone: 'bg', avatars: avatarsFor(c.site, 3), head: { heading: 'From past apprentices' } }),
    ] },
    { slug: 'workshops', title: 'Workshops', build: (c) => [
      pageTitle(c, { title: 'Workshops', tone: 'surface' }),
      steps(c, { n: 4, tone: 'bg', head: { heading: 'How a season unfolds' } }),
      pricing(c, { n: 3, tone: 'surface', head: { heading: 'Seats at the long table', intro: true } }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About', tone: 'bg', align: 'left' }),
      imageStory(c, { photo: avatarsFor(c.site, 1)[0], side: 'left', tone: 'surface', button: true }),
      splitHeading(c, { tone: 'bg', paras: 2, heading: 'Why I teach under the ferns' }),
      team(c, { n: 3, avatars: avatarsFor(c.site, 4), tone: 'surface', head: { heading: 'Who keeps the studio' } }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Ask about a seat' })] },
  ],
};
export default spec;

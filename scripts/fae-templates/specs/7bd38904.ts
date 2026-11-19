// Ref — a sun-baked personal brand in blush, terracotta, lilac and mustard, a heavy tight serif: split hero
// (photo + words), a terracotta band with a centred eyebrow and a big message, a lilac story with a photo right,
// then a full-bleed mosaic of photos and coloured tiles carrying one link each.
// Kept: split hero · centred big-message band · words-left/photo-right story · 3×2 mosaic of photos + link tiles.
import { avatarsFor, cards, centered, contact, faq, group, hero, image, imageStory, pageTitle, reviews, section, splitHeading, team, text, W, type Ctx, type Node, type Section, type TemplateSpec } from '../kit.ts';
const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** Full-bleed 3×2 mosaic: picture tiles and flat colour tiles, each colour tile one tracked link. */
function mosaic(c: Ctx): Section {
  const cell = 400;
  const h = 360;
  const tiles: Array<{ photo?: string; fill?: string; ink?: string; label?: string; href?: string }> = [
    { photo: '@nature|landscape' },
    { fill: '#e3b39e', ink: '#ffffff', label: 'Work with us', href: '/contact' },
    { photo: '@garden|flowers|moss' },
    { fill: '#e0d6e0', ink: '#c56a4c', label: 'See the work', href: '/services' },
    { fill: '#f1e1df', ink: '#c56a4c', label: 'Meet the studio', href: '/about' },
    { fill: '#c56a4c', ink: '#ffffff', label: 'Read the almanac', href: '/contact' },
  ];
  const kids: Node[] = tiles.map((t, i) => {
    if (t.photo) return group(c, { name: `Tile ${i + 1}`, x: 0, y: 0, w: cell, h, children: [image(c, { key: t.photo, x: 0, y: 0, w: cell, h, pct: 100 })] });
    const lab = text(c, { text: t.label!, x: 0, y: h / 2 - 14, w: cell, pct: 100, size: 16, color: t.ink!, weight: 700, upper: true, track: 5, align: 'center', name: 'Link' });
    return group(c, { name: `Tile ${i + 1}`, x: 0, y: 0, w: cell, h, fill: t.fill, children: [{ ...lab, href: t.href }] });
  });
  const g = group(c, { name: 'Mosaic', x: 0, y: 0, w: W, h: h * 2, children: kids, layout: { cols: 3, bp: { tablet: 2, mobile: 1 }, gap: 0 } });
  return section([g], h * 2, '#f1e1df');
}

const spec: TemplateSpec = {
  key: '7bd38904', ref: '7bd38904', name: 'Sunhollow Studio', industry: 'agency', category: 'Agency',
  description: 'A sun-warmed gnome studio in blush, clay and lilac: split hero, a big-message band, a mosaic of tiles and pictures.',
  palette: { bg: '#f1e1df', surface: '#e0d6e0', ink: '#2a1d1a', body: '#4a3a36', muted: '#8a6e66', accent: '#c56a4c', accentInk: '#ffffff', dark: '#b45f43', darkInk: '#fff4ef', darkBody: 'rgba(255,244,239,0.88)', darkAccent: '#ffe2c4', line: 'rgba(42,29,26,0.14)' },
  fonts: { head: serif, body: sans, headWeight: 700, headTrack: -1, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'links left, round sun logo centred, socials + clay CTA right', footer: 'blush, centred logo, socials, newsletter line' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'split', tone: 'bg', photo: '@warm|light|candle', buttons: 1, h: 640 }),
      centered(c, { tone: 'dark', eyebrow: 'Welcome in', size: 54 }),
      imageStory(c, { photo: '@architecture|study', side: 'right', tone: 'surface', button: true }),
      mosaic(c),
    ] },
    { slug: 'services', title: 'Services', build: (c) => [
      pageTitle(c, { title: 'Services', tone: 'bg' }),
      cards(c, { n: 3, cols: 3, kind: 'numbered', tone: 'bg', price: true, head: false }),
      faq(c, { n: 4, tone: 'surface' }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About', tone: 'surface' }),
      splitHeading(c, { tone: 'bg', paras: 2 }),
      team(c, { n: 3, avatars: avatarsFor(c.site, 4), tone: 'dark', head: { heading: 'The studio folk' } }),
      reviews(c, { n: 3, tone: 'bg' }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Come say hello' })] },
  ],
};
export default spec;

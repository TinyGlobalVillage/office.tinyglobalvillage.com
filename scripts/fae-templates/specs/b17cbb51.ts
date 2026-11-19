// Ref — a calm concrete-grey assistant's page: thin light heads, small-caps serif lines, hairline frames.
// Kept: full photo hero (words + outlined button) · words-left / picture-right intro · a photo band carrying one
// testimonial on its left · four icons on grey ("what I tend") · services in three · closing band.
import { avatarsFor, cards, contact, ctaBand, faq, hero, imageStory, pageTitle, pricing, section, stackDown, stats, text, wash, zigzag, PAD, type Ctx, type TemplateSpec } from '../kit.ts';
const thin = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";

/** A full photo band with one testimonial set on its left third. */
function photoQuote(c: Ctx, photo: string) {
  const ov = 'rgba(20,20,20,0.42)';
  const nodes = [
    text(c, { text: 'A kind word', x: PAD + 20, y: 0, w: 420, size: 13, color: 'rgba(255,255,255,0.85)', weight: 600, name: 'Eyebrow' }),
    text(c, { slot: 'review.quote', index: 0, x: PAD + 20, y: 0, w: 420, size: 20, color: '#ffffff', font: 'head', upper: true, lh: 1.45, track: 1, name: 'Quote' }),
    text(c, { slot: 'review.author', index: 0, x: PAD + 20, y: 0, w: 420, size: 15, color: '#ffffff', upper: true, track: 1.2, name: 'Author' }),
  ];
  const th = stackDown(nodes.map((n) => ({ ...n, box: { desktop: { ...n.box.desktop } } })), 0, [18, 22]).y;
  const H = Math.max(620, th + 200);
  const st = stackDown(nodes, (H - th) / 2, [18, 22]);
  return section(st.nodes, H, wash(ov), 'banner-image-atomic', { bgPin: { src: c.photo(photo), paintFrame: true, pinned: false, overlay: ov } });
}

const spec: TemplateSpec = {
  key: 'b17cbb51', ref: 'b17cbb51', name: 'Stillwater Heralds', industry: 'agency', category: 'Agency',
  description: 'A quiet faerie herald-for-hire in concrete greys: photo hero, a framed intro, a kind word over a picture, four crafts.',
  palette: { bg: '#fafafa', surface: '#dedede', ink: '#1a1a1a', body: '#454545', muted: '#7d7d7d', accent: '#1a1a1a', accentInk: '#fafafa', dark: '#3b3a38', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#f0ede8', line: 'rgba(26,26,26,0.22)' },
  fonts: { head: serif, body: thin, headWeight: 400, headTrack: 0.6, btnRadius: 999, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'small serif wordmark left, tiny links + socials right, outlined pill CTA; hairline under, over the hero', footer: 'pale grey, wordmark + links + socials in one row' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: '@study|desk', h: 640, buttons: 1, overlay: 'rgba(40,40,40,0.38)', headSize: 58 }),
      zigzag(c, { rows: [{ photo: '@desk|books' }], tone: 'bg' }),
      photoQuote(c, '@library|study'),
      cards(c, { n: 4, cols: 4, kind: 'icon', tone: 'surface', head: { eyebrow: 'The crafts we tend', heading: 'Errands, done gently', align: 'left' }, cardFill: false }),
      cards(c, { n: 3, cols: 3, kind: 'numbered', tone: 'bg', head: { heading: 'Our services', align: 'left' }, link: '/services' }),
      ctaBand(c, { tone: 'dark', split: true }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About', tone: 'surface', align: 'left' }),
      imageStory(c, { photo: avatarsFor(c.site, 1)[0], side: 'left', tone: 'bg', eyebrow: true }),
      stats(c, { n: 4, tone: 'surface' }),
    ] },
    { slug: 'services', title: 'Services', build: (c) => [pageTitle(c, { title: 'Services', tone: 'bg', align: 'left' }), pricing(c, { n: 3, tone: 'surface', head: false }), faq(c, { n: 5, tone: 'bg' })] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', photo: '@books|library', heading: 'Book a call by lantern' })] },
  ],
};
export default spec;

// Ref — a one-product launch page in dusk browns and tan: a dark photo hero with left-set words, four icon benefits over
// a dimmed photo, an "as featured in" wordmark row, a tan picture + words band, a centred quote close.
// Kept: left photo hero · icon feature grid on a photo background · wordmark row · picture-right story on the accent
// colour · centred testimonial interlude.
import { avatarsFor, cards, centered, contact, faq, hero, imageStory, logos, pageTitle, pricing, reviews, stats, steps, wash, type Ctx, type Section, type TemplateSpec } from '../kit.ts';

const grot = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** Icon benefit cards laid over a dimmed photo (the kit's cards band, given a photo background). */
function benefitsOverPhoto(c: Ctx, photo: string): Section {
  const s = cards(c, { n: 4, cols: 4, kind: 'icon', tone: 'dark', head: { heading: 'Why ears love it', align: 'center' }, cardFill: false });
  const ov = 'rgba(18,12,8,0.72)';
  s.type = 'banner-image-atomic';
  s.layersFrame.bgPin = { src: c.photo(photo), paintFrame: true, pinned: false, overlay: ov };
  s.layersFrame.background = wash(ov);
  return s;
}

const spec: TemplateSpec = {
  key: '20f535d7',
  ref: '20f535d7',
  name: 'Hushwing Hollowsound',
  industry: 'business',
  category: 'Business',
  description: 'A dusky elven launch for one enchanted listening-shell: a deep-brown hero, glowing benefits over a dim photo, tan story bands.',
  palette: { bg: '#f4f1ec', surface: '#e9e4dc', ink: '#231a13', body: '#4a3e34', muted: '#76695d', accent: '#c9a477', accentInk: '#231a13', dark: '#1f1712', darkInk: '#f4ece2', darkBody: 'rgba(244,236,226,0.8)', darkAccent: '#e2c8a4', line: 'rgba(35,26,19,0.15)' },
  fonts: { head: grot, body: sans, headWeight: 600, headTrack: -0.6, btnRadius: 40, cardRadius: 16 },
  chrome: { nav: 'transparent over the hero: logo left, links centre, tan "order now" pill right', footer: 'dark brown, logo + three link columns + small print' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'photo-left', photo: '@product|light', h: 660, eyebrow: true, buttons: 2, overlay: 'rgba(24,14,8,0.55)' }),
        benefitsOverPhoto(c, '@light|warm'),
        logos(c, { n: 5, tone: 'surface', label: 'Praised in the heralds of the five woods', seeds: ['shell-a', 'shell-b', 'shell-c', 'shell-d', 'shell-e'] }),
        imageStory(c, { photo: '@product#2', side: 'right', tone: 'accent', button: true, h: 600 }),
        centered(c, { tone: 'bg', slot: 'review.quote', heading: 'Heard by a thousand pointed ears', size: 34 }),
      ],
    },
    {
      slug: 'benefits',
      title: 'Benefits',
      build: (c) => [
        pageTitle(c, { title: 'What it gives you', tone: 'dark' }),
        cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'bg', head: false, align: 'left' }),
        stats(c, { n: 3, tone: 'accent' }),
        steps(c, { n: 3, tone: 'surface', head: { heading: 'Three steps to stillness' } }),
      ],
    },
    {
      slug: 'reviews',
      title: 'Reviews',
      build: (c) => [
        pageTitle(c, { title: 'Kind words', tone: 'surface' }),
        reviews(c, { n: 6, cols: 3, tone: 'bg', head: false, avatars: avatarsFor(c.site, 2) }),
        faq(c, { n: 5, tone: 'surface' }),
      ],
    },
    {
      slug: 'order',
      title: 'Order',
      build: (c) => [
        pageTitle(c, { title: 'Bring one home', tone: 'dark' }),
        pricing(c, { n: 3, tone: 'bg', head: false }),
        contact(c, { tone: 'surface', heading: 'Questions before you order?' }),
      ],
    },
  ],
};
export default spec;

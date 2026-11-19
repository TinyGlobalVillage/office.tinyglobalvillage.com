// Ref — a creative company in blush: a soft full-bleed photo hero, a centred wide-tracked intro beside a framed picture,
// a big picture overlapped by a white quote card, "our mission" in two columns. Spaced caps heads, serif body.
// Kept: full-photo hero · intro words + framed picture · picture with an overlapping words card · centred small
// heading over two text columns · (packages, portfolio, about, contact from the nav).
import { avatarsFor, bottom, cards, contact, faq, group, hero, image, imageStory, pageTitle, pricing, section, splitHeading, team, text, tone, type Ctx, type TemplateSpec } from '../kit.ts';
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";

/** A big picture with a white words card overlapping its right edge (stacks picture → card on a phone). */
function overlapQuote(c: Ctx, photo: string) {
  const t = tone(c, 'bg');
  const pic = image(c, { key: photo, x: 130, y: 80, w: 700, h: 500 });
  const q = text(c, { slot: 'mission', x: 40, y: 44, w: 360, pct: (360 / 440) * 100, size: 22, color: t.ink, font: 'head', weight: 400, lh: 1.5, track: 0, name: 'Quote' });
  const card = group(c, { name: 'Words card', x: 660, y: 200, w: 440, h: bottom(q) + 44, children: [q], fill: '#ffffff', flow: { gap: 10, pad: 44 } });
  return section([pic, card], Math.max(bottom(pic), bottom(card)) + 90, t.bg);
}

const spec: TemplateSpec = {
  key: '78896f68', ref: '78896f68', name: 'Nightshade & Fern', industry: 'agency', category: 'Agency',
  description: 'A faerie creative company in blush and terracotta: a soft photo hero, framed stories, a quote card over a big picture.',
  palette: { bg: '#efe5e2', surface: '#ffffff', ink: '#1e1a18', body: '#3e3633', muted: '#7a6c66', accent: '#a86b5c', accentInk: '#ffffff', dark: '#2a2321', darkInk: '#fbf5f3', darkBody: 'rgba(251,245,243,0.82)', darkAccent: '#e3bfb4', line: 'rgba(30,26,24,0.12)' },
  fonts: { head: sans, body: serif, headWeight: 500, headTrack: 3, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'spaced-caps links left, oval crest centred, socials + basket + terracotta CTA right', footer: 'blush, centred crest + links' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-center', photo: '@flowers|nature', h: 620, buttons: 1, overlay: 'rgba(40,28,24,0.32)', headSize: 52 }),
      imageStory(c, { photo: '@study|books', side: 'right', tone: 'bg', button: true }),
      overlapQuote(c, '@mist|forest'),
      cards(c, { n: 2, cols: 2, kind: 'plain', tone: 'bg', cardFill: false, titleSlot: 'headline', bodySlot: 'about', head: { heading: 'Our mission', size: 18 } }),
      cards(c, { n: 3, cols: 3, kind: 'icon', tone: 'surface', head: { eyebrow: true, heading: 'What we weave' }, link: '/packages' }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About us', tone: 'surface' }),
      splitHeading(c, { tone: 'bg', paras: 2 }),
      team(c, { n: 3, avatars: avatarsFor(c.site, 4), tone: 'surface', bio: true, head: false }),
    ] },
    { slug: 'packages', title: 'Packages', build: (c) => [
      pageTitle(c, { title: 'Packages', tone: 'bg' }),
      pricing(c, { n: 3, tone: 'surface', head: false }),
      faq(c, { n: 5, tone: 'bg' }),
    ] },
    { slug: 'portfolio', title: 'Portfolio', build: (c) => [
      pageTitle(c, { title: 'Portfolio', tone: 'surface' }),
      cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', cardFill: false, head: false, photos: ['@flowers|nature', '@study|books', '@mist|forest'], imgH: 380 }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', photo: '@flowers|garden', heading: 'Get in touch' })] },
  ],
};
export default spec;

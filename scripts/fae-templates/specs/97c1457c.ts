// Ref — blush-pink self-worth coach: typewriter lowercase type, script hello, a black testimonial band.
// Kept: three stacked statement bands that deepen in pink and grow in size · "hi there" words-left / portrait-right
// intro with two buttons · a black band with one big centred testimonial.
import { avatarsFor, contact, faq, imageStory, pageTitle, posts, reviews, section, splitHeading, team, text, type Ctx, type TemplateSpec } from '../kit.ts';
const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const pics = ['@flowers|garden', '@candle|light', '@books|study'];

/** One line of words alone on a pink band — the reference's stacked statements. */
function statement(c: Ctx, words: string, size: number, h: number, bg: string) {
  const t = text(c, { text: words, x: 60, y: 0, w: 1080, size, color: c.pal.ink, font: 'head', role: 'h2', align: 'center', lh: 1.1, name: 'Statement' });
  t.box.desktop.y = Math.round((h - t.box.desktop.h) / 2);
  return section([t], h, bg);
}

const spec: TemplateSpec = {
  key: '97c1457c', ref: '97c1457c', name: 'Hush & Bloom', industry: 'coach', category: 'Coach',
  description: 'A soft-spoken pathfinder in three shades of petal pink: stacked whispered statements, a warm hello, kind words on black.',
  palette: { bg: '#fcf1f4', surface: '#f9d0de', ink: '#141414', body: '#333333', muted: '#7a5a64', accent: '#141414', accentInk: '#fde3ea', dark: '#000000', darkInk: '#fde3ea', darkBody: 'rgba(253,227,234,0.86)', darkAccent: '#fde3ea', line: 'rgba(20,20,20,0.2)' },
  fonts: { head: serif, body: sans, headWeight: 400, headTrack: 0.5, btnRadius: 0, btnUpper: false, cardRadius: 0 },
  chrome: { nav: 'script logo left, lowercase links right, black CTA box', footer: 'pale pink, logo + lowercase links' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      statement(c, 'rest a while.', 30, 300, '#fcf1f4'),
      statement(c, 'and again.', 30, 370, '#f7e3e8'),
      statement(c, 'root. rest. bloom.', 96, 300, '#fbdde6'),
      imageStory(c, { photo: pics[0], side: 'right', tone: 'surface', eyebrow: true, button: true }),
      reviews(c, { n: 1, cols: 1, tone: 'dark', big: true, head: { heading: 'folk will whisper', intro: true } }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'hello, friend', tone: 'surface' }),
      imageStory(c, { photo: pics[1], side: 'left', tone: 'bg' }),
      splitHeading(c, { tone: 'surface', paras: 2 }),
      team(c, { n: 1, avatars: avatarsFor(c.site, 5), tone: 'bg', bio: true, ring: '#f9d0de', head: false }),
    ] },
    { slug: 'testimonials', title: 'Testimonials', build: (c) => [pageTitle(c, { title: 'kind words', tone: 'dark' }), reviews(c, { n: 4, cols: 2, tone: 'bg', head: false })] },
    { slug: 'resources', title: 'Resources', build: (c) => [pageTitle(c, { title: 'small comforts', tone: 'surface' }), posts(c, { n: 3, photos: pics, tone: 'bg', head: false }), faq(c, { n: 4, tone: 'surface' })] },
    { slug: 'contact', title: 'Get in touch', build: (c) => [contact(c, { tone: 'bg', photo: pics[2], heading: 'come sit with us' })] },
  ],
};
export default spec;

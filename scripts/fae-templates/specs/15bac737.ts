// Ref — a bright learning-software site: a white split hero with an app panel on the right, a yellow statement band,
// a "what we offer" block (heading left, four icon cards), alternating panel + points rows, a pricing close.
// Kept: split hero with a drawn panel · split heading on the accent colour · icon cards under a left heading ·
// panel/text zigzag with bullet points · plans.
import { avatarsFor, cards, centered, chartPanel, contact, faq, hero, listPanel, pageTitle, pricing, reviews, splitHeading, steps, zigzag, type TemplateSpec } from '../kit.ts';

const grot = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

const spec: TemplateSpec = {
  key: '15bac737',
  ref: '15bac737',
  name: 'Quillspark Tutorbook',
  industry: 'education',
  category: 'Education',
  description: 'A sunny pixie spellbook-app for lessons: a crisp white welcome beside a drawn tally of pupils, golden bands, panels that hop sides.',
  palette: { bg: '#ffffff', surface: '#f7f5ef', ink: '#17171c', body: '#45454f', muted: '#6c6c78', accent: '#fdbf2d', accentInk: '#17171c', dark: '#17171c', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#fdbf2d', line: 'rgba(23,23,28,0.12)' },
  fonts: { head: grot, body: sans, headWeight: 700, headTrack: -0.8, btnRadius: 10, cardRadius: 16 },
  chrome: { nav: 'logo left, links centre, "log in" text + yellow "start free" button right', footer: 'white, logo + four link columns, small print row' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, {
          variant: 'split-art',
          tone: 'bg',
          h: 640,
          eyebrow: true,
          buttons: 2,
          art: listPanel({ card: '#ffffff', ink: c.pal.ink, muted: c.pal.muted, accent: '#c98a00', line: c.pal.line, radius: 16, avatars: avatarsFor(c.site, 0) }),
        }),
        splitHeading(c, { tone: 'accent', paras: 1, button: true }),
        cards(c, { n: 4, cols: 4, kind: 'icon', tone: 'bg', head: { heading: 'What the book holds', align: 'left', intro: true }, align: 'left' }),
        zigzag(c, {
          rows: [
            { art: chartPanel({ card: '#ffffff', ink: c.pal.ink, muted: c.pal.muted, bar: '#fdbf2d', bar2: '#f1e7c9', line: c.pal.line, radius: 16 }), bullets: 3 },
            { art: listPanel({ card: '#ffffff', ink: c.pal.ink, muted: c.pal.muted, accent: '#c98a00', line: c.pal.line, radius: 16 }), bullets: 3, pill: true },
          ],
          tone: 'surface',
          head: { heading: 'Lessons that keep their own tally', intro: true },
          startRight: true,
        }),
        reviews(c, { n: 3, tone: 'bg', avatars: avatarsFor(c.site, 3) }),
      ],
    },
    {
      slug: 'product',
      title: 'Product',
      build: (c) => [
        pageTitle(c, { title: 'Inside the spellbook', tone: 'surface' }),
        cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'bg', head: false, align: 'left' }),
        steps(c, { n: 4, tone: 'surface', head: { heading: 'From first page to full shelf' } }),
      ],
    },
    {
      slug: 'pricing',
      title: 'Pricing',
      build: (c) => [
        pageTitle(c, { title: 'Pick your satchel', tone: 'accent' }),
        pricing(c, { n: 3, tone: 'bg', head: false }),
        faq(c, { n: 5, tone: 'surface' }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Talk to the bookbinders' }), centered(c, { tone: 'dark', heading: 'Try a free moon', button: true })],
    },
  ],
};
export default spec;

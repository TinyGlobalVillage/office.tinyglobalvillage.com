// Ref — a soft coaching studio: charcoal nav, a photo hero holding a pale rounded card, script-and-serif heads.
// Kept: photo hero with the words in a rounded card · a three-phrase strip with rules · charcoal band with a
// bullet list beside a rounded picture · "how we help" three oval pictures + one button · one big centred quote.
import {
  CW, PAD, avatarsFor, bottom, cards, chartPanel, contact, ctaBand, group, pageTitle, posts, pricing, reviews, section, splitHeading, stats, team, text, tone, wash, zigzag,
  type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';

const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

const HERO = '@studio|desk';
const HELP = ['@desk|books', '@study|library', '@workshop|craft'];

/** Photo band with the headline and intro set inside a pale rounded card, left of centre. */
function cardHero(c: Ctx): Section {
  const cw = 420;
  const pad = 40;
  const pct = ((cw - pad * 2) / cw) * 100;
  const h1 = text(c, { slot: 'headline', x: pad, y: pad, w: cw - pad * 2, pct, size: 40, color: c.pal.ink, font: 'head', role: 'h1', align: 'center', lh: 1.14, name: 'Headline' });
  const sub = text(c, { slot: 'subhead', x: pad, y: bottom(h1) + 18, w: cw - pad * 2, pct, size: 16, color: c.pal.body, align: 'center', name: 'Subhead' });
  const ch = bottom(sub) + pad;
  const H = Math.max(600, ch + 200);
  const card = group(c, { name: 'Hero card', x: 165, y: (H - ch) / 2, w: cw, h: ch, children: [h1, sub], fill: '#f3ecea', radius: 22, flow: { gap: 18, pad } });
  const ov = 'rgba(40,30,26,0.18)';
  return section([card], H, wash(ov), 'banner-image-atomic', { bgPin: { src: c.photo(HERO), paintFrame: true, pinned: false, overlay: ov } });
}

/** Three short phrases in a row (the reference's three-word strip; its hairline dividers are left out — a loose
 *  1px shape would stack as a stray bar on phones). */
function phraseStrip(c: Ctx): Section {
  const t = tone(c, 'surface');
  const cellW = (CW - 40) / 3;
  const cells: Node[] = [0, 1, 2].map((i) =>
    group(c, {
      name: `Phrase ${i + 1}`, x: 0, y: 0, w: cellW, h: 70,
      children: [text(c, { slot: 'offering.title', index: i + 3, x: 20, y: 8, w: cellW - 40, pct: ((cellW - 40) / cellW) * 100, size: 23, color: t.head, font: 'head', italic: true, align: 'center', lh: 1.2, name: 'Phrase' })],
    }),
  );
  const g = group(c, { name: 'Phrases', x: PAD, y: 40, w: CW, h: 70, children: cells, layout: { cols: 3, bp: { tablet: 3, mobile: 1 }, gap: 20 } });
  return section([g], 150, '#ffffff');
}

/** The oval picture cards: kit photo cards with each picture drawn as an ellipse. */
function ovalCards(c: Ctx): Section {
  const s = cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', photos: HELP, head: { heading: 'How we lend a hand' }, cardFill: false, imgH: 220, align: 'center', button: true });
  const walk = (ns: Node[]) => {
    for (const n of ns) {
      if (n.type === 'image') (n as Record<string, unknown>).imgShape = 'circle';
      if (Array.isArray(n.children)) walk(n.children as Node[]);
    }
  };
  walk(s.layers);
  return s;
}

const look = { card: '#ffffff', ink: '#2b2b2b', muted: '#8a8580', bar: '#c9a99a', bar2: '#ece3df', line: '#ece3df', radius: 22 };

const spec: TemplateSpec = {
  key: 'e8c29bfa',
  ref: 'e8c29bfa',
  name: 'Thistle & Quill',
  industry: 'agency',
  category: 'Agency',
  description: 'A gentle fae herald studio in charcoal and blush: a card-in-photo hero, a three-phrase strip, oval picture cards.',
  palette: {
    bg: '#ffffff',
    surface: '#f2f1ef',
    ink: '#2b2b2b',
    body: '#555352',
    muted: '#8a8580',
    accent: '#3f3f3f',
    accentInk: '#ffffff',
    dark: '#474747',
    darkInk: '#ffffff',
    darkBody: 'rgba(255,255,255,0.82)',
    darkAccent: '#f0e4dc',
    line: 'rgba(43,43,43,0.14)',
  },
  fonts: { head: serif, body: sans, headWeight: 400, headTrack: -0.5, btnRadius: 999, cardRadius: 18 },
  chrome: { nav: 'charcoal bar: script wordmark left, links beside it, outlined pill CTA right', footer: 'charcoal, wordmark centred, links + socials' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        cardHero(c),
        phraseStrip(c),
        zigzag(c, { rows: [{ art: chartPanel(look), bullets: 4 }], tone: 'dark' }),
        ovalCards(c),
        reviews(c, { n: 1, cols: 1, tone: 'surface', big: true, head: false }),
        ctaBand(c, { tone: 'dark', split: true }),
      ],
    },
    {
      slug: 'services',
      title: 'Services',
      build: (c) => [pageTitle(c, { title: 'Ways we work', tone: 'dark' }), cards(c, { n: 3, cols: 3, kind: 'icon', tone: 'bg', head: false }), pricing(c, { n: 3, tone: 'surface' })],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'About the studio', tone: 'surface' }),
        splitHeading(c, { tone: 'bg', paras: 2 }),
        team(c, { n: 3, avatars: avatarsFor(c.site, 2), tone: 'surface', bio: true, head: { heading: 'The heralds' } }),
        stats(c, { n: 3, tone: 'dark' }),
      ],
    },
    { slug: 'blog', title: 'Blog', build: (c) => [pageTitle(c, { title: 'Notes from the studio', tone: 'bg' }), posts(c, { n: 3, photos: HELP, tone: 'bg', head: false })] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Schedule a chat' })] },
  ],
};
export default spec;

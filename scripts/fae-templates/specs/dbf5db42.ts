// Ref — a midnight-navy and gold seer's site, small-caps serif, a photo hero with three navy cards laid over it.
// Kept: photo hero with centred headline and three overlaid cards · heading-left / paragraph-right on cream ·
// portrait story on navy · big-quote reviews · navy call band.
import {
  CW, PAD, avatarsFor, badge, cards, contact, ctaBand, group, imageStory, pageTitle, pricing, reviews, section, splitHeading, stackDown, stats, text, wash,
  type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';

const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const NAVY = '#14213d';
const GOLD = '#d9b45a';

/** Photo hero with the headline centred and three navy cards sitting on the picture. */
function starHero(c: Ctx, photo: string): Section {
  const ov = 'rgba(12,20,44,0.56)';
  const h1 = text(c, { slot: 'headline', x: 160, y: 0, w: 880, size: 58, color: '#ffffff', font: 'head', role: 'h1', align: 'center', lh: 1.1, name: 'Headline' });
  const sub = text(c, { slot: 'subhead', x: 260, y: 0, w: 680, size: 18, color: 'rgba(255,255,255,0.88)', align: 'center', name: 'Subhead' });
  const st = stackDown([h1, sub], 150, 20);
  const gap = 28;
  const cellW = (CW - gap * 2) / 3;
  const pad = 28;
  const pct = ((cellW - pad * 2) / cellW) * 100;
  const glyphs = ['☾', '✧', '❂'];
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < 3; i++) {
    const kids: Node[] = [...badge(c, { x: pad, y: 28, d: 48, glyph: glyphs[i], fill: 'rgba(217,180,90,0.16)', ink: GOLD })];
    const ti = text(c, { slot: 'offering.title', x: pad, y: 96, w: cellW - pad * 2, pct, size: 22, color: '#ffffff', font: 'head', role: 'h3', name: 'Title' });
    const bo = text(c, { slot: 'offering.body', x: pad, y: ti.box.desktop.y + ti.box.desktop.h + 10, w: cellW - pad * 2, pct, size: 15, color: 'rgba(255,255,255,0.8)', name: 'Body' });
    const ln = { ...text(c, { text: 'Read the stars →', x: pad, y: bo.box.desktop.y + bo.box.desktop.h + 14, w: cellW - pad * 2, pct, size: 14, color: GOLD, weight: 600, name: 'Link' }), href: '/performances' };
    kids.push(ti, bo, ln);
    const h = ln.box.desktop.y + ln.box.desktop.h + 30;
    maxH = Math.max(maxH, h);
    items.push(group(c, { name: `Card ${i + 1}`, x: 0, y: 0, w: cellW, h, children: kids, flow: { gap: 10, pad: 28 }, fill: NAVY, border: 'rgba(217,180,90,0.55)', radius: c.fonts.cardRadius ?? 0 }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const gy = st.y + 80;
  const grid = group(c, { name: 'Cards', x: PAD, y: gy, w: CW, h: maxH, children: items, layout: { cols: 3, bp: { tablet: 2, mobile: 1 }, gap } });
  return section([...st.nodes, grid], gy + maxH + 110, wash(ov), 'banner-image-atomic', { bgPin: { src: c.photo(photo), paintFrame: true, pinned: false, overlay: ov } });
}

const spec: TemplateSpec = {
  key: 'dbf5db42',
  ref: 'dbf5db42',
  name: 'Moonveil Masque',
  industry: 'actor',
  category: 'Actor',
  description: 'A starlit masque in navy and gold: three moonlit cards float over a candle-lit hero, then a seer-like story and quotes.',
  palette: {
    bg: '#f7f2e6',
    surface: '#ece4d0',
    ink: NAVY,
    body: '#3d4660',
    muted: '#8a7a52',
    accent: '#a8822f',
    accentInk: NAVY,
    dark: NAVY,
    darkInk: '#f7f2e6',
    darkBody: 'rgba(247,242,230,0.82)',
    darkAccent: GOLD,
    line: 'rgba(20,33,61,0.16)',
  },
  fonts: { head: serif, body: sans, headWeight: 500, headTrack: 0.5, btnRadius: 2, btnUpper: true, cardRadius: 4 },
  chrome: { nav: 'brand centred in small caps, links split either side, navy bar', footer: 'navy, centred brand, gold hairline, one row of links' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        starHero(c, '@candle|library'),
        splitHeading(c, { tone: 'bg', heading: 'Under a borrowed moon' }),
        imageStory(c, { photo: avatarsFor(c.site, 4)[0], side: 'left', tone: 'dark', button: true, eyebrow: true }),
        reviews(c, { n: 2, cols: 2, tone: 'surface', big: true, head: { heading: 'Whispered after the masque' } }),
        ctaBand(c, { tone: 'dark' }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'Who reads the stars', tone: 'dark' }),
        imageStory(c, { photo: avatarsFor(c.site, 4)[1], side: 'right', tone: 'bg', button: false }),
        stats(c, { n: 4, tone: 'surface' }),
      ],
    },
    {
      slug: 'performances',
      title: 'Performances',
      build: (c) => [
        pageTitle(c, { title: 'Masques by moonlight', photo: '@books|study' }),
        cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'bg', head: false, price: true }),
        pricing(c, { n: 3, tone: 'surface', head: { heading: 'Pick your night', intro: true } }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'dark', photo: '@candle|library', heading: 'Send word by owl' })],
    },
  ],
};
export default spec;

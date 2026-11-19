// Ref — a white, framed one-designer studio site: giant black name, a lime ticker of services, a big product photo,
// four ruled numbers, a client wordmark row, services heading left with stacked service cards right, a small byline.
// Kept: giant-name hero with a two-part subline · lime scrolling ticker · wide picture · four numbers · wordmark row ·
// heading-left / stacked cards-right services · small portrait byline · dark call band.
import {
  CW, PAD, W, avatarsFor, badge, button, contact, copy, ctaBand, group, logos, pageTitle, photoBand, posts, pricing, reviews, section, stackDown, stats, steps, team, text, tone, zigzag,
  type Ctx, type Node, type Section, type TemplateSpec, type Tone,
} from '../kit.ts';

const grotesk = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const LIME = '#d4f36b';

/** The studio's name set huge, a tagline left and an eyebrow + button right under it. */
function nameHero(c: Ctx): Section {
  const t = tone(c, 'bg');
  const name = text(c, { text: c.site.brand.replace(/^The /, ''), x: PAD, y: 110, w: CW, size: 128, color: t.head, font: 'head', role: 'h1', lh: 0.98, track: -4, upper: true, name: 'Name' });
  const y = name.box.desktop.y + name.box.desktop.h + 36;
  const tag = text(c, { slot: 'tagline', x: PAD, y, w: 520, size: 22, color: t.head, font: 'head', name: 'Tagline' });
  const sub = text(c, { slot: 'subhead', x: 700, y, w: 440, size: 16, color: t.body, name: 'Subline' });
  const b = button(c, { href: '/contact', x: 700, y: sub.box.desktop.y + sub.box.desktop.h + 20, look: 'dark' });
  return section([name, tag, sub, b], Math.max(tag.box.desktop.y + tag.box.desktop.h, b.box.desktop.y + 50) + 90, t.bg, 'banner-image-atomic');
}

/** One line of services scrolling across a lime strip. */
function ticker(c: Ctx): Section {
  const words = Array.from({ length: 5 }, (_, i) => copy(c, 'offering.title', i).text);
  const line = { ...text(c, { text: `${words.join('  ✦  ')}  ✦`, x: 0, y: 20, w: 6000, pct: 100, size: 26, color: '#0d0d0d', font: 'head', role: 'p', lh: 1.2, name: 'Ticker' }), anim: { type: 'marquee', durationMs: 30000 } };
  return section([line], line.box.desktop.y + line.box.desktop.h + 20, LIME);
}

/** Heading + glyph + intro on the left, a single column of service cards on the right. */
function sideServices(c: Ctx, tn: Tone, n = 4): Section {
  const t = tone(c, tn);
  const left: Node[] = [
    ...badge(c, { x: PAD, y: 0, d: 56, glyph: '✦', fill: LIME, ink: '#0d0d0d' }),
    text(c, { text: 'Rune-work for every door', x: PAD, y: 0, w: 420, size: 44, color: t.head, font: 'head', name: 'Heading' }),
    text(c, { slot: 'paragraph', x: PAD, y: 0, w: 400, size: 16, color: t.body, name: 'Intro' }),
  ];
  const ls = stackDown(left, 100, [24, 18]);
  const cw = 560;
  const pad = 28;
  const pct = ((cw - pad * 2) / cw) * 100;
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < n; i++) {
    const num = text(c, { text: String(i + 1).padStart(2, '0'), x: pad, y: 26, w: cw - pad * 2, pct, size: 14, color: t.muted, weight: 700, name: 'Number' });
    const ti = text(c, { slot: 'offering.title', index: i, x: pad, y: 52, w: cw - pad * 2, pct, size: 24, color: t.head, font: 'head', role: 'h3', name: 'Title' });
    const bo = text(c, { slot: 'offering.body', index: i, x: pad, y: ti.box.desktop.y + ti.box.desktop.h + 8, w: cw - pad * 2, pct, size: 15, color: t.body, name: 'Body' });
    const h = bo.box.desktop.y + bo.box.desktop.h + 28;
    maxH = Math.max(maxH, h);
    items.push(group(c, { name: `Service ${i + 1}`, x: 0, y: 0, w: cw, h, children: [num, ti, bo], flow: { gap: 8, pad: 28 }, fill: i === 0 ? LIME : t.card, border: t.line, radius: c.fonts.cardRadius ?? 0 }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const gh = n * maxH + (n - 1) * 16;
  const grid = group(c, { name: 'Services', x: W - PAD - cw, y: 100, w: cw, h: gh, children: items, layout: { cols: 1, bp: { tablet: 1, mobile: 1 }, gap: 16 } });
  return section([...ls.nodes, grid], Math.max(ls.y, 100 + gh) + 100, t.bg);
}

const spec: TemplateSpec = {
  key: '275c9072',
  ref: '275c9072',
  name: 'Lumen Thistle Studio',
  industry: 'agency',
  category: 'Agency',
  description: 'A rune-designer\'s white studio page: the name set giant, a lime ticker of crafts, and services stacked beside a bold heading.',
  palette: {
    bg: '#ffffff',
    surface: '#f2f2ee',
    ink: '#0d0d0d',
    body: '#3a3a3a',
    muted: '#6b6b6b',
    accent: '#0d0d0d',
    accentInk: LIME,
    dark: '#0d0d0d',
    darkInk: '#ffffff',
    darkBody: 'rgba(255,255,255,0.8)',
    darkAccent: LIME,
    line: 'rgba(13,13,13,0.14)',
  },
  fonts: { head: grotesk, body: sans, headWeight: 700, headTrack: -1, btnRadius: 999, cardRadius: 16 },
  chrome: { nav: 'small brand-left, links centred, dark pill CTA right, page framed in a thin border', footer: 'dark rounded block, giant brand, link columns' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        nameHero(c),
        ticker(c),
        photoBand(c, { photo: '@books|study', tone: 'bg', h: 560, radius: 16 }),
        stats(c, { n: 4, tone: 'bg' }),
        logos(c, { n: 5, tone: 'surface', label: 'Burrows and halls that trust the runes', seeds: ['moss', 'brook', 'acorn', 'fern', 'ember'] }),
        sideServices(c, 'bg'),
        team(c, { n: 1, avatars: avatarsFor(c.site, 3), tone: 'bg', d: 120, head: false }),
        ctaBand(c, { tone: 'dark', split: true }),
      ],
    },
    {
      slug: 'services',
      title: 'Services',
      build: (c) => [
        pageTitle(c, { title: 'Crafts of the rune-house', tone: 'bg', align: 'left' }),
        steps(c, { n: 4, tone: 'surface' }),
        pricing(c, { n: 3, tone: 'bg' }),
      ],
    },
    {
      slug: 'work',
      title: 'Work',
      build: (c) => [
        pageTitle(c, { title: 'Marks we have carved', tone: 'dark' }),
        zigzag(c, { tone: 'bg', rows: [{ photo: '@bakery|bread', pill: true }, { photo: '@moss|mushroom', pill: true }] }),
        posts(c, { n: 3, photos: ['@books|study', '@bakery|bread', '@moss|mushroom'], tone: 'surface', head: { heading: 'Rune notes' } }),
        reviews(c, { n: 2, cols: 2, tone: 'bg', avatars: avatarsFor(c.site, 3) }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Commission a rune' })],
    },
  ],
};
export default spec;

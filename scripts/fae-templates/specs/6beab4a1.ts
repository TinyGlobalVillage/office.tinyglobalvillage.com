// Ref — a powder-blue portfolio with a black display serif: circle portrait over a giant wordmark, a numbered feature
// list beside a sunburst, a scrolling ticker, a big rounded photo, orange pill buttons.
// Kept: circle portrait + giant wordmark hero · numbered list left / drawn sunburst right · scrolling ticker band ·
// rounded full-width picture · centred call with pill button.
import {
  PAD, W, button, centered, contact, copy, faq, group, image, pageTitle, photoBand, posts, pricing, reviews, section, shape, stackDown, stackLast, text, tone, zigzag,
  type Ctx, type Node, type Section, type TemplateSpec, type Tone,
} from '../kit.ts';

const serif = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** Circle portrait, then the brand as a giant wordmark, a line under it and a pill button. */
function bloomHero(c: Ctx, photo: string): Section {
  const t = tone(c, 'bg');
  const pic = image(c, { key: photo, x: (W - 300) / 2, y: 0, w: 300, h: 300, circle: true, alt: 'Portrait' });
  const brand = text(c, { text: c.site.brand.replace(/^The /, ''), x: 0, y: 0, w: W, size: 112, color: t.head, font: 'head', role: 'h1', align: 'center', lh: 1, track: -2, name: 'Wordmark' });
  const sub = text(c, { slot: 'tagline', x: 300, y: 0, w: 600, size: 19, color: t.body, align: 'center', name: 'Tagline' });
  const st = stackDown([pic, brand, sub], 90, [28, 20]);
  const b = button(c, { href: '/contact', x: 0, y: st.y + 34, look: 'solid' });
  b.box.desktop.x = Math.round((W - b.box.desktop.w) / 2);
  return section([...st.nodes, b], st.y + 34 + 50 + 100, t.bg, 'banner-image-atomic');
}

/** A numbered list on the left, a drawn sunburst on the right (kept under 358px so a phone needs no rescale). */
function featureList(c: Ctx, tn: Tone): Section {
  const t = tone(c, tn);
  const head = text(c, { text: 'What blooms here', x: PAD, y: 0, w: 560, size: 46, color: t.head, font: 'head', name: 'Heading' });
  const rows: Node[] = [];
  for (let i = 0; i < 3; i++) {
    const num = text(c, { text: String(i + 1).padStart(2, '0'), x: 0, y: 0, w: 560, pct: 100, size: 15, color: c.pal.accent, weight: 700, name: 'Number' });
    const ti = text(c, { slot: 'offering.title', x: 0, y: num.box.desktop.h + 6, w: 560, pct: 100, size: 24, color: t.head, font: 'head', role: 'h3', name: 'Title' });
    const bo = text(c, { slot: 'offering.body', x: 0, y: ti.box.desktop.y + ti.box.desktop.h + 8, w: 560, pct: 100, size: 15, color: t.body, name: 'Body' });
    const rule = shape(c, { x: 0, y: bo.box.desktop.y + bo.box.desktop.h + 18, w: 560, h: 1, pct: 100, fill: t.line, name: 'Rule' });
    rows.push(group(c, { name: `Feature ${i + 1}`, x: 0, y: 0, w: 560, h: rule.box.desktop.y + 1, children: [num, ti, bo, rule], flow: { gap: 8, pad: 0 } }));
  }
  const rh = Math.max(...rows.map((r) => r.box.desktop.h));
  for (const r of rows) r.box.desktop.h = rh;
  const list = group(c, { name: 'Features', x: PAD, y: 0, w: 560, h: rh * 3 + 28 * 2, children: rows, layout: { cols: 1, bp: { tablet: 1, mobile: 1 }, gap: 28 } });
  const st = stackDown([head, list], 100, 40);
  // the sunburst: three rings and a flower glyph
  const d = 340;
  const kids: Node[] = [
    shape(c, { x: 0, y: 0, w: d, h: d, fill: 'rgba(242,97,29,0.12)', radius: d / 2, name: 'Glow' }),
    shape(c, { x: 50, y: 50, w: d - 100, h: d - 100, fill: 'rgba(242,97,29,0.22)', radius: (d - 100) / 2, name: 'Ring' }),
    shape(c, { x: 100, y: 100, w: d - 200, h: d - 200, fill: c.pal.accent, radius: (d - 200) / 2, name: 'Sun' }),
    text(c, { text: '✿', x: 0, y: d / 2 - 40, w: d, size: 64, color: c.pal.accentInk, align: 'center', lh: 1.1, name: 'Glyph' }),
  ];
  const art = group(c, { name: 'Sunburst', x: W - PAD - d - 40, y: 100 + (st.y - 100 - d) / 2, w: d, h: d, children: kids });
  return section([...st.nodes, ...stackLast([art])], st.y + 100, t.bg);
}

/** One line of offerings scrolling across the band. */
function ticker(c: Ctx, tn: Tone, size = 34): Section {
  const t = tone(c, tn);
  const words = Array.from({ length: 4 }, (_, i) => copy(c, 'offering.title', i).text);
  const line = { ...text(c, { text: words.join('   ✿   '), x: 0, y: 30, w: 6000, pct: 100, size, color: tn === 'dark' ? (c.pal.darkAccent ?? t.head) : t.head, font: 'head', role: 'p', lh: 1.2, name: 'Ticker' }), anim: { type: 'marquee', durationMs: 28000 } };
  return section([line], line.box.desktop.y + line.box.desktop.h + 30, t.bg);
}

const spec: TemplateSpec = {
  key: '6beab4a1',
  ref: '6beab4a1',
  name: 'Petalglass Players',
  industry: 'actor',
  category: 'Actor',
  description: 'A powder-blue player\'s page: a round portrait over a giant wordmark, a numbered list beside a drawn sun, a petal ticker.',
  palette: {
    bg: '#bccfe3',
    surface: '#d6e2ef',
    ink: '#111111',
    body: '#2b2f36',
    muted: '#4d5866',
    accent: '#f2611d',
    accentInk: '#111111',
    dark: '#111111',
    darkInk: '#d6e2ef',
    darkBody: 'rgba(214,226,239,0.82)',
    darkAccent: '#f2611d',
    line: 'rgba(17,17,17,0.18)',
  },
  fonts: { head: serif, body: sans, headWeight: 600, headTrack: -0.5, btnRadius: 999, cardRadius: 24 },
  chrome: { nav: 'brand-left, links right, orange pill CTA', footer: 'blue, giant brand wordmark across, small links under' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        bloomHero(c, '@flowers|nature'),
        featureList(c, 'surface'),
        ticker(c, 'dark'),
        photoBand(c, { photo: '@forest|moss', tone: 'bg', h: 540, radius: 28 }),
        centered(c, { tone: 'bg', heading: 'Come and watch the petals fall', button: true }),
      ],
    },
    {
      slug: 'projects',
      title: 'Projects',
      build: (c) => [
        pageTitle(c, { title: 'Petal plays', tone: 'bg' }),
        zigzag(c, { tone: 'surface', rows: [{ photo: '@mushroom|moss', bullets: 2 }, { photo: '@forest|moss', bullets: 2 }] }),
        posts(c, { n: 3, photos: ['@flowers|nature', '@mushroom|moss', '@forest|moss'], tone: 'bg', head: { heading: 'From the dressing-burrow' } }),
      ],
    },
    {
      slug: 'courses',
      title: 'Courses',
      build: (c) => [
        pageTitle(c, { title: 'Lessons in the glade', tone: 'surface' }),
        pricing(c, { n: 3, tone: 'bg' }),
        reviews(c, { n: 3, tone: 'surface', head: { heading: 'Said by past pupils' } }),
        faq(c, { n: 4, tone: 'bg' }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Leave a petal at the door' }), ticker(c, 'accent', 28)],
    },
  ],
};
export default spec;

// Ref — a night-black app maker: a heavy capital headline centred over a lime pill, then a wall of phone screens.
// Kept: centred capital hero + one pill · a wall of drawn phones · "why we're best" card grid · three big numbers ·
// three quote cards · closing call-to-action.
import {
  avatarsFor, button, cards, ctaBand, faq, group, pageTitle, PAD, pricing, reviews, section, shape, stackDown, stats, steps, team,
  text, tone, W, type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';

const sans = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

/** Capital headline, centred, a short line under it and one lime pill. */
function capsHero(c: Ctx): Section {
  const t = tone(c, 'bg');
  const nodes: Node[] = [
    text(c, { slot: 'headline', x: 130, y: 0, w: 940, size: 66, color: t.head, font: 'head', weight: 800, upper: true, align: 'center', lh: 1.05, role: 'h1', name: 'Headline' }),
    text(c, { slot: 'subhead', x: 300, y: 0, w: 600, size: 18, color: t.body, align: 'center', name: 'Subhead' }),
  ];
  const st = stackDown(nodes, 150, 24);
  const b = button(c, { href: '/contact', x: 0, y: st.y + 36 });
  b.box.desktop.x = Math.round((W - b.box.desktop.w) / 2);
  return section([...st.nodes, b], st.y + 36 + 50 + 110, t.bg);
}

/** A wall of drawn phones: each a rounded frame with a screen of blocks inside. */
function phoneWall(c: Ctx): Section {
  const t = tone(c, 'bg');
  const n = 5;
  const gap = 22;
  const cellW = (1080 - gap * (n - 1)) / n;
  const ph = 400;
  const screens = ['#c8f560', '#2a2f3a', '#7b6cff', '#ff8a5c', '#2fd3a0'];
  const phones: Node[] = [];
  for (let i = 0; i < n; i++) {
    const kids: Node[] = [
      shape(c, { x: 0, y: 0, w: cellW, pct: 100, h: ph, fill: '#1c1f27', radius: 30, border: 'rgba(255,255,255,0.14)', name: 'Phone' }),
      shape(c, { x: 10, y: 10, w: cellW - 20, pct: 90, h: ph - 20, fill: '#0e1015', radius: 22, name: 'Screen' }),
      shape(c, { x: 22, y: 40, w: cellW - 44, pct: 78, h: 150, fill: screens[i], radius: 16, name: 'Card' }),
      shape(c, { x: 22, y: 210, w: (cellW - 44) * 0.6, pct: 50, h: 12, fill: 'rgba(255,255,255,0.4)', radius: 6, name: 'Line' }),
      shape(c, { x: 22, y: 234, w: (cellW - 44) * 0.8, pct: 70, h: 12, fill: 'rgba(255,255,255,0.18)', radius: 6, name: 'Line' }),
      shape(c, { x: 22, y: 270, w: (cellW - 44) * 0.45, pct: 40, h: 60, fill: 'rgba(255,255,255,0.08)', radius: 12, name: 'Tile' }),
      shape(c, { x: 22 + (cellW - 44) * 0.52, y: 270, w: (cellW - 44) * 0.45, pct: 36, h: 60, fill: 'rgba(255,255,255,0.08)', radius: 12, name: 'Tile' }),
      shape(c, { x: 22, y: ph - 60, w: cellW - 44, pct: 78, h: 36, fill: i % 2 ? '#c8f560' : 'rgba(255,255,255,0.12)', radius: 18, name: 'Pill' }),
    ];
    phones.push(group(c, { name: `Phone ${i + 1}`, x: 0, y: 0, w: cellW, h: ph, children: kids }));
  }
  const g = group(c, { name: 'Phone wall', x: PAD, y: 20, w: 1080, h: ph, children: phones, layout: { cols: n, bp: { tablet: 3, mobile: 2 }, gap } });
  return section([g], ph + 120, t.bg);
}

const spec: TemplateSpec = {
  key: 'f60665f2',
  ref: 'f60665f2',
  name: 'Firefly Appwrights',
  industry: 'agency',
  category: 'Agency',
  description: 'A sprite app-forge at midnight: a shouting capital headline, a wall of glowing phones, lime sparks throughout.',
  palette: {
    bg: '#0a0b0e', surface: '#15171d', ink: '#f6f7f2', body: 'rgba(246,247,242,0.72)', muted: 'rgba(246,247,242,0.5)',
    accent: '#c8f560', accentInk: '#0a0b0e', dark: '#15171d', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.74)', darkAccent: '#c8f560',
    line: 'rgba(255,255,255,0.1)',
  },
  fonts: { head: sans, body: sans, headWeight: 800, headTrack: -0.5, btnRadius: 999, btnUpper: true, cardRadius: 22 },
  chrome: { nav: 'wordmark left, links centred, lime pill CTA right', footer: 'black: wordmark, links in a row, socials, fine print' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        capsHero(c),
        phoneWall(c),
        cards(c, { n: 4, cols: 2, kind: 'icon', tone: 'surface', align: 'left', head: { eyebrow: true, heading: 'Why our sparks fly further', align: 'left' } }),
        stats(c, { n: 3, tone: 'bg', head: { heading: 'Heard from the hollows' } }),
        reviews(c, { n: 3, tone: 'surface', head: false, avatars: avatarsFor(c.site, 1) }),
        ctaBand(c, { tone: 'accent' }),
      ],
    },
    {
      slug: 'apps',
      title: 'Apps',
      build: (c) => [
        pageTitle(c, { title: 'Glow-apps we forged', tone: 'bg', intro: true }),
        phoneWall(c),
        cards(c, { n: 3, cols: 3, kind: 'numbered', tone: 'surface', head: false }),
      ],
    },
    {
      slug: 'pricing',
      title: 'Pricing',
      build: (c) => [
        pageTitle(c, { title: 'Spark plans', tone: 'surface' }),
        pricing(c, { n: 3, tone: 'bg', head: false }),
        faq(c, { n: 5, tone: 'surface', side: true }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'The forge crew', tone: 'bg' }),
        steps(c, { n: 4, tone: 'surface', head: { heading: 'From spark to screen' } }),
        team(c, { n: 4, avatars: avatarsFor(c.site, 3), tone: 'bg', ring: '#c8f560' }),
      ],
    },
  ],
};
export default spec;

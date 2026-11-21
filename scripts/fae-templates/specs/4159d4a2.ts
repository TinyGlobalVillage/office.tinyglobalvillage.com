// Ref — a deep-navy "coming soon" page: blue orbs drifting behind a thin capital headline, a four-part countdown, rolling waves.
// Kept: orb-scattered hero with thin capital headline · four-cell countdown · wave edge · centred "are you ready" sign-up
// (email field + blue button) · three-part footer line.
import {
  avatarsFor, bottom, button, centered, contact, faq, group, pageTitle, section, splitHeading, stackDown, stats, team, text,
  tone, W, type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';

const sans = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

const NAVY = '#0a1433';
/** An orb painted into the band itself (a background, so it never stacks between the words on a phone);
 *  the sanitizer takes one gradient per band, so the reference's scatter of orbs becomes one ringed orb. */
const ORBS = `radial-gradient(circle at 84% 24%, #2f5bff 0%, #2f5bff 14%, #1d3fd0 14.5%, #1d3fd0 22%, ${NAVY} 22.5%)`;
/** The deep-water edge along the foot of a band (the reference's rolling waves, flattened to one gradient). */
const WAVES = `linear-gradient(180deg, ${NAVY} 0%, ${NAVY} 78%, #1d3fd0 78.5%, #2f5bff 100%)`;

/** The thin capital headline, a short line, and a four-cell countdown. */
function soonHero(c: Ctx): Section {
  const t = tone(c, 'bg');
  const nodes: Node[] = [
    text(c, { text: 'Something is stirring', x: 300, y: 0, w: 600, size: 15, color: '#8fb0ff', weight: 600, upper: true, track: 4, align: 'center', name: 'Eyebrow' }),
    text(c, { slot: 'headline', x: 100, y: 0, w: 1000, size: 84, color: t.head, font: 'head', weight: 200, upper: true, track: 6, align: 'center', lh: 1.05, role: 'h1', name: 'Headline' }),
    text(c, { slot: 'subhead', x: 300, y: 0, w: 600, size: 17, color: t.body, align: 'center', name: 'Subhead' }),
  ];
  const st = stackDown(nodes, 150, [20, 22]);
  const cellW = 150;
  const gap = 20;
  const cells: Node[] = [
    ['12', 'Days'],
    ['07', 'Hours'],
    ['42', 'Minutes'],
    ['19', 'Seconds'],
  ].map(([v, l], i) =>
    group(c, {
      name: `Count ${i + 1}`, x: 0, y: 0, w: cellW, h: 104, border: 'rgba(255,255,255,0.2)', radius: 14,
      children: [
        text(c, { text: v, x: 0, y: 16, w: cellW, pct: 100, size: 44, color: '#ffffff', font: 'head', weight: 300, align: 'center', lh: 1.1, name: 'Value' }),
        text(c, { text: l, x: 0, y: 70, w: cellW, pct: 100, size: 12, color: '#8fb0ff', weight: 600, upper: true, track: 2, align: 'center', name: 'Label' }),
      ],
    }),
  );
  const gw = cellW * 4 + gap * 3;
  const g = group(c, { name: 'Countdown', x: (W - gw) / 2, y: st.y + 50, w: gw, h: 104, children: cells, layout: { cols: 4, bp: { tablet: 4, mobile: 2 }, gap } });
  return section([...st.nodes, g], bottom(g) + 170, ORBS);
}

/** "Are you ready?" — heading, line, email field + blue button, on a wave-edged band. */
function ready(c: Ctx): Section {
  const t = tone(c, 'bg');
  const head = text(c, { text: 'Ready for the reveal?', x: 200, y: 0, w: 800, size: 42, color: t.head, font: 'head', weight: 300, align: 'center', name: 'Heading' });
  const p = text(c, { slot: 'newsletter', x: 300, y: 0, w: 600, size: 17, color: t.body, align: 'center', name: 'Paragraph' });
  const st = stackDown([head, p], 100, 16);
  const fy = st.y + 36;
  const fw = 400;
  const bw = 180;
  const fx = (W - fw - 12 - bw) / 2;
  const field = group(c, {
    name: 'Email field', x: fx, y: fy, w: fw, h: 50, fill: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.3)', radius: 8,
    children: [text(c, { text: 'your@hollow.fae', x: 20, y: 14, w: fw - 40, size: 15, color: 'rgba(255,255,255,0.5)', name: 'Placeholder' })],
  });
  const b = button(c, { text: 'Keep me posted', href: '/contact', x: fx + fw + 12, y: fy, w: bw });
  return section([...st.nodes, field, b], fy + 50 + 190, WAVES);
}

/** A thin three-part line: address · wordmark-free motto · email. */
function footLine(c: Ctx): Section {
  const t = tone(c, 'dark');
  const cw = 340;
  const gap = 30;
  const parts: Node[] = [
    text(c, { slot: 'address', index: 0, x: 0, y: 0, w: cw, pct: 100, size: 14, color: t.body, align: 'center', name: 'Address' }),
    text(c, { text: '✦ Made under the tide ✦', x: 0, y: 0, w: cw, pct: 100, size: 14, color: '#8fb0ff', weight: 600, align: 'center', name: 'Motto' }),
    text(c, { slot: 'email', index: 0, x: 0, y: 0, w: cw, pct: 100, size: 14, color: t.body, align: 'center', name: 'Email' }),
  ];
  const g = group(c, { name: 'Foot line', x: (W - (cw * 3 + gap * 2)) / 2, y: 40, w: cw * 3 + gap * 2, h: 30, children: parts, layout: { cols: 3, bp: { tablet: 3, mobile: 1 }, gap } });
  return section([g], 110, t.bg);
}

const spec: TemplateSpec = {
  key: '4159d4a2',
  ref: '4159d4a2',
  name: 'Tidewhisper Lab',
  industry: 'agency',
  category: 'Agency',
  description: 'A merrow-lit lab counting down to its reveal: blue orbs, a thin capital headline, a ticking countdown, rolling waves.',
  palette: {
    bg: NAVY, surface: '#101d45', ink: '#ffffff', body: 'rgba(255,255,255,0.74)', muted: 'rgba(255,255,255,0.52)',
    accent: '#2f5bff', accentInk: '#ffffff', dark: '#060c22', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.7)', darkAccent: '#8fb0ff',
    line: 'rgba(255,255,255,0.14)',
  },
  fonts: { head: sans, body: sans, headWeight: 300, headTrack: 2, btnRadius: 8, btnUpper: true, cardRadius: 14 },
  chrome: { nav: 'wordmark left, two links + blue CTA right, on navy', footer: 'navy line in three parts: address · motto · email' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [soonHero(c), ready(c), footLine(c)],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'Who stirs the tide', tone: 'surface' }),
        splitHeading(c, { tone: 'bg', paras: 2, button: false }),
        stats(c, { n: 3, tone: 'surface' }),
        team(c, { n: 3, avatars: avatarsFor(c.site, 8), tone: 'bg', ring: '#2f5bff' }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [
        contact(c, { tone: 'bg', heading: 'Send word down the current' }),
        faq(c, { n: 4, tone: 'surface' }),
        centered(c, { tone: 'dark', heading: 'See you at the reveal', button: true }),
      ],
    },
  ],
};
export default spec;

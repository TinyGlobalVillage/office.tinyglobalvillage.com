// Ref — a bright product studio washing white into soft blue: words left, a cluster of glossy shapes right, black pill buttons.
// Kept: split hero (words left, drawn shapes right) · a row of wordmarks · centred pill label + heading + intro ·
// a dashboard panel on its own band · four unboxed icon cards with "learn more" on pale lilac · two-card closing grid.
import {
  artBand, avatarsFor, cards, centered, ctaBand, faq, group, hero, listPanel, logos, pageTitle, pricing, reviews, shape, stats, steps,
  type Ctx, type Node, type TemplateSpec,
} from '../kit.ts';

const grot = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";

/** Glossy orbs and blocks, drawn in a panel narrow enough to keep its circles round on a phone. */
function orbs(c: Ctx, x: number, y: number, w: number, h: number): Node[] {
  const gw = 340;
  const gh = 380;
  const kids: Node[] = [
    shape(c, { x: 40, y: 30, w: 260, h: 260, fill: '#b9c8ff', radius: 130, name: 'Big orb' }),
    shape(c, { x: 90, y: 80, w: 160, h: 160, fill: '#6f8dff', radius: 80, name: 'Mid orb' }),
    shape(c, { x: 210, y: 220, w: 120, h: 120, fill: '#1d2bd6', radius: 28, name: 'Block', shadow: '0px 24px 40px rgba(29,43,214,0.28)' }),
    shape(c, { x: 10, y: 250, w: 96, h: 96, fill: '#ffffff', radius: 48, name: 'Pearl', shadow: '0px 18px 36px rgba(40,60,160,0.22)' }),
    shape(c, { x: 250, y: 20, w: 54, h: 54, fill: '#0c0d14', radius: 27, name: 'Bead' }),
  ];
  return [group(c, { name: 'Orbs', x: x + (w - gw) / 2, y: y + Math.max(0, (h - gh) / 2), w: gw, h: gh, children: kids })];
}

const spec: TemplateSpec = {
  key: '7145f715',
  ref: '7145f715',
  name: 'Bluebell Blockwrights',
  industry: 'agency',
  category: 'Agency',
  description: 'A bright pixie studio washed in bluebell light: glossy drawn shapes, a tally panel, unboxed icon cards.',
  palette: {
    bg: '#ffffff', surface: '#f1f0ff', ink: '#0c0d14', body: '#4a4c5e', muted: '#7a7c8e',
    accent: '#0c0d14', accentInk: '#ffffff', dark: '#11143a', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', darkAccent: '#b9c8ff',
    line: '#e2e2f0',
  },
  fonts: { head: grot, body: grot, headWeight: 600, headTrack: -1, btnRadius: 999, cardRadius: 18 },
  chrome: { nav: 'wordmark left, links centred, black pill CTA right', footer: 'white, wordmark + blurb left, four link columns' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => {
        const top = hero(c, { variant: 'split-art', tone: 'bg', art: orbs, h: 640, buttons: 2 });
        top.layersFrame.background = 'linear-gradient(180deg, #ffffff 0%, #dde5ff 100%)';
        return [
          top,
          logos(c, { tone: 'bg', seeds: ['bell-a', 'bell-b', 'bell-c', 'bell-d', 'bell-e'] }),
          centered(c, { tone: 'bg', eyebrow: 'How we build', heading: 'Every banner, one bright loom' }),
          artBand(c, { tone: 'bg', art: listPanel({ card: '#ffffff', ink: '#0c0d14', muted: '#7a7c8e', accent: '#1d2bd6', line: '#e2e2f0', avatars: avatarsFor(c.site, 2) }), h: 400 }),
          cards(c, { n: 4, cols: 4, kind: 'icon', tone: 'surface', cardFill: false, link: '/services', align: 'left', head: { eyebrow: true, heading: 'What the loom weaves', align: 'left' } }),
          cards(c, { n: 2, cols: 2, kind: 'plain', tone: 'bg', head: { heading: 'All a guild could want', intro: true } }),
          ctaBand(c, { tone: 'dark', buttons: 2 }),
        ];
      },
    },
    {
      slug: 'features',
      title: 'Features',
      build: (c) => [
        pageTitle(c, { title: 'What the loom can do', tone: 'surface', intro: true }),
        cards(c, { n: 6, cols: 3, kind: 'numbered', tone: 'bg', head: false }),
        stats(c, { n: 3, tone: 'surface' }),
      ],
    },
    {
      slug: 'pricing',
      title: 'Pricing',
      build: (c) => [
        pageTitle(c, { title: 'Pick your bundle', tone: 'bg', intro: true }),
        pricing(c, { n: 3, tone: 'surface', head: false }),
        faq(c, { n: 5, tone: 'bg' }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'Who turns the loom', tone: 'surface' }),
        steps(c, { n: 3, tone: 'bg', head: { heading: 'How a banner grows' } }),
        reviews(c, { n: 3, tone: 'surface', head: { heading: 'Kind words from the hollows' } }),
      ],
    },
  ],
};
export default spec;

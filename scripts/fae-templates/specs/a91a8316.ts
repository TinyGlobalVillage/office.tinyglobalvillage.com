// Ref — a bold martial-arts school: a dark photo hero with left-set capitals, a yellow band of picture + words,
// a boxed block of numbered principles, black instructor cards, plain bold type throughout.
// Kept: left-aligned photo hero · picture-left story on the accent colour · boxed principles grid with a big number ·
// dark team row with bios.
import { avatarsFor, cards, contact, faq, group, hero, imageStory, pageTitle, pricing, section, shape, stats, team, text, tone, steps, centered, CW, PAD, type Ctx, type Node, type Section, type TemplateSpec } from '../kit.ts';

const helv = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const WAYS = ['Patience', 'Balance', 'Courage', 'Kindness', 'Focus', 'Respect'];

/** A bordered box: a large numeral and title, then a grid of six short virtue words (the reference's principles). */
function principles(c: Ctx): Section {
  const t = tone(c, 'bg');
  const num = text(c, { text: '6', x: PAD + 50, y: 0, w: 200, pct: 50, size: 120, color: c.pal.accent, font: 'head', weight: 800, lh: 1, name: 'Numeral' });
  const ti = text(c, { text: 'Ways of the willow', x: PAD + 50, y: 0, w: CW - 100, pct: 90, size: 34, color: t.head, font: 'head', upper: true, name: 'Title' });
  const cells: Node[] = WAYS.map((w, i) => text(c, { text: `${String(i + 1).padStart(2, '0')}  ${w}`, x: 0, y: 0, w: 300, pct: 100, size: 20, color: t.ink, weight: 700, upper: true, track: 1, lh: 1.3, name: 'Way' }));
  const gw = CW - 100;
  const gh = 2 * 40 + 24;
  const kids: Node[] = [];
  num.box.desktop.y = 50;
  ti.box.desktop.y = 50 + num.box.desktop.h + 10;
  const grid = group(c, { name: 'Ways', x: 50, y: ti.box.desktop.y + ti.box.desktop.h + 36, w: gw, pct: 90, h: gh, children: cells, layout: { cols: 3, bp: { tablet: 2, mobile: 1 }, gap: 24 } });
  num.box.desktop.x = 50;
  ti.box.desktop.x = 50;
  kids.push(num, ti, grid);
  const bh = grid.box.desktop.y + gh + 50;
  const boxed = group(c, { name: 'Principles', x: PAD, y: 90, w: CW, h: bh, children: kids, flow: { gap: 16, pad: 50 }, border: c.pal.ink, fill: c.pal.bg });
  // a thick yellow bar on the box's top edge
  const bar = shape(c, { x: PAD, y: 82, w: CW, h: 8, fill: c.pal.accent, name: 'Bar' });
  return section([bar, boxed], 90 + bh + 100, t.bg);
}

const spec: TemplateSpec = {
  key: 'a91a8316',
  ref: 'a91a8316',
  name: 'Willowfist Dojo',
  industry: 'education',
  category: 'Education',
  description: 'A bold gnome training hall in black and sun-yellow: a dusky hero in heavy capitals, a boxed six-way creed, stern masters.',
  palette: { bg: '#ffffff', surface: '#f3f3f3', ink: '#0d0d0d', body: '#333333', muted: '#666666', accent: '#fbbf18', accentInk: '#0d0d0d', dark: '#0d0d0d', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#fbbf18', line: 'rgba(13,13,13,0.14)' },
  fonts: { head: helv, body: helv, headWeight: 800, headTrack: -0.5, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'black bar: logo left, capital links right, yellow "free trial" button', footer: 'black, logo + hours + links in columns, yellow rule' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'photo-left', photo: '@workshop|studio', h: 620, buttons: 2, overlay: 'rgba(0,0,0,0.55)' }),
        imageStory(c, { photo: '@forest|mist', side: 'left', tone: 'accent', button: true, h: 600 }),
        principles(c),
        team(c, { n: 3, avatars: avatarsFor(c.site, 5), tone: 'dark', bio: true, head: { heading: 'The masters of the mat' } }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'About the dojo', tone: 'dark' }),
        centered(c, { tone: 'bg', eyebrow: true }),
        stats(c, { n: 4, tone: 'accent' }),
      ],
    },
    {
      slug: 'programs',
      title: 'Programs',
      build: (c) => [
        pageTitle(c, { title: 'Programs', tone: 'accent' }),
        cards(c, { n: 4, cols: 2, kind: 'numbered', tone: 'bg', head: false }),
        pricing(c, { n: 3, tone: 'surface', head: { heading: 'Monthly mat fees' } }),
      ],
    },
    {
      slug: 'staff',
      title: 'Staff',
      build: (c) => [
        pageTitle(c, { title: 'Our masters', tone: 'dark' }),
        team(c, { n: 4, avatars: avatarsFor(c.site, 5), tone: 'bg', bio: true, head: false }),
        steps(c, { n: 3, tone: 'surface', head: { heading: 'From white sash to gold' } }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Step onto the mat' }), faq(c, { n: 5, tone: 'surface' })],
    },
  ],
};
export default spec;

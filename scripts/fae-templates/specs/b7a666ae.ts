// Ref — a cause journal on white with a black bar and a magenta accent: a full-bleed photo hero with one centred
// statement, a centred mission block with an outline button, a dark giving band (copy left, a 2x3 grid of amount
// boxes right), two picture stories with links, a row of numbers and a closing call band.
// Kept: centred photo hero · centred mission + outline button · dark giving band with amount grid · two
// picture cards · stats row · call band · about + news inner pages.
import { CW, PAD, avatarsFor, bottom, button, cards, centered, contact, ctaBand, group, hero, imageStory, pageTitle, section, shape, stats, team, text, tone, type Ctx, type Node, type Section, type TemplateSpec } from '../kit.ts';

const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MAG = '#e4007c';

/** Dark band: heading + paragraph + button left; a 2x3 grid of outlined acorn amounts right. */
function giving(c: Ctx): Section {
  const t = tone(c, 'dark');
  const h = text(c, { text: 'Plant an acorn today', x: PAD, y: 110, w: 460, size: 44, color: t.head, font: 'head', weight: 800, role: 'h2', lh: 1.08, name: 'Heading' });
  const p = text(c, { slot: 'mission', x: PAD, y: bottom(h) + 20, w: 440, size: 16, color: t.body, name: 'Paragraph' });
  const b = button(c, { text: 'Give now', href: '/contact', x: PAD, y: bottom(p) + 30, look: 'solid' });
  const amounts = ['3 acorns', '7 acorns', '12 acorns', '25 acorns', '50 acorns', 'Your own'];
  const cellW = 170;
  const boxes: Node[] = amounts.map((a, i) => group(c, { name: `Amount ${i + 1}`, x: 0, y: 0, w: cellW, h: 96, border: i === 1 ? MAG : 'rgba(255,255,255,0.55)', fill: i === 1 ? MAG : undefined, children: [
    text(c, { text: a, x: 0, y: 30, w: cellW, pct: 100, size: 20, color: '#ffffff', font: 'head', weight: 700, align: 'center', lh: 1.3, name: 'Amount' }),
  ] }));
  const gw = cellW * 3 + 20 * 2;
  const grid = group(c, { name: 'Amounts', x: 1200 - PAD - gw, y: 120, w: gw, h: 96 * 2 + 20, children: boxes, layout: { cols: 3, bp: { tablet: 3, mobile: 2 }, gap: 20 } });
  const H = Math.max(bottom(b), bottom(grid)) + 110;
  return section([h, p, b, grid], H, t.bg);
}

/** A thin magenta strip with one centred line (the colour ribbon between bands). */
function ribbon(c: Ctx, line: string): Section {
  const s = shape(c, { x: 0, y: 0, w: 1200, h: 64, fill: MAG, name: 'Ribbon' });
  const tx = text(c, { text: line, x: PAD, y: 18, w: CW, size: 18, color: '#ffffff', font: 'head', weight: 700, align: 'center', upper: true, track: 1.5, lh: 1.3, name: 'Line' });
  return section([s, tx], 64, MAG);
}

const spec: TemplateSpec = {
  key: 'b7a666ae',
  ref: 'b7a666ae',
  name: 'Every Wing Fund',
  industry: 'blog',
  category: 'Blog',
  description: 'A fae cause journal for every wing and root: a bold photo opening, an acorn-giving band and news from the field.',
  palette: { bg: '#ffffff', surface: '#f4f1f3', ink: '#0b0b0b', body: '#3b3b3b', muted: '#757575', accent: MAG, accentInk: '#ffffff', dark: '#0b0b0b', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: MAG, line: 'rgba(11,11,11,0.14)' },
  fonts: { head: sans, body: sans, headWeight: 800, headTrack: -0.5, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'black bar, wordmark left, links right, magenta give button', footer: 'black, wordmark + three link columns + socials' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'photo-center', photo: '@forest|nature', h: 640, buttons: 1, overlay: 'rgba(0,0,0,0.42)', headSize: 64 }),
        centered(c, { tone: 'bg', heading: 'Every wing deserves the sky', slot: 'about', button: true }),
        giving(c),
        cards(c, { n: 2, cols: 2, kind: 'photo', tone: 'bg', photos: ['@moss|nature', '@mist'], head: { heading: 'From the field' }, titleSlot: 'post.title', bodySlot: 'post.excerpt', link: '/news', cardFill: false, imgH: 380 }),
        ribbon(c, 'Hearth to hearth, root to root'),
        stats(c, { n: 4, tone: 'surface' }),
        ctaBand(c, { tone: 'dark', buttons: 2 }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'Why we gather', tone: 'surface' }),
        imageStory(c, { photo: '@mist', side: 'right', tone: 'bg', eyebrow: true }),
        team(c, { n: 4, avatars: avatarsFor(c.site, 1), tone: 'surface', head: { heading: 'Our circle of keepers' } }),
      ],
    },
    {
      slug: 'news',
      title: 'News',
      build: (c) => [
        pageTitle(c, { title: 'News from the field', tone: 'dark' }),
        cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'bg', head: false, titleSlot: 'post.title', bodySlot: 'post.excerpt', link: '/news' }),
        ribbon(c, 'Every acorn is a seedling'),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Lend a wing' })],
    },
  ],
};
export default spec;

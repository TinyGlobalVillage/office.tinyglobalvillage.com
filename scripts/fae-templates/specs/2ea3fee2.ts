// Ref — a bright, busy fashion-shop front: a mosaic of photo and colour tiles each with its own button, a red sale
// ribbon, round product bubbles on grey, a five-wide product grid with colour dots, a dark band with a rounded photo
// beside white pill rows, and a centred line of figures.
// Kept: mosaic hero tiles · sale ribbon · round product bubbles · 5-col product grid w/ swatches · dark photo + pill
// rows band · centred stats.
import {
  PAD, bottom, contact, group, hOf, image, pageTitle, section, splitHeading, stackDown, stackLast, stats, team, avatarsFor,
  text, tone, type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';
import { circleRow, marquee, shelf, tileRows } from './91242216.ts';

const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const grot = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";

/** Dark band: a rounded photo on the left, a heading and four white pill rows on the right. */
function pillBand(ctx: Ctx, photo: string): Section {
  const t = tone(ctx, 'dark');
  const pic = image(ctx, { key: photo, x: PAD, y: 90, w: 500, h: 460, radius: 28 });
  const words: Node[] = [
    text(ctx, { text: 'Why the hollow shops with us', x: 620, y: 0, w: 520, size: 36, color: t.head, font: 'head', role: 'h2', name: 'Heading' }),
    text(ctx, { slot: 'subhead', x: 620, y: 0, w: 520, size: 16, color: t.body, name: 'Intro' }),
  ];
  const st = stackDown(words, 100, [14, 30]);
  const pills: Node[] = [];
  for (let i = 0; i < 4; i++) {
    const tx = text(ctx, { slot: 'offering.title', index: i + 4, x: 24, y: 0, w: 472, pct: 90, size: 16, color: '#141414', weight: 600, name: 'Pill text' });
    pills.push(group(ctx, { name: `Pill ${i + 1}`, x: 0, y: 0, w: 520, h: hOf(tx) + 32, fill: '#ffffff', radius: 30, children: [tx], flow: { gap: 0, pad: 16 } }));
  }
  const ph = Math.max(...pills.map(hOf));
  for (const p of pills) p.box.desktop.h = ph;
  const list = group(ctx, { name: 'Pills', x: 620, y: st.y, w: 520, h: ph * 4 + 14 * 3, children: pills, layout: { cols: 1, bp: { tablet: 1, mobile: 1 }, gap: 14 } });
  return section([...st.nodes, list, ...stackLast([pic])], Math.max(bottom(pic), bottom(list)) + 90, t.bg);
}

const spec: TemplateSpec = {
  key: '2ea3fee2', ref: '2ea3fee2', name: 'Poppycap Emporium', industry: 'ecommerce', category: 'Ecommerce',
  description: 'A loud, cheerful gnome emporium: a patchwork of photo and colour tiles, a poppy-red sale ribbon and a wide wall of goods.',
  palette: { bg: '#ffffff', surface: '#f2f2f2', ink: '#141414', body: '#4b4b4b', muted: '#8a8a8a', accent: '#e02424', accentInk: '#ffffff', dark: '#141414', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#ffffff', line: 'rgba(0,0,0,0.1)' },
  fonts: { head: grot, body: sans, headWeight: 700, headTrack: -0.6, btnRadius: 999, btnUpper: false, cardRadius: 18 },
  chrome: { nav: 'white bar: wordmark left, links centre, search/account/cart right', footer: 'dark, newsletter row over link columns' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      tileRows(c, { tone: 'bg', top: 24, bottomPad: 40, rows: [
        { h: 440, items: [{ photo: '@fabric|craft', heading: 'Wrapped for the frost', sub: true, button: true }, { photo: '@flowers|garden', heading: 'Petal season is here', sub: true, button: true }] },
        { h: 260, items: [{ fill: '#ffd6d6', button: true }, { fill: '#d9ecff', button: true }, { fill: '#fff1c7', button: true }, { fill: '#dff3e1', button: true }] },
      ] }),
      marquee(c, { tone: 'accent', words: ['Mushroom-moon sale', 'Free owl post over 40 silver', 'New stitches every week', 'Mushroom-moon sale'] }),
      circleRow(c, { n: 6, tone: 'surface', fills: ['#ffffff'], d: 96, head: { heading: 'Shop by shelf', align: 'center' } }),
      shelf(c, { n: 10, cols: 5, tone: 'bg', head: { heading: 'Most loved in the emporium', button: 'See all' }, tiles: ['#f2f2f2'], chips: ['', 'Sale', '', '', 'New', '', '', 'Sale', '', ''], swatches: true, titleSize: 14 }),
      pillBand(c, '@workshop|craft'),
      stats(c, { n: 3, tone: 'bg', head: { heading: 'Counted by the gnomes', align: 'center' } }),
    ] },
    { slug: 'shop', title: 'Shop', build: (c) => [
      pageTitle(c, { title: 'Every shelf', tone: 'surface' }),
      shelf(c, { n: 10, cols: 5, tone: 'bg', head: false, tiles: ['#f2f2f2'], chips: ['New', '', '', 'Sale', ''], swatches: true, titleSize: 14, button: 'Load more' }),
      marquee(c, { tone: 'dark', words: ['Swaps within a moon', 'Owl post to every glade', 'Stitched by hand'] }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'Who runs the emporium', tone: 'bg', intro: true }),
      splitHeading(c, { tone: 'surface', paras: 2 }),
      team(c, { n: 4, avatars: avatarsFor(c.site, 1), tone: 'bg', ring: '#e02424' }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'surface' })] },
  ],
};
export default spec;


// Ref — a quiet landscape photographer: no hero at all, just a three-column grid of square, pale works with a caption under each.
// Kept: the 3×3 captioned grid as the whole home page · (journal + contact from the nav).
// The pool cannot fill nine squares, so three are photographs and six are painted colour studies drawn from shapes.
import { bottom, contact, CW, group, image, PAD, pageTitle, posts, section, shape, text, tone, centered, type Ctx, type Node, type TemplateSpec } from '../kit.ts';
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** Sky / ground / moon colours for a painted tile. */
const PAINTS: Array<[string, string, string?]> = [
  ['#e8ecef', '#c7d1d8', '#ffffff'],
  ['#f4efe5', '#e1d4bc'],
  ['#e9edec', '#9fb3ae', '#f7f3ea'],
  ['#ecebe8', '#7e8189'],
  ['#eef2f4', '#a9b9c3', '#ffffff'],
  ['#f2ece3', '#c49c84'],
];
const WORKS = ['Frost Spire', 'Low Tide Hollow', 'Swan Mere', 'Moth Hour', 'Far Shore', 'Bracken Road', 'Rime Field', 'Old Jetty', 'Lantern Pier'];
const PHOTO_AT: Record<number, string> = { 1: '@mist|landscape', 5: '@forest|nature', 6: '@mist|water#2' };

function gallery(c: Ctx) {
  const t = tone(c, 'bg');
  const cols = 3;
  const gap = 28;
  const cellW = (CW - gap * (cols - 1)) / cols;
  const S = Math.round(cellW);
  let k = 0;
  const tiles: Node[] = WORKS.map((nm, i) => {
    const kids: Node[] = [];
    if (PHOTO_AT[i]) kids.push(image(c, { key: PHOTO_AT[i], x: 0, y: 0, w: cellW, h: S, pct: 100 }));
    else {
      const [sky, ground, moon] = PAINTS[k++ % PAINTS.length];
      const hz = Math.round(S * 0.64);
      kids.push(shape(c, { x: 0, y: 0, w: cellW, h: S, pct: 100, fill: sky, name: 'Sky' }));
      kids.push(shape(c, { x: 0, y: hz, w: cellW, h: S - hz, pct: 100, fill: ground, name: 'Ground' }));
      if (moon) kids.push(shape(c, { x: Math.round(cellW * 0.62), y: Math.round(S * 0.2), w: 44, h: 44, fill: moon, radius: 22, name: 'Moon' }));
    }
    const cap = text(c, { text: nm, x: 0, y: S + 10, w: cellW, pct: 100, size: 17, color: t.ink, align: 'center', name: 'Caption' });
    kids.push(cap);
    return group(c, { name: `Work ${i + 1}`, x: 0, y: 0, w: cellW, h: bottom(cap), children: kids });
  });
  const th = Math.max(...tiles.map((n) => n.box.desktop.h));
  for (const n of tiles) n.box.desktop.h = th;
  const rows = Math.ceil(WORKS.length / cols);
  const gh = rows * th + (rows - 1) * 36;
  return section([group(c, { name: 'Works', x: PAD, y: 48, w: CW, h: gh, children: tiles, layout: { cols, bp: { tablet: 2, mobile: 1 }, gap } })], 48 + gh + 90, t.bg);
}

const spec: TemplateSpec = {
  key: 'a13318f0', ref: 'a13318f0', name: 'Rime & Hollow', industry: 'artist', category: 'Artist',
  description: 'A faerie painter of pale far places: no hero, only a quiet grid of captioned works and plenty of white.',
  palette: { bg: '#ffffff', surface: '#f4f4f2', ink: '#151515', body: '#4a4a4a', muted: '#7a7a7a', accent: '#151515', accentInk: '#ffffff', dark: '#151515', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', line: 'rgba(21,21,21,0.12)' },
  fonts: { head: sans, body: sans, headWeight: 400, headTrack: -0.3, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'name-left in plain type, three small links + socials right', footer: 'centred socials over underlined links' },
  pages: [
    { slug: 'home', title: 'Work', build: (c) => [gallery(c)] },
    { slug: 'journal', title: 'Journal', build: (c) => [
      pageTitle(c, { title: 'Field notes', tone: 'bg', align: 'left' }),
      posts(c, { n: 3, photos: ['@mist|landscape', '@forest|nature', '@mist|water#2'], tone: 'bg', head: false }),
      centered(c, { tone: 'surface', heading: 'Letters from the far shore', slot: 'newsletter' }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Write to the studio' })] },
  ],
};
export default spec;

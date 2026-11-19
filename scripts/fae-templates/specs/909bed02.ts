// Ref — a quiet grey ceramics studio: a giant capital wordmark, one wide photo, then ruled notes — a small square
// marker on the left, words in the right half — a three-column ledger table of wares, an about note with a signature.
// Kept: giant type masthead · full-width photo · ruled note (marker left, text right) · ruled three-column table ·
// about note with a small portrait · contact note.
import { avatarsFor, cards, contact, faq, image, imageStory, pageTitle, photoBand, section, shape, stackDown, team, text, group, copy, W, CW, PAD, type Ctx, type Node, type Section, type TemplateSpec } from '../kit.ts';

const helv = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** The masthead: the house name set huge in capitals, the tagline under it on the right. */
function masthead(c: Ctx): Section {
  const big = text(c, { slot: 'brand', x: PAD, y: 110, w: CW, size: 112, color: c.pal.ink, font: 'head', weight: 700, upper: true, lh: 0.95, track: -3, role: 'h1', name: 'Wordmark' });
  const tag = text(c, { slot: 'tagline', x: W - PAD - 420, y: big.box.desktop.y + big.box.desktop.h + 26, w: 420, size: 15, color: c.pal.muted, align: 'right', name: 'Tagline' });
  return section([big, tag], tag.box.desktop.y + tag.box.desktop.h + 70, c.pal.bg);
}

/** A ruled note: a hairline across, a small square marker at the left, heading + words in the right half. */
function ruled(c: Ctx, o: { heading: string; extra?: Node[]; bg?: string; slots?: Array<'about' | 'mission' | 'paragraph' | 'subhead'> }): Section {
  const rule = shape(c, { x: PAD, y: 40, w: CW, h: 1, fill: c.pal.ink, name: 'Rule' });
  const mark = text(c, { text: '■', x: PAD, y: 70, w: 40, size: 14, color: c.pal.ink, lh: 1.2, name: 'Marker' });
  const nodes: Node[] = [text(c, { text: o.heading, x: 600, y: 0, w: 540, size: 26, color: c.pal.ink, font: 'head', name: 'Heading' })];
  for (const s of o.slots ?? ['about', 'mission']) nodes.push(text(c, { slot: s, x: 600, y: 0, w: 540, size: 16, color: c.pal.body, name: 'Paragraph' }));
  const st = stackDown(nodes, 66, 18);
  let y = st.y;
  const extra = o.extra ?? [];
  if (extra.length) {
    const ex = stackDown(extra, y + 30, 14);
    y = ex.y;
  }
  return section([rule, mark, ...st.nodes, ...extra], y + 90, o.bg ?? c.pal.bg);
}

const GLAZES = ['Moss celadon', 'Ash white', 'Ember rust', 'Mist blue', 'Fern speckle', 'Night tenmoku'];
const SEASONS = ['Bud moon', 'Leaf moon', 'Hay moon', 'Mist moon', 'Frost moon', 'Snow moon'];

/** A ruled three-column ledger of wares: name · glaze · firing season. A grid that keeps three columns on a phone. */
function ledger(c: Ctx, n = 6): Section {
  const head = text(c, { text: 'The kiln ledger', x: PAD, y: 70, w: 500, size: 26, color: c.pal.ink, font: 'head', name: 'Heading' });
  const cells: Node[] = [];
  const cell = (t: string, strong: boolean) => text(c, { text: t, x: 0, y: 0, w: 340, pct: 100, size: strong ? 12 : 15, color: strong ? c.pal.muted : c.pal.ink, weight: strong ? 700 : 400, upper: strong, track: strong ? 1.6 : undefined, lh: 1.4, name: strong ? 'Column' : 'Cell' });
  cells.push(cell('Ware', true), cell('Glaze', true), cell('Fired in', true));
  for (let i = 0; i < n; i++) cells.push(cell(copy(c, 'offering.title', i).text, false), cell(GLAZES[i % GLAZES.length], false), cell(SEASONS[(i * 2) % SEASONS.length], false));
  const rowH = 46;
  const gh = (n + 1) * rowH;
  const top = shape(c, { x: PAD, y: head.box.desktop.y + head.box.desktop.h + 30, w: CW, h: 1, fill: c.pal.ink, name: 'Rule' });
  const grid = group(c, { name: 'Ledger', x: PAD, y: top.box.desktop.y + 18, w: CW, h: gh, children: cells, layout: { cols: 3, bp: { tablet: 3, mobile: 3 }, gap: 20 } });
  const foot = shape(c, { x: PAD, y: grid.box.desktop.y + gh + 18, w: CW, h: 1, fill: c.pal.ink, name: 'Rule' });
  return section([head, top, grid, foot], foot.box.desktop.y + 90, c.pal.bg);
}

const spec: TemplateSpec = {
  key: '909bed02',
  ref: '909bed02',
  name: 'Wren & Kiln',
  industry: 'ecommerce',
  category: 'Ecommerce',
  description: 'A hushed grey gnome pottery: one enormous capital wordmark, a single wide photo, then ruled notes and a ledger of wares.',
  palette: { bg: '#ecebe8', surface: '#f6f5f2', ink: '#111111', body: '#3b3b3b', muted: '#6c6c6c', accent: '#111111', accentInk: '#ffffff', dark: '#1b1b1b', darkInk: '#f1f0ec', darkBody: 'rgba(241,240,236,0.78)', line: 'rgba(17,17,17,0.22)' },
  fonts: { head: helv, body: helv, headWeight: 500, headTrack: -0.6, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'tiny wordmark left, three plain links right, no CTA', footer: 'grey, one ruled row: small print left, links right' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        masthead(c),
        photoBand(c, { photo: '@mushroom|moss', h: 560 }),
        ruled(c, { heading: 'Thrown by hand under the hill' }),
        ledger(c),
        ruled(c, {
          heading: 'Who sits at the wheel',
          slots: ['about'],
          extra: [image(c, { key: avatarsFor(c.site, 1)[0], x: 600, y: 0, w: 150, h: 180 }), text(c, { slot: 'person.name', index: 0, x: 600, y: 0, w: 400, size: 22, color: c.pal.ink, font: 'head', italic: true, name: 'Signature' })],
        }),
        ruled(c, { heading: 'Visit the kiln', slots: ['subhead'], extra: [text(c, { slot: 'address', index: 0, x: 600, y: 0, w: 540, size: 16, color: c.pal.ink, name: 'Where' }), text(c, { slot: 'email', index: 0, x: 600, y: 0, w: 540, size: 16, color: c.pal.ink, name: 'Write' })] }),
      ],
    },
    {
      slug: 'wares',
      title: 'Wares',
      build: (c) => [
        pageTitle(c, { title: 'Wares', tone: 'bg', align: 'left' }),
        ledger(c, 9),
        cards(c, { n: 3, cols: 3, kind: 'numbered', tone: 'surface', head: { heading: 'How a pot is made', align: 'left' }, cardFill: false }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'About the kiln', tone: 'bg', align: 'left' }),
        imageStory(c, { photo: avatarsFor(c.site, 1)[0], side: 'right', tone: 'surface', h: 620 }),
        team(c, { n: 3, avatars: avatarsFor(c.site, 2), tone: 'bg', head: { heading: 'Hands at the wheel', align: 'left' } }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [
        contact(c, { tone: 'bg', heading: 'Knock at the kiln' }),
        faq(c, { n: 4, tone: 'surface' }),
      ],
    },
  ],
};
export default spec;

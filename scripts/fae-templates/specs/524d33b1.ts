// Ref — a portfolio laid out as a bento wall: twelve framed tiles (portrait, hello, studio, poster, experience,
// pet, schooling, brand work, skills on black, style, contact, campaign), each with a small numbered caption,
// over a row of three social cells.
// Kept: the numbered tile wall with thin black frames and mixed fills · the three-cell social row ·
// about (story + numbered roles) · projects (picture cards).
import { CW, PAD, avatarsFor, bottom, cards, copy, group, image, imageStory, pageTitle, section, shape, text, tone, type Ctx, type Node, type Section, type TemplateSpec } from '../kit.ts';

const sans = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";
const INK = '#161616';

type Tile = { label: string; fill: string; ink?: string; photo?: string; build?: (c: Ctx, w: number, ink: string) => Node[] };

/** Twelve framed tiles, three across, each a flowing group ending in its numbered caption. */
function bento(c: Ctx, tiles: Tile[]): Section {
  const cols = 3;
  const cellW = CW / cols;
  const pad = 28;
  const inner = ((cellW - pad * 2) / cellW) * 100;
  const items: Node[] = [];
  let maxH = 0;
  tiles.forEach((tl, i) => {
    const ink = tl.ink ?? INK;
    const kids: Node[] = [];
    let cy = 0;
    if (tl.photo) {
      kids.push(image(c, { key: tl.photo, x: 0, y: 0, w: cellW, h: 320, pct: 100 }));
      cy = 340;
    } else if (tl.build) {
      for (const n of tl.build(c, cellW - pad * 2, ink)) {
        n.box.desktop.x = pad;
        n.box.desktop.y = cy + (cy ? 12 : 60);
        if (n.box.desktop.wu !== '%') {
          n.box.desktop.w = Math.round(inner * 10) / 10;
          n.box.desktop.wu = '%';
        }
        kids.push(n);
        cy = bottom(n);
      }
      cy += 40;
    }
    const lab = text(c, { text: `${String(i + 1).padStart(2, '0')}_ ${tl.label} ›`, x: pad, y: cy, w: cellW - pad * 2, pct: inner, size: 11, color: ink, weight: 700, upper: true, track: 0.6, align: 'center', name: 'Caption' });
    kids.push(lab);
    const ch = bottom(lab) + 24;
    maxH = Math.max(maxH, ch);
    items.push(group(c, { name: `Tile ${i + 1}`, x: 0, y: 0, w: cellW, h: ch, children: kids, fill: tl.fill, border: INK, flow: { gap: 12, pad: 0 } }));
  });
  for (const it of items) it.box.desktop.h = Math.max(maxH, 380);
  const rows = Math.ceil(tiles.length / cols);
  const gh = rows * Math.max(maxH, 380);
  const wall = group(c, { name: 'Tile wall', x: PAD, y: 40, w: CW, h: gh, children: items, layout: { cols, bp: { tablet: 2, mobile: 1 }, gap: 0 } });
  return section([wall], gh + 40, tone(c, 'bg').bg);
}

/** A row of three framed word cells (the social links). */
function socialRow(c: Ctx, words: string[]): Section {
  const cellW = CW / words.length;
  const cells = words.map((w, i) => group(c, { name: `Link ${i + 1}`, x: 0, y: 0, w: cellW, h: 70, fill: '#ffffff', border: INK, children: [
    text(c, { text: w, x: 0, y: 18, w: cellW, pct: 100, size: 22, color: INK, font: 'head', weight: 400, align: 'center', lh: 1.3, name: 'Word' }),
  ] }));
  return section([group(c, { name: 'Links', x: PAD, y: 0, w: CW, h: 70, children: cells, layout: { cols: words.length, bp: { tablet: words.length, mobile: 1 }, gap: 0 } })], 130, tone(c, 'bg').bg);
}

const spec: TemplateSpec = {
  key: '524d33b1',
  ref: '524d33b1',
  name: 'Quillfern Folio',
  industry: 'blog',
  category: 'Blog',
  description: 'A fae storyteller’s folio as a wall of framed tiles: portrait, hello, studio, skills and a note to write.',
  palette: { bg: '#f1f1f1', surface: '#ddd6cf', ink: INK, body: '#3e3e3e', muted: '#6f6f6f', accent: '#7a5a3a', accentInk: '#ffffff', dark: '#1c1c1c', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', darkAccent: '#d9c3a5', line: 'rgba(22,22,22,0.9)' },
  fonts: { head: sans, body: sans, headWeight: 400, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'name in a beige framed box left, links right, thin black frame', footer: 'grey, one centred line of fine print' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => {
        const av = avatarsFor(c.site, 2);
        const p0 = c.site.people[0];
        const tiles: Tile[] = [
          { label: 'Portrait', fill: '#e7e7e7', build: (cc, w) => [image(cc, { key: av[0], x: 0, y: 0, w, h: 260, circle: true })] },
          { label: 'About me', fill: '#ffffff', build: (cc, w, ink) => [
            text(cc, { text: `Well met — I’m ${p0 ? p0.name.split(' ')[0] : 'the scribe'}`, x: 0, y: 0, w, size: 22, color: ink, font: 'head', align: 'center', role: 'h1', name: 'Hello' }),
            text(cc, { slot: 'tagline', x: 0, y: 0, w, size: 17, color: ink, font: 'head', align: 'center', name: 'Line' }),
          ] },
          { label: 'My study', fill: '#2a2a2a', ink: '#ffffff', photo: '@study' },
          { label: 'My talk', fill: '#efefef', build: (cc, w) => [
            shape(cc, { x: 0, y: 0, w, h: 220, fill: '#ffffff', shadow: '0px 8px 24px rgba(0,0,0,0.12)', name: 'Poster' }),
            text(cc, { text: 'THE WEIGHT OF WORDS', x: 0, y: 0, w, size: 30, color: '#a07a44', font: 'head', weight: 800, align: 'center', lh: 1.05, name: 'Poster words' }),
          ] },
          { label: 'Experience', fill: '#ddd6cf', build: (cc, w, ink) => [
            text(cc, { slot: 'event.date', index: 0, x: 0, y: 0, w, size: 12, color: ink, align: 'center', name: 'When' }),
            text(cc, { slot: 'person.role', index: 0, x: 0, y: 0, w, size: 17, color: ink, font: 'head', align: 'center', name: 'Role' }),
            text(cc, { slot: 'paragraph', x: 0, y: 0, w, size: 12, color: '#4a4a4a', align: 'center', name: 'Paragraph' }),
          ] },
          { label: 'My moss garden', fill: '#ffffff', photo: '@moss|mushroom' },
          { label: 'Learning', fill: '#d8e1e6', build: (cc, w, ink) => [
            text(cc, { text: copy(cc, 'offering.title', 0).text, x: 0, y: 0, w, size: 17, color: ink, font: 'head', align: 'center', name: 'School' }),
            text(cc, { text: '↓', x: 0, y: 0, w, size: 22, color: '#ffffff', align: 'center', name: 'Arrow' }),
            text(cc, { text: copy(cc, 'offering.title', 1).text, x: 0, y: 0, w, size: 17, color: ink, font: 'head', align: 'center', name: 'School' }),
          ] },
          { label: 'Brand work', fill: '#ffffff', photo: '@books' },
          { label: 'Skills', fill: '#1c1c1c', ink: '#ffffff', build: (cc, w) => [0, 1, 2, 3].map((k) => text(cc, { text: `◯  ${copy(cc, 'offering.title', k + 2).text}`, x: 0, y: 0, w, size: 15, color: '#ffffff', name: 'Skill' })) },
          { label: 'My style', fill: '#2a2a2a', ink: '#ffffff', photo: '@light|candle' },
          { label: 'Write to me', fill: '#ffffff', build: (cc, w, ink) => [
            text(cc, { text: 'Send word and we’ll spin the next tale together', x: 0, y: 0, w, size: 20, color: ink, font: 'head', align: 'center', name: 'Ask' }),
            text(cc, { text: `${cc.site.email} · ${cc.site.phone}`, x: 0, y: 0, w, size: 12, color: ink, align: 'center', name: 'Details' }),
          ] },
          { label: 'Lantern campaign', fill: '#cfd9df', build: (cc, w) => [
            shape(cc, { x: 0, y: 0, w, h: 220, fill: '#f6f2ea', radius: 4, shadow: '0px 10px 30px rgba(0,0,0,0.15)', name: 'Booklet' }),
            text(cc, { text: '☾ ✦', x: 0, y: 0, w, size: 40, color: '#3b3b3b', align: 'center', name: 'Mark' }),
          ] },
        ];
        return [bento(c, tiles), socialRow(c, ['Owl-post', 'Leafline', 'Moth-mail'])];
      },
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'About me', tone: 'surface' }),
        imageStory(c, { photo: '@study', side: 'left', tone: 'bg', eyebrow: true }),
        cards(c, { n: 4, cols: 2, kind: 'numbered', tone: 'surface', head: { heading: 'Roles I have held' }, titleSlot: 'person.role', bodySlot: 'paragraph', cardFill: false }),
      ],
    },
    {
      slug: 'projects',
      title: 'Projects',
      build: (c) => [
        pageTitle(c, { title: 'Projects', tone: 'bg' }),
        cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', photos: ['@books', '@light|candle', '@moss|mushroom'], head: false, titleSlot: 'post.title', bodySlot: 'post.excerpt', link: '/projects', imgH: 300 }),
        socialRow(c, ['Owl-post', 'Leafline', 'Moth-mail']),
      ],
    },
  ],
};
export default spec;

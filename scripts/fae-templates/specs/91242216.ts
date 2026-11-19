// Ref — a clean white menswear shop: centred wordmark over a second row of caps links, a wide photo with the
// words to its side, product rows on grey tiles, a photo countdown band, brand wordmarks, categories.
// Kept: split hero · "trending" product row with tags · photo countdown band · maker wordmarks · categories
// row · a second product row.
//
// This file also exports the batch-12 shop parts (product shelf, countdown, circle row, tile rows, numbered row
// list, marquee strip) — composed from kit primitives only; the other batch-12 specs import them from here.
import {
  CW, GLYPHS, PAD, W, badge, bottom, copy, button, contact, ctaBand, group, hOf, headBlock, hero, image, isLight, logos,
  pageTitle, posts, centered, section, shape, stackDown, stackLast, text, tone, wash,
  type Ctx, type Node, type Section, type TemplateSpec, type Tone,
} from '../kit.ts';

type FaeSlot = Parameters<typeof copy>[1];

// ————————————————————————————————————————————————————————————— batch-12 shop parts

export type ShopHead = { heading?: string; eyebrow?: string | boolean; intro?: boolean; align?: 'left' | 'center'; button?: string; size?: number };

/** A heading block — or, with `button`, heading on the left and a button on the right ("Our bestsellers  [SHOP]"). */
export function shopHead(ctx: Ctx, t: ReturnType<typeof tone>, h: ShopHead, y: number): { nodes: Node[]; y: number } {
  if (h.button) {
    const hd = text(ctx, { slot: h.heading ? undefined : 'headline', text: h.heading, x: PAD, y, w: 700, size: h.size ?? 34, color: t.head, font: 'head', role: 'h2', name: 'Heading' });
    const b = button(ctx, { text: h.button, href: '/shop', x: 0, y: y + Math.max(0, Math.round((hOf(hd) - 50) / 2)), look: t.btn === 'solid' ? 'dark' : 'light' });
    b.box.desktop.x = W - PAD - b.box.desktop.w;
    return { nodes: [hd, b], y: Math.max(bottom(hd), bottom(b)) };
  }
  return headBlock(ctx, t, { heading: h.heading, eyebrow: h.eyebrow, intro: h.intro, align: h.align ?? 'center', size: h.size, y, accent: ctx.pal.accent });
}

const SHADES = ['Moss', 'Dusk', 'Fern', 'Ember', 'Frost', 'Bramble', 'Honey', 'Plum', 'Thistle', 'Ash'];
const SWATCHES = [['#1d1d1f', '#c98b2b', '#ffffff'], ['#1d1d1f', '#8a8a8a'], ['#c98b2b', '#1d1d1f'], ['#7b7b80', '#1d1d1f', '#e9d8c4'], ['#d7b8c4', '#1d1d1f']];

export type ShelfLook = {
  n: number;
  cols: number;
  /** tile fills, cycled (drawn product tiles); ignored when `photos` is set */
  tiles?: string[];
  glyphInk?: string;
  tileH?: number;
  /** a small tag on the tile corner, cycled ('' = none) */
  chips?: string[];
  swatches?: boolean;
  /** a muted second line under the name (the "maker" line) */
  variant?: boolean;
  stars?: boolean;
  price?: boolean;
  photos?: string[];
  align?: 'left' | 'center';
  mobile?: number;
  titleSize?: number;
};

/** The product grid: one grid group of flowing cards (tile, name, maker line, price, swatches). */
export function shelfGrid(ctx: Ctx, t: ReturnType<typeof tone>, o: ShelfLook, x: number, w: number, y: number): Node {
  const gap = o.cols >= 5 ? 16 : 22;
  const cellW = (w - gap * (o.cols - 1)) / o.cols;
  const tileH = o.tileH ?? Math.round(cellW * 1.12);
  const r = ctx.fonts.cardRadius ?? 0;
  const align = o.align ?? 'left';
  const tiles = o.tiles ?? [ctx.pal.surface];
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < o.n; i++) {
    const tk: Node[] = [];
    if (o.photos?.length) tk.push(image(ctx, { key: o.photos[i % o.photos.length], x: 0, y: 0, w: cellW, h: tileH, pct: 100, radius: r }));
    else {
      const fill = tiles[i % tiles.length];
      tk.push(shape(ctx, { x: 0, y: 0, w: cellW, h: tileH, pct: 100, fill, radius: r, name: 'Tile' }));
      tk.push(text(ctx, { text: GLYPHS[(i * 5 + 2) % GLYPHS.length], x: 0, y: Math.round(tileH / 2 - 46), w: cellW, pct: 100, size: 68, color: o.glyphInk ?? (isLight(fill) ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.7)'), align: 'center', lh: 1.2, name: 'Glyph' }));
    }
    const chip = o.chips?.[i % o.chips.length];
    if (chip) {
      const cw = Math.round(chip.length * 7 + 22);
      tk.push(group(ctx, {
        name: 'Tag', x: 12, y: 12, w: cw, h: 24,
        children: [
          shape(ctx, { x: 0, y: 0, w: cw, h: 24, fill: '#ffffff', radius: 3, name: 'Tag fill' }),
          text(ctx, { text: chip, x: 0, y: 4, w: cw, size: 11, color: i % 3 === 2 ? '#b3261e' : '#1a1a1a', weight: 600, align: 'center', lh: 1.3, name: 'Tag text' }),
        ],
      }));
    }
    const kids: Node[] = [group(ctx, { name: 'Tile', x: 0, y: 0, w: cellW, h: tileH, pct: 100, children: tk })];
    let cy = tileH + 14;
    const ti = text(ctx, { slot: 'offering.title', index: i, x: 0, y: cy, w: cellW, pct: 100, size: o.titleSize ?? 15, color: t.head, weight: 600, align, role: 'h3', name: 'Product' });
    kids.push(ti);
    cy = bottom(ti) + 4;
    if (o.variant) {
      const v = text(ctx, { text: SHADES[(i * 3) % SHADES.length], x: 0, y: cy, w: cellW, pct: 100, size: 13, color: t.muted, align, name: 'Maker' });
      kids.push(v);
      cy = bottom(v) + 4;
    }
    if (o.price !== false) {
      const pr = text(ctx, { slot: 'offering.price', index: i, x: 0, y: cy, w: cellW, pct: 100, size: 14, color: t.ink, weight: 600, align, name: 'Price' });
      kids.push(pr);
      cy = bottom(pr) + 4;
    }
    if (o.stars && i % 2 === 0) {
      const s = text(ctx, { text: `✦✦✦✦✦  ${(i % 3) + 1} kind word${i % 3 ? 's' : ''}`, x: 0, y: cy, w: cellW, pct: 100, size: 12, color: ctx.pal.accent, align, name: 'Stars' });
      kids.push(s);
      cy = bottom(s) + 4;
    }
    if (o.swatches) {
      const cols = SWATCHES[i % SWATCHES.length];
      const sw = cols.length * 20;
      kids.push(group(ctx, {
        name: 'Swatches', x: align === 'center' ? (cellW - sw) / 2 : 0, y: cy + 4, w: sw, h: 14,
        children: cols.map((c, k) => shape(ctx, { x: k * 20, y: 0, w: 14, h: 14, fill: c, radius: 7, border: t.line, name: 'Swatch' })),
      }));
      cy += 22;
    }
    const ch = cy + 6;
    maxH = Math.max(maxH, ch);
    items.push(group(ctx, { name: `Product ${i + 1}`, x: 0, y: 0, w: cellW, h: ch, children: kids, flow: { gap: 6, pad: 4 } }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const rows = Math.ceil(o.n / o.cols);
  const gh = rows * maxH + (rows - 1) * (gap + 16);
  return group(ctx, { name: 'Products', x, y, w, h: gh, children: items, layout: { cols: o.cols, bp: { tablet: Math.min(o.cols, 3), mobile: o.mobile ?? (o.cols >= 4 ? 2 : 1) }, gap } });
}

/** A product shelf band: heading (or heading + button row), the grid, an optional centred button. */
export function shelf(ctx: Ctx, o: ShelfLook & { tone?: Tone; head?: ShopHead | false; button?: string }): Section {
  const t = tone(ctx, o.tone ?? 'bg');
  let y = 90;
  const layers: Node[] = [];
  if (o.head !== false) {
    const hb = shopHead(ctx, t, o.head ?? { heading: 'Fresh from the market', align: 'left' }, y);
    layers.push(...hb.nodes);
    y = hb.y + 40;
  }
  const g = shelfGrid(ctx, t, o, PAD, CW, y);
  layers.push(g);
  y = bottom(g);
  if (o.button) {
    const b = button(ctx, { text: o.button, href: '/shop', x: 0, y: y + 44, look: t.btn === 'solid' ? 'outline' : 'ghost-light' });
    b.box.desktop.x = Math.round((W - b.box.desktop.w) / 2);
    layers.push(b);
    y = bottom(b);
  }
  return section(layers, y + 90, t.bg);
}

/** A sale countdown: four numbers with units. Centred (optionally over a photo) or split (words left, numbers right). */
export function countdown(
  ctx: Ctx,
  o: { tone?: Tone; photo?: string; overlay?: string; split?: boolean; heading?: string; eyebrow?: string; link?: string; values?: string[]; units?: string[]; button?: boolean },
): Section {
  const photo = !!o.photo;
  const t = photo ? tone(ctx, 'dark') : tone(ctx, o.tone ?? 'surface');
  const ink = photo ? '#ffffff' : t.head;
  const body = photo ? 'rgba(255,255,255,0.85)' : t.body;
  const values = o.values ?? ['03', '12', '40', '09'];
  const units = o.units ?? ['Days', 'Hours', 'Minutes', 'Seconds'];
  const timer = (x: number, w: number, y: number): Node => {
    const gap = 20;
    const cw = (w - gap * 3) / 4;
    const items = values.map((v, i) => {
      const rule = shape(ctx, { x: 0, y: 0, w: cw, h: 1, pct: 100, fill: photo ? 'rgba(255,255,255,0.6)' : t.line, name: 'Rule' });
      const val = text(ctx, { text: v, x: 0, y: 16, w: cw, pct: 100, size: 46, color: ink, font: 'head', align: 'center', lh: 1.1, name: 'Value' });
      const lab = text(ctx, { text: units[i], x: 0, y: bottom(val) + 4, w: cw, pct: 100, size: 12, color: body, align: 'center', upper: true, track: 1.5, name: 'Unit' });
      return group(ctx, { name: `Unit ${i + 1}`, x: 0, y: 0, w: cw, h: bottom(lab), children: [rule, val, lab] });
    });
    const ih = Math.max(...items.map(hOf));
    for (const it of items) it.box.desktop.h = ih;
    return group(ctx, { name: 'Countdown', x, y, w, h: ih, children: items, layout: { cols: 4, bp: { tablet: 4, mobile: 2 }, gap } });
  };
  const layers: Node[] = [];
  let H: number;
  if (o.split) {
    const nodes: Node[] = [];
    if (o.eyebrow) nodes.push(text(ctx, { text: o.eyebrow, x: PAD + 60, y: 0, w: 460, size: 12, color: t.muted, weight: 600, upper: true, track: 2, name: 'Eyebrow' }));
    nodes.push(text(ctx, { text: o.heading, slot: o.heading ? undefined : 'headline', x: PAD + 60, y: 0, w: 460, size: 32, color: ink, font: 'head', name: 'Heading' }));
    const ln = text(ctx, { text: o.link ?? 'Shop the sale →', x: PAD + 60, y: 0, w: 300, size: 13, color: ink, weight: 700, upper: true, track: 1, name: 'Link' });
    nodes.push({ ...ln, href: '/shop' });
    const st = stackDown(nodes, 80, [10, 16]);
    const tm = timer(640, 440, 0);
    tm.box.desktop.y = Math.round((80 + st.y) / 2 - hOf(tm) / 2);
    layers.push(...st.nodes, ...stackLast([tm]));
    H = Math.max(st.y, bottom(tm)) + 80;
  } else {
    const nodes: Node[] = [];
    if (o.eyebrow) nodes.push(text(ctx, { text: o.eyebrow, x: 240, y: 0, w: 720, size: 13, color: body, weight: 600, upper: true, track: 2, align: 'center', name: 'Eyebrow' }));
    nodes.push(text(ctx, { text: o.heading, slot: o.heading ? undefined : 'headline', x: 250, y: 0, w: 700, size: 34, color: ink, font: 'head', align: 'center', name: 'Heading' }));
    const st = stackDown(nodes, 110, [12, 30]);
    const tm = timer((W - 620) / 2, 620, st.y + 34);
    layers.push(...st.nodes, tm);
    let y = bottom(tm);
    if (o.button !== false) {
      const b = button(ctx, { slot: 'cta', href: '/shop', x: 0, y: y + 36, look: photo ? 'dark' : t.btn });
      b.box.desktop.x = Math.round((W - b.box.desktop.w) / 2);
      layers.push(b);
      y = bottom(b);
    }
    H = y + 110;
  }
  const extra: Record<string, unknown> = {};
  const ov = o.overlay ?? 'rgba(14,10,8,0.5)';
  if (photo) extra.bgPin = { src: ctx.photo(o.photo as string), paintFrame: true, pinned: false, overlay: ov };
  return section(layers, H, photo ? wash(ov) : t.bg, photo ? 'banner-image-atomic' : 'text-rich-text-atomic', extra);
}

/** A row of circles with a word under each (category bubbles / story rings). */
export function circleRow(ctx: Ctx, o: { n: number; tone?: Tone; avatars?: string[]; fills?: string[]; ink?: string; labels?: string[]; d?: number; ring?: string; head?: ShopHead | false }): Section {
  const t = tone(ctx, o.tone ?? 'bg');
  const gap = 16;
  const cellW = Math.min((CW - gap * (o.n - 1)) / o.n, 112); // a phone row of three still fits each circle
  const d = Math.min(o.d ?? 84, cellW - 16);
  const gridW = cellW * o.n + gap * (o.n - 1);
  let y = 40;
  const layers: Node[] = [];
  if (o.head) {
    const hb = shopHead(ctx, t, o.head, 80);
    layers.push(...hb.nodes);
    y = hb.y + 40;
  }
  const items: Node[] = [];
  for (let i = 0; i < o.n; i++) {
    const kids: Node[] = [];
    const cx = (cellW - d) / 2;
    if (o.ring) kids.push(shape(ctx, { x: cx - 4, y: 0, w: d + 8, h: d + 8, fill: o.ring, radius: (d + 8) / 2, name: 'Ring' }));
    const off = o.ring ? 4 : 0;
    if (o.avatars?.length) kids.push(image(ctx, { key: o.avatars[i % o.avatars.length], x: cx, y: off, w: d, h: d, circle: true }));
    else kids.push(...badge(ctx, { x: cx, y: off, d, glyph: GLYPHS[(i * 7 + 1) % GLYPHS.length], fill: o.fills?.[i % o.fills.length] ?? t.card, ink: o.ink ?? ctx.pal.accent }));
    const lb = text(ctx, { ...(o.labels ? { text: o.labels[i % o.labels.length] } : { slot: 'offering.title' as FaeSlot, index: i }), x: 0, y: d + off * 2 + 10, w: cellW, pct: 100, size: 13, color: t.head, weight: 600, align: 'center', name: 'Label' });
    kids.push(lb);
    items.push(group(ctx, { name: `Bubble ${i + 1}`, x: 0, y: 0, w: cellW, h: bottom(lb), children: kids }));
  }
  const ih = Math.max(...items.map(hOf));
  for (const it of items) it.box.desktop.h = ih;
  const g = group(ctx, { name: 'Bubbles', x: (W - gridW) / 2, y, w: gridW, h: ih, children: items, layout: { cols: o.n, bp: { tablet: Math.min(o.n, 4), mobile: 3 }, gap } });
  layers.push(g);
  return section(layers, bottom(g) + 40, t.bg);
}

export type TileItem = { photo?: string; fill?: string; ink?: string; heading?: string; headSlot?: FaeSlot; eyebrow?: string; sub?: boolean; button?: boolean; number?: string };

/** Rows of tiles — a photo (or a colour) with words laid over it. Each row is one grid. */
export function tileRows(ctx: Ctx, o: { tone?: Tone; head?: ShopHead | false; rows: Array<{ h: number; items: TileItem[] }>; overlay?: string; top?: number; bottomPad?: number }): Section {
  const t = tone(ctx, o.tone ?? 'bg');
  const r = ctx.fonts.cardRadius ?? 0;
  const gap = 16;
  let y = o.top ?? 90;
  const layers: Node[] = [];
  if (o.head) {
    const hb = shopHead(ctx, t, o.head, y);
    layers.push(...hb.nodes);
    y = hb.y + 40;
  }
  o.rows.forEach((row, ri) => {
    const n = row.items.length;
    const cellW = (CW - gap * (n - 1)) / n;
    const tw = cellW - 56;
    const pct = (tw / cellW) * 100;
    const items = row.items.map((it, i) => {
      const kids: Node[] = [];
      const onPhoto = !!it.photo;
      const ink = it.ink ?? (onPhoto ? '#ffffff' : t.head);
      if (it.photo) {
        kids.push(image(ctx, { key: it.photo, x: 0, y: 0, w: cellW, h: row.h, pct: 100, radius: r }));
        kids.push(shape(ctx, { x: 0, y: 0, w: cellW, h: row.h, pct: 100, fill: o.overlay ?? 'rgba(10,8,6,0.32)', radius: r, name: 'Wash' }));
      } else kids.push(shape(ctx, { x: 0, y: 0, w: cellW, h: row.h, pct: 100, fill: it.fill ?? t.card, radius: r, name: 'Tile' }));
      const words: Node[] = [];
      if (it.eyebrow) words.push(text(ctx, { text: it.eyebrow, x: 28, y: 0, w: tw, pct, size: 11, color: ink, weight: 600, upper: true, track: 2, name: 'Eyebrow' }));
      words.push(text(ctx, { text: it.heading, slot: it.heading ? undefined : (it.headSlot ?? 'offering.title'), index: it.heading ? undefined : ri * 10 + i, x: 28, y: 0, w: tw, pct, size: row.h >= 380 && n <= 2 ? 30 : 22, color: ink, font: 'head', role: 'h3', name: 'Heading' }));
      if (it.sub) words.push(text(ctx, { slot: 'caption', x: 28, y: 0, w: tw, pct, size: 14, color: ink, name: 'Note' }));
      kids.push(...stackDown(words, 28, [8, 10]).nodes);
      if (it.button) kids.push(button(ctx, { slot: 'cta', href: '/shop', x: 28, y: row.h - 78, look: onPhoto || !isLight(it.fill ?? t.card) ? 'light' : 'dark', size: 13 }));
      else if (it.number) kids.push(text(ctx, { text: it.number, x: 28, y: row.h - 62, w: 120, size: 24, color: ink, font: 'head', name: 'Number' }));
      return group(ctx, { name: `Tile ${i + 1}`, x: 0, y: 0, w: cellW, h: row.h, children: kids });
    });
    const g = group(ctx, { name: `Tiles ${ri + 1}`, x: PAD, y, w: CW, h: row.h, children: items, layout: { cols: n, bp: { tablet: Math.min(n, 2), mobile: 1 }, gap } });
    layers.push(g);
    y = bottom(g) + gap;
  });
  return section(layers, y - gap + (o.bottomPad ?? 90), t.bg);
}

/** Big numbered rows with a link each ("01 Summer things →"), usually on the dark band. */
export function rowList(ctx: Ctx, o: { n: number; tone?: Tone; head?: ShopHead | false; link?: string }): Section {
  const t = tone(ctx, o.tone ?? 'dark');
  let y = 70;
  const layers: Node[] = [];
  if (o.head) {
    const hb = shopHead(ctx, t, o.head, 90);
    layers.push(...hb.nodes);
    y = hb.y + 30;
  }
  const items: Node[] = [];
  for (let i = 0; i < o.n; i++) {
    const num = text(ctx, { text: String(i + 1).padStart(2, '0'), x: 0, y: 0, w: CW, pct: 100, size: 16, color: ctx.pal.darkAccent && o.tone !== 'bg' && o.tone !== 'surface' ? ctx.pal.darkAccent : ctx.pal.accent, weight: 700, track: 2, name: 'Number' });
    const ti = text(ctx, { slot: 'offering.title', index: i, x: 0, y: bottom(num) + 4, w: CW, pct: 100, size: 46, color: t.head, font: 'head', role: 'h3', name: 'Title' });
    const ln = text(ctx, { text: o.link ?? 'Wander in →', x: 0, y: bottom(ti) + 8, w: 300, size: 14, color: t.muted, weight: 600, name: 'Link' });
    const rule = shape(ctx, { x: 0, y: bottom(ln) + 26, w: CW, h: 1, pct: 100, fill: t.line, name: 'Rule' });
    items.push(group(ctx, { name: `Row ${i + 1}`, x: 0, y: 0, w: CW, h: bottom(rule), children: [num, ti, { ...ln, href: '/shop' }, rule], flow: { gap: 8, pad: 4 } }));
  }
  const rh = Math.max(...items.map(hOf));
  for (const it of items) it.box.desktop.h = rh;
  const gh = o.n * rh + (o.n - 1) * 24;
  layers.push(group(ctx, { name: 'Rows', x: PAD, y, w: CW, h: gh, children: items, layout: { cols: 1, bp: { tablet: 1, mobile: 1 }, gap: 24 } }));
  return section(layers, y + gh + 80, t.bg);
}

/** A thin strip of short words (the scrolling sale ribbon, held still). */
export function marquee(ctx: Ctx, o: { tone?: Tone; words: string[] }): Section {
  const t = tone(ctx, o.tone ?? 'accent');
  const line = text(ctx, { text: o.words.map((w) => `✦ ${w}`).join('      '), x: PAD, y: 16, w: CW, size: 13, color: t.head, weight: 600, align: 'center', track: 1, name: 'Ribbon' });
  return section([line], bottom(line) + 16, t.bg, 'text-rich-text-atomic', { flexPadY: 14 });
}

// ————————————————————————————————————————————————————————————— the template

const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

const spec: TemplateSpec = {
  key: '91242216', ref: '91242216', name: 'Thistledown Market', industry: 'ecommerce', category: 'Ecommerce',
  description: 'A tidy faerie market stall in white and grey: a wide photo beside its words, rows of goods on grey tiles, a moonlit countdown.',
  palette: { bg: '#ffffff', surface: '#f4f4f5', ink: '#111111', body: '#4a4a4a', muted: '#8a8a8a', accent: '#111111', accentInk: '#ffffff', dark: '#1b1714', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.82)', darkAccent: '#e8d9c4', line: 'rgba(17,17,17,0.1)' },
  fonts: { head: sans, body: sans, headWeight: 500, headTrack: -0.3, btnRadius: 2, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'utility ribbon on top; links left, wordmark centre, icons right; a second centred row of caps links', footer: 'light, link columns + newsletter field' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'split', tone: 'bg', photo: '@fabric|craft', h: 560, buttons: 2, imageRadius: 0, headSize: 44 }),
      shelf(c, { n: 4, cols: 4, tone: 'bg', head: { heading: 'Trending in the hollow', align: 'left', size: 26 }, tiles: ['#e6e6e6'], chips: ['Fresh', '', 'Gone till spring', 'Last few'], variant: true }),
      countdown(c, { photo: '@forest|mist', heading: 'A quarter off everything, new arrivals too', button: true }),
      logos(c, { n: 6, tone: 'bg', label: 'Makers we carry, from glades near and far', seeds: ['thd-a', 'thd-b', 'thd-c', 'thd-d', 'thd-e', 'thd-f'] }),
      shelf(c, { n: 4, cols: 4, tone: 'bg', head: { heading: 'Wander by kind', align: 'left', size: 26 }, tiles: ['#e9e4dc', '#dfe6e1', '#e4e0ea', '#ece2dc'], tileH: 320, price: false }),
      shelf(c, { n: 4, cols: 4, tone: 'bg', head: { heading: 'Dress the whole burrow', align: 'left', size: 26 }, tiles: ['#e6e6e6'], chips: ['', 'Fresh', '', ''], variant: true, button: 'See every treasure' }),
    ] },
    { slug: 'shop', title: 'Shop', build: (c) => [
      pageTitle(c, { title: 'The market', tone: 'bg', align: 'left' }),
      circleRow(c, { n: 6, tone: 'bg', fills: ['#f1f1f2'], labels: ['Lanterns', 'Blankets', 'Cups', 'Jars', 'Scarves', 'Gifts'] }),
      shelf(c, { n: 8, cols: 4, tone: 'bg', head: false, tiles: ['#e6e6e6'], chips: ['Fresh', '', '', 'Last few', '', 'Gone till spring', '', ''], variant: true }),
      ctaBand(c, { tone: 'dark', split: true }),
    ] },
    { slug: 'journal', title: 'Journal', build: (c) => [
      pageTitle(c, { title: 'Journal', tone: 'surface' }),
      posts(c, { n: 2, photos: ['@books|study', '@tea|warm'], tone: 'bg', head: false }),
      centered(c, { tone: 'dark', heading: 'Letters by owl, once a moon', slot: 'newsletter', button: true }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'surface' })] },
  ],
};
export default spec;

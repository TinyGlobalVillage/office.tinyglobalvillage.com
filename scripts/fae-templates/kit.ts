// Fae template kit — the section builders every gallery template is written in.
//
// A template spec (specs/*.ts) is a palette, two font stacks and a list of pages, each a list of
// section calls. This file turns those calls into ATOMIC sections (typed layers + a frame) in the
// shape the page editor stores, with every piece of copy drawn from the shared fae generator and
// tagged with its slot so the editor's re-roll button can rewrite it.
//
// LAYOUT RULES (read off LayerRenderer + helpers/autoStack, 2026-11-18):
//   • Atoms are authored ONCE, on the 1200px desktop artboard. No tablet/mobile boxes — an atom with
//     its own small-screen box is "pinned" and steps out of the stack.
//   • Every section is a full-bleed BAND (background edge to edge, content centred at 1200). A band
//     does not stack by default, so each frame carries the stack fields explicitly: below 1025px its
//     top-level atoms become one centred column, top-to-bottom by desktop y.
//   • Repeated things (cards, people, reviews, plans) are ONE grid group (`layout.cols` + per-bp
//     column counts). Cards are groups that `flow` — they grow with their words — and their children
//     use % widths so a card that is 380px on desktop and 358px on a phone still fits.
//   • Text boxes get an estimated height (estimateH) — the desktop face does not flow, so the estimate
//     is deliberately generous.
import {
  createFaeSite,
  faeText,
  type FaeSite,
  type FaeSlot,
} from '../../../../packages/@tgv/module-core/module-component-library/helpers/fae/index.ts';

// ————————————————————————————————————————————————————————————— types

export type Palette = {
  /** page background (light sections) */
  bg: string;
  /** an alternate light section / card fill */
  surface: string;
  ink: string;
  body: string;
  muted: string;
  accent: string;
  /** text on an accent fill */
  accentInk: string;
  /** the dark band */
  dark: string;
  darkInk: string;
  darkBody: string;
  /** a second accent for headings on the dark band (optional) */
  darkAccent?: string;
  line: string;
};

export type Fonts = {
  head: string;
  body: string;
  headWeight?: number;
  /** letter-spacing on headings, px */
  headTrack?: number;
  /** button corner radius */
  btnRadius?: number;
  /** buttons in capitals */
  btnUpper?: boolean;
  /** card corner radius */
  cardRadius?: number;
};

export type Tone = 'bg' | 'surface' | 'dark' | 'accent';

type Box = { x: number; y: number; w: number; h: number; rot: 0; hidden: false; wu?: 'px' | '%' };
export type Node = Record<string, unknown> & { id: string; type: string; box: { desktop: Box } };
export type Section = { type: string; layers: Node[]; layersFrame: Record<string, unknown> };

export type Ctx = {
  site: FaeSite;
  pal: Palette;
  fonts: Fonts;
  /** next atom id */
  id: (hint: string) => string;
  /** a photo url by ledger key (`p-…` / `a-…`) — records the use */
  photo: (key: string) => string;
  /** per-slot running index, so two headlines on a page never repeat */
  next: (slot: FaeSlot) => number;
};

export const W = 1200;
export const PAD = 60;
export const CW = W - PAD * 2;

// ————————————————————————————————————————————————————————————— text

/** Width of an average glyph as a share of the font size. Generous: a short estimate overlaps. */
function glyphW(size: number, weight = 400, upper = false): number {
  return size * (upper ? 0.68 : 0.54) * (weight >= 600 ? 1.06 : 1);
}

export function estimateH(text: string, w: number, size: number, lh: number, weight = 400, upper = false): number {
  const perLine = Math.max(4, Math.floor(w / glyphW(size, weight, upper)));
  let lines = 0;
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/);
    let cur = 0;
    let l = 1;
    for (const wd of words) {
      const add = (cur ? 1 : 0) + wd.length;
      if (cur + add > perLine) {
        l++;
        cur = wd.length;
      } else cur += add;
    }
    lines += l;
  }
  // big display type rides above its line box (ascenders, tight lh): give it room so a one-line headline is not clipped
  return Math.ceil(lines * size * lh + 6 + (size >= 40 ? size * 0.15 : 0));
}

export type TextArgs = {
  slot?: FaeSlot;
  index?: number;
  text?: string;
  role?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';
  x: number;
  y: number;
  w: number;
  /** % width inside a card (x stays px) */
  pct?: number;
  size: number;
  color: string;
  font?: 'head' | 'body';
  weight?: number;
  align?: 'left' | 'center' | 'right';
  lh?: number;
  track?: number;
  upper?: boolean;
  italic?: boolean;
  name?: string;
};

export function copy(ctx: Ctx, slot: FaeSlot, index?: number): { text: string; index: number } {
  const i = index ?? ctx.next(slot);
  return { text: faeText(ctx.site, slot, { index: i }), index: i };
}

export function text(ctx: Ctx, a: TextArgs): Node {
  let t = a.text ?? '';
  let idx: number | undefined;
  if (a.slot) {
    const c = copy(ctx, a.slot, a.index);
    t = a.text ?? c.text;
    idx = c.index;
  }
  const head = a.font === 'head';
  const weight = a.weight ?? (head ? (ctx.fonts.headWeight ?? 600) : 400);
  const lh = a.lh ?? (head ? 1.18 : 1.6);
  const h = estimateH(t, a.w, a.size, lh, weight, a.upper);
  const character: Record<string, unknown> = {};
  if (weight !== 400) character.weight = weight;
  const track = a.track ?? (head ? ctx.fonts.headTrack : undefined);
  if (track) character.letterSpacing = track;
  if (a.upper) character.transform = 'uppercase';
  if (a.italic) character.italic = true;
  return {
    id: ctx.id('t'),
    type: 'text',
    name: a.name ?? (a.slot ? a.slot.replace('.', ' ') : 'Text'),
    role: a.role ?? (head ? 'h2' : 'p'),
    text: t,
    ...(a.slot ? { faeSlot: a.slot, ...(idx ? { faeIndex: idx } : {}) } : {}),
    box: { desktop: box(a.x, a.y, a.pct ?? a.w, h, a.pct ? '%' : undefined) },
    style: {
      color: { text: a.color },
      font: { family: head ? ctx.fonts.head : ctx.fonts.body, size: a.size },
      ...(Object.keys(character).length ? { character } : {}),
      paragraph: { lineHeight: lh, ...(a.align && a.align !== 'left' ? { align: a.align } : {}) },
    },
  };
}

export function box(x: number, y: number, w: number, h: number, wu?: '%'): Box {
  return { x: Math.round(x), y: Math.round(y), w: wu ? Math.round(w * 10) / 10 : Math.round(w), h: Math.round(h), rot: 0, hidden: false, ...(wu ? { wu } : {}) };
}

/** The stored height of a node, desktop. */
export const hOf = (n: Node) => n.box.desktop.h;
export const bottom = (n: Node) => n.box.desktop.y + n.box.desktop.h;

// ————————————————————————————————————————————————————————————— atoms

export type BtnLook = 'solid' | 'outline' | 'light' | 'ghost-light' | 'dark';

/** True for a pale colour (#rgb / #rrggbb); anything unparseable counts as dark. */
export function isLight(c: string): boolean {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return false;
  const h = m[1].length === 3 ? m[1].replace(/./g, (x) => x + x) : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

export function button(ctx: Ctx, a: { slot?: FaeSlot; text?: string; href: string; x: number; y: number; w?: number; look?: BtnLook; size?: number; pct?: number }): Node {
  const { pal, fonts } = ctx;
  let t = a.text ?? '';
  let idx: number | undefined;
  if (!a.text) {
    const c = copy(ctx, a.slot ?? 'cta');
    t = c.text;
    idx = c.index;
  }
  const look = a.look ?? 'solid';
  const skin =
    look === 'solid'
      ? { fill: pal.accent, text: pal.accentInk, border: pal.accent }
      : look === 'outline'
        ? { fill: 'rgba(0,0,0,0)', text: pal.ink, border: pal.ink }
        : look === 'light'
          ? { fill: '#ffffff', text: isLight(pal.ink) ? '#16161a' : pal.ink, border: '#ffffff' } // a dark-mode palette's ink is pale
          : look === 'dark'
            ? { fill: pal.dark, text: pal.darkInk, border: pal.dark }
            : { fill: 'rgba(0,0,0,0)', text: '#ffffff', border: 'rgba(255,255,255,0.75)' };
  const size = a.size ?? 15;
  const w = a.w ?? Math.max(150, Math.round(t.length * size * (fonts.btnUpper ? 0.82 : 0.6) + 56));
  return {
    id: ctx.id('b'),
    type: 'button',
    name: 'Button',
    text: t,
    href: a.href,
    ...(!a.text ? { faeSlot: a.slot ?? 'cta', ...(idx ? { faeIndex: idx } : {}) } : {}),
    box: { desktop: box(a.x, a.y, a.pct ?? w, 50, a.pct ? '%' : undefined) },
    style: {
      color: { ...skin, borderWidth: 1, borderRadius: Math.min(fonts.btnRadius ?? 4, 400) },
      font: { family: fonts.body, size },
      character: { weight: 600, ...(fonts.btnUpper ? { transform: 'uppercase', letterSpacing: 1.2 } : {}) },
      paragraph: { align: 'center', valign: 'middle' },
      padding: { top: 12, right: 22, bottom: 12, left: 22 },
    },
  };
}

export function image(ctx: Ctx, a: { key: string; x: number; y: number; w: number; h: number; radius?: number; circle?: boolean; alt?: string; pct?: number; focal?: { x: number; y: number } }): Node {
  return {
    id: ctx.id('i'),
    type: 'image',
    name: a.circle ? 'Portrait' : 'Picture',
    src: ctx.photo(a.key),
    alt: a.alt ?? '',
    fit: 'cover',
    ...(a.focal ? { focal: a.focal } : {}),
    ...(a.circle ? { imgShape: 'circle' } : {}),
    box: { desktop: box(a.x, a.y, a.pct ?? a.w, a.h, a.pct ? '%' : undefined) },
    ...(a.radius ? { style: { color: { borderRadius: a.radius } } } : {}),
  };
}

export function shape(ctx: Ctx, a: { x: number; y: number; w: number; h: number; fill: string; radius?: number; border?: string; name?: string; pct?: number; shadow?: string }): Node {
  return {
    id: ctx.id('s'),
    type: 'shape',
    name: a.name ?? 'Shape',
    box: { desktop: box(a.x, a.y, a.pct ?? a.w, a.h, a.pct ? '%' : undefined) },
    style: {
      color: {
        fill: a.fill,
        ...(a.radius ? { borderRadius: a.radius } : {}),
        ...(a.border ? { border: a.border, borderWidth: 1 } : {}),
        ...(a.shadow ? { shadow: a.shadow } : {}),
      },
    },
  };
}

export function group(ctx: Ctx, a: { name: string; x: number; y: number; w: number; h: number; children: Node[]; fill?: string; border?: string; radius?: number; flow?: { gap?: number; pad?: number }; layout?: Record<string, unknown>; pct?: number; shadow?: string }): Node {
  const color: Record<string, unknown> = {};
  if (a.fill) color.fill = a.fill;
  if (a.border) {
    color.border = a.border;
    color.borderWidth = 1;
  }
  if (a.radius) color.borderRadius = a.radius;
  if (a.shadow) color.shadow = a.shadow;
  return {
    id: ctx.id('g'),
    type: 'group',
    name: a.name,
    ...(a.flow ? { flow: a.flow } : {}),
    ...(a.layout ? { layout: a.layout } : {}),
    box: { desktop: box(a.x, a.y, a.pct ?? a.w, a.h, a.pct ? '%' : undefined) },
    ...(Object.keys(color).length ? { style: { color } } : {}),
    children: a.children,
  };
}

/** A glyph in a circle — the kit's icon (no icon font, no SVG: survives the sanitizer anywhere). */
export function badge(ctx: Ctx, a: { x: number; y: number; d?: number; glyph: string; fill: string; ink: string }): Node[] {
  const d = a.d ?? 52;
  // one group: inside a card that flows, two loose atoms would stack (the glyph pushed under its disc)
  return [
    group(ctx, {
      name: 'Icon', x: a.x, y: a.y, w: d, h: d,
      children: [
        shape(ctx, { x: 0, y: 0, w: d, h: d, fill: a.fill, radius: d / 2, name: 'Icon disc' }),
        text(ctx, { text: a.glyph, x: 0, y: d * 0.18, w: d, size: Math.round(d * 0.46), color: a.ink, align: 'center', lh: 1.2, name: 'Glyph' }),
      ],
    }),
  ];
}

export const GLYPHS = ['✦', '❦', '☘', '❧', '✿', '☾', '❖', '✺', '⚘', '❂', '✧', '☙'];

// ————————————————————————————————————————————————————————————— section frame

export function tone(ctx: Ctx, t: Tone) {
  const p = ctx.pal;
  if (t === 'dark') return { bg: p.dark, ink: p.darkInk, body: p.darkBody, head: p.darkAccent ?? p.darkInk, muted: p.darkBody, card: 'rgba(255,255,255,0.06)', line: 'rgba(255,255,255,0.16)', btn: 'light' as BtnLook };
  if (t === 'accent') return { bg: p.accent, ink: p.accentInk, body: p.accentInk, head: p.accentInk, muted: p.accentInk, card: 'rgba(255,255,255,0.12)', line: 'rgba(255,255,255,0.3)', btn: 'light' as BtnLook };
  return { bg: t === 'surface' ? p.surface : p.bg, ink: p.ink, body: p.body, head: p.ink, muted: p.muted, card: t === 'surface' ? p.bg : p.surface, line: p.line, btn: 'solid' as BtnLook };
}

/** A photo frame's wash: the renderer paints the frame background OVER its own cover photo only when the background
 *  is a gradient (bgPin.overlay alone tints just the scroll-pinned copy), so the wash rides in as a flat gradient. */
export function wash(ov: string): string {
  return `linear-gradient(180deg, ${ov}, ${ov})`;
}

/** On tablet/phone a frame stacks its atoms in desktop top-to-bottom order; a picture or art panel drawn beside
 *  the words (and so starting higher) would land above the headline. This sends them after the words instead. */
export function stackLast<T extends Node>(nodes: T[], order = 50): T[] {
  for (const n of nodes) (n as Record<string, unknown>).flex = { ...((n as Record<string, unknown>).flex as object | undefined), order };
  return nodes;
}

export function frame(h: number, background: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    desktop: { h: Math.ceil(h) },
    band: true,
    maxWidth: W,
    background,
    flexDir: 'column',
    flexBp: { desktop: false, tablet: true, mobile: true },
    flexJustify: 'start',
    flexAlign: 'center',
    flexGap: 20,
    flexPadX: 16,
    flexPadY: 48,
    space: { top: 0, bottom: 0 },
    ...extra,
  };
}

export const section = (layers: Node[], h: number, background: string, type = 'text-rich-text-atomic', extra: Record<string, unknown> = {}): Section => ({
  type,
  layers,
  layersFrame: frame(h, background, extra),
});

/** Vertical cursor: place nodes top to bottom with gaps. */
export function stackDown(nodes: Array<Node | null | undefined>, y0: number, gap: number | number[]): { nodes: Node[]; y: number } {
  let y = y0;
  const out: Node[] = [];
  nodes.forEach((n, i) => {
    if (!n) return;
    n.box.desktop.y = Math.round(y);
    out.push(n);
    y += n.box.desktop.h + (Array.isArray(gap) ? (gap[i] ?? gap[gap.length - 1]) : gap);
  });
  const lastGap = Array.isArray(gap) ? 0 : gap;
  return { nodes: out, y: y - lastGap };
}

// ————————————————————————————————————————————————————————————— section builders

type HeadOpts = { eyebrow?: boolean | string; heading?: string; headSlot?: FaeSlot; intro?: boolean | number; align?: 'left' | 'center'; size?: number };

/** Eyebrow + heading + intro paragraph block, returns nodes and the next y. */
export function headBlock(ctx: Ctx, t: ReturnType<typeof tone>, o: HeadOpts & { x?: number; w?: number; y: number; accent?: string }) {
  const x = o.x ?? PAD;
  const w = o.w ?? CW;
  const align = o.align ?? 'center';
  const iw = align === 'center' ? Math.min(w, 720) : w;
  const ix = align === 'center' ? x + (w - iw) / 2 : x;
  const nodes: Node[] = [];
  if (o.eyebrow)
    nodes.push(text(ctx, { slot: typeof o.eyebrow === 'string' ? undefined : 'eyebrow', text: typeof o.eyebrow === 'string' ? o.eyebrow : undefined, x, y: 0, w, size: 13, color: o.accent ?? t.muted, weight: 600, upper: true, track: 2, align, name: 'Eyebrow' }));
  nodes.push(text(ctx, { slot: o.heading ? undefined : (o.headSlot ?? 'headline'), text: o.heading, x: align === 'center' ? ix - 60 : x, y: 0, w: align === 'center' ? iw + 120 : Math.min(w, 760), size: o.size ?? 40, color: t.head, font: 'head', role: 'h2', align, name: 'Heading' }));
  if (o.intro) nodes.push(text(ctx, { slot: 'subhead', x: ix, y: 0, w: iw, size: 17, color: t.body, align, name: 'Intro' }));
  return stackDown(nodes, o.y, [12, 16, 16]);
}

/** HERO — a photo band. variant: centre text | left text | split (text left, picture right). */
export function hero(
  ctx: Ctx,
  o: {
    variant: 'photo-center' | 'photo-left' | 'split' | 'split-art' | 'plain-center';
    photo?: string;
    h?: number;
    eyebrow?: boolean | string;
    buttons?: 1 | 2;
    overlay?: string;
    tone?: Tone;
    art?: (ctx: Ctx, x: number, y: number, w: number, h: number) => Node[];
    headSize?: number;
    focal?: string;
    imageRadius?: number;
    sideNote?: boolean;
  },
): Section {
  let H = o.h ?? 680;
  const isPhoto = o.variant.startsWith('photo');
  const t = isPhoto ? tone(ctx, 'dark') : tone(ctx, o.tone ?? 'bg');
  const ink = isPhoto ? '#ffffff' : t.head;
  const body = isPhoto ? 'rgba(255,255,255,0.88)' : t.body;
  const centre = o.variant === 'photo-center' || o.variant === 'plain-center';
  const tw = centre ? 860 : o.variant === 'photo-left' ? 640 : 520;
  const tx = centre ? (W - tw) / 2 : PAD;
  const align = centre ? 'center' : 'left';
  const nodes: Node[] = [];
  if (o.eyebrow) nodes.push(text(ctx, { slot: typeof o.eyebrow === 'string' ? undefined : 'eyebrow', text: typeof o.eyebrow === 'string' ? o.eyebrow : undefined, x: tx, y: 0, w: tw, size: 14, color: isPhoto ? 'rgba(255,255,255,0.8)' : ctx.pal.accent, weight: 600, upper: true, track: 2.4, align, name: 'Eyebrow' }));
  nodes.push(text(ctx, { slot: 'headline', x: tx, y: 0, w: tw, size: o.headSize ?? (centre ? 58 : 54), color: ink, font: 'head', role: 'h1', align, lh: 1.1, name: 'Headline' }));
  nodes.push(text(ctx, { slot: 'subhead', x: centre ? tx + 100 : tx, y: 0, w: centre ? tw - 200 : Math.min(tw, 500), size: 18, color: body, align, name: 'Subhead' }));
  const st = stackDown(nodes, 0, [16, 22]);
  // buttons row
  const by = st.y + 34;
  const b1 = button(ctx, { href: '/contact', x: 0, y: by, look: isPhoto ? 'light' : 'solid' });
  const b2 = o.buttons === 2 ? button(ctx, { slot: 'cta', href: '/services', x: 0, y: by, look: isPhoto ? 'ghost-light' : 'outline' }) : null;
  const bw = b1.box.desktop.w + (b2 ? b2.box.desktop.w + 14 : 0);
  let bx = centre ? (W - bw) / 2 : tx;
  b1.box.desktop.x = Math.round(bx);
  if (b2) b2.box.desktop.x = Math.round(bx + b1.box.desktop.w + 14);
  const blockH = by + 50;
  H = Math.max(H, blockH + 220); // a long headline never pushes the buttons onto the next section
  const top = Math.max(110, (H - blockH) / 2 + (isPhoto ? 20 : 0));
  for (const n of st.nodes) n.box.desktop.y += top;
  b1.box.desktop.y += top;
  if (b2) b2.box.desktop.y += top;
  const layers = [...st.nodes, b1, ...(b2 ? [b2] : [])];
  if (o.variant === 'split' && o.photo) {
    layers.push(...stackLast([image(ctx, { key: o.photo, x: 640, y: 60, w: 500, h: H - 120, radius: o.imageRadius ?? ctx.fonts.cardRadius ?? 0 })]));
  }
  if (o.variant === 'split-art' && o.art) layers.push(...stackLast(o.art(ctx, 620, 70, 520, H - 140)));
  if (o.sideNote && isPhoto) {
    // a small floating line of contact at the foot of the hero (the "Let's chat" tab of the reference)
    layers.push(...stackLast([button(ctx, { text: `✉ ${ctx.site.email}`, href: '/contact', x: W - PAD - 300, y: H - 92, w: 300, look: 'dark', size: 14 })], 60));
  }
  const extra: Record<string, unknown> = {};
  const ov = o.overlay ?? 'rgba(10,16,14,0.48)';
  if (isPhoto && o.photo)
    extra.bgPin = { src: ctx.photo(o.photo), paintFrame: true, pinned: false, overlay: ov, ...(o.focal ? { pos: o.focal } : {}) };
  return section(layers, H, isPhoto && o.photo ? wash(ov) : t.bg, 'banner-image-atomic', extra);
}

/** Heading on the left, paragraph + button on the right ("Why I started"). */
export function splitHeading(ctx: Ctx, o: { tone?: Tone; button?: boolean; paras?: 1 | 2; headSlot?: FaeSlot; heading?: string }): Section {
  const t = tone(ctx, o.tone ?? 'bg');
  const head = text(ctx, { slot: o.heading ? undefined : (o.headSlot ?? 'headline'), text: o.heading, x: PAD + 60, y: 110, w: 380, size: 40, color: t.head, font: 'head', name: 'Heading' });
  const right: Node[] = [text(ctx, { slot: 'about', x: 560, y: 0, w: 520, size: 17, color: t.body, name: 'Paragraph' })];
  if (o.paras === 2) right.push(text(ctx, { slot: 'paragraph', x: 560, y: 0, w: 520, size: 17, color: t.body, name: 'Paragraph' }));
  if (o.button !== false) right.push(button(ctx, { slot: 'cta', href: '/about', x: 560, y: 0, look: t.btn === 'solid' ? 'outline' : 'ghost-light' }));
  const st = stackDown(right, 116, [18, 30]);
  const H = Math.max(bottom(head), st.y) + 110;
  return section([head, ...st.nodes], H, t.bg);
}

/** A picture on one side, heading + two paragraphs on the other ("My story"). */
export function imageStory(ctx: Ctx, o: { photo: string; side?: 'left' | 'right'; tone?: Tone; button?: boolean; h?: number; headSlot?: FaeSlot; heading?: string; inset?: boolean; eyebrow?: boolean }): Section {
  const t = tone(ctx, o.tone ?? 'dark');
  const left = (o.side ?? 'left') === 'left';
  const iw = o.inset === false ? 600 : 540;
  const ix = o.inset === false ? (left ? 0 : W - 600) : left ? PAD : W - PAD - iw;
  const tx = left ? ix + iw + 80 : PAD + 20;
  const tw = W - iw - 80 - PAD * 2 - 20;
  const nodes: Node[] = [];
  if (o.eyebrow) nodes.push(text(ctx, { slot: 'eyebrow', x: tx, y: 0, w: tw, size: 13, color: t.muted, weight: 600, upper: true, track: 2, name: 'Eyebrow' }));
  nodes.push(text(ctx, { slot: o.heading ? undefined : (o.headSlot ?? 'headline'), text: o.heading, x: tx, y: 0, w: tw, size: 38, color: t.head, font: 'head', name: 'Heading' }));
  nodes.push(text(ctx, { slot: 'about', x: tx, y: 0, w: tw, size: 16, color: t.body, name: 'Paragraph' }));
  nodes.push(text(ctx, { slot: 'mission', x: tx, y: 0, w: tw, size: 16, color: t.body, name: 'Paragraph' }));
  if (o.button) nodes.push(button(ctx, { slot: 'cta', href: '/about', x: tx, y: 0, look: t.btn }));
  const textH = stackDown(nodes, 0, o.eyebrow ? [12, 22, 16, 28] : [22, 16, 28]).y;
  const H = Math.max(o.h ?? 0, textH + 200, 620);
  const st = stackDown(nodes, (H - textH) / 2, o.eyebrow ? [12, 22, 16, 28] : [22, 16, 28]);
  const pic = image(ctx, { key: o.photo, x: ix, y: o.inset === false ? 0 : 70, w: iw, h: o.inset === false ? H : H - 140, radius: o.inset === false ? 0 : (ctx.fonts.cardRadius ?? 0) });
  return section(left ? [pic, ...st.nodes] : [...st.nodes, pic], H, t.bg);
}

/** Centred heading + paragraph (+ button) — an interlude. */
export function centered(ctx: Ctx, o: { tone?: Tone; eyebrow?: boolean | string; heading?: string; headSlot?: FaeSlot; button?: boolean; slot?: FaeSlot; size?: number }): Section {
  const t = tone(ctx, o.tone ?? 'bg');
  const nodes: Node[] = [];
  if (o.eyebrow) nodes.push(text(ctx, { slot: typeof o.eyebrow === 'string' ? undefined : 'eyebrow', text: typeof o.eyebrow === 'string' ? o.eyebrow : undefined, x: 240, y: 0, w: 720, size: 13, color: t.muted, weight: 600, upper: true, track: 2, align: 'center', name: 'Eyebrow' }));
  nodes.push(text(ctx, { slot: o.heading ? undefined : (o.headSlot ?? 'headline'), text: o.heading, x: 200, y: 0, w: 800, size: o.size ?? 42, color: t.head, font: 'head', align: 'center', name: 'Heading' }));
  nodes.push(text(ctx, { slot: o.slot ?? 'paragraph', x: 270, y: 0, w: 660, size: 17, color: t.body, align: 'center', name: 'Paragraph' }));
  if (o.button) {
    const b = button(ctx, { slot: 'cta', href: '/contact', x: 0, y: 0, look: t.btn });
    b.box.desktop.x = Math.round((W - b.box.desktop.w) / 2);
    nodes.push(b);
  }
  const st = stackDown(nodes, 100, o.eyebrow ? [12, 20, 30] : [20, 30]);
  return section(st.nodes, st.y + 100, t.bg);
}

export type CardKind = 'photo' | 'icon' | 'plain' | 'numbered' | 'price-row';

/** A grid of cards. Each card: optional picture/icon, title, body, optional price/link. */
export function cards(
  ctx: Ctx,
  o: {
    n: number;
    cols: number;
    kind: CardKind;
    tone?: Tone;
    photos?: string[];
    head?: HeadOpts | false;
    titleSlot?: FaeSlot;
    bodySlot?: FaeSlot;
    price?: boolean;
    link?: string;
    cardFill?: boolean;
    imgH?: number;
    button?: boolean;
    align?: 'left' | 'center';
  },
): Section {
  const t = tone(ctx, o.tone ?? 'bg');
  const gap = o.cols >= 4 ? 20 : 28;
  const cellW = (CW - gap * (o.cols - 1)) / o.cols;
  const filled = o.cardFill !== false;
  const pad = filled ? 26 : 0;
  const innerPct = ((cellW - pad * 2) / cellW) * 100;
  const align = o.align ?? (o.kind === 'icon' ? 'center' : 'left');
  const radius = ctx.fonts.cardRadius ?? 0;
  let y = 96;
  const layers: Node[] = [];
  if (o.head !== false) {
    const hb = headBlock(ctx, t, { ...(o.head ?? {}), y, align: o.head?.align ?? 'center', accent: ctx.pal.accent });
    layers.push(...hb.nodes);
    y = hb.y + 52;
  }
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < o.n; i++) {
    const kids: Node[] = [];
    let cy = 0;
    if (o.kind === 'photo' && o.photos?.[i % o.photos.length]) {
      const ih = o.imgH ?? Math.round(cellW * 0.66);
      kids.push(image(ctx, { key: o.photos[i % o.photos.length], x: 0, y: 0, w: cellW, h: ih, pct: 100, radius: filled ? 0 : radius }));
      cy = ih + (filled ? 22 : 18);
    } else if (o.kind === 'icon') {
      const d = 56;
      const bx = align === 'center' ? (cellW - d) / 2 : pad;
      kids.push(...badge(ctx, { x: bx, y: filled ? 30 : 0, d, glyph: GLYPHS[i % GLYPHS.length], fill: o.tone === 'dark' ? 'rgba(255,255,255,0.1)' : ctx.pal.surface === t.card ? ctx.pal.bg : ctx.pal.surface, ink: ctx.pal.accent }));
      cy = (filled ? 30 : 0) + d + 20;
    } else if (o.kind === 'numbered') {
      kids.push(text(ctx, { text: String(i + 1).padStart(2, '0'), x: pad, y: filled ? 28 : 0, w: cellW - pad * 2, pct: innerPct, size: 34, color: ctx.pal.accent, font: 'head', align, name: 'Number' }));
      cy = (filled ? 28 : 0) + 54;
    } else cy = filled ? 28 : 0;
    const title = text(ctx, { slot: o.titleSlot ?? 'offering.title', x: pad, y: cy, w: cellW - pad * 2, pct: innerPct, size: 21, color: t.head, font: 'head', align, name: 'Title', role: 'h3' });
    kids.push(title);
    cy = bottom(title) + 10;
    const body = text(ctx, { slot: o.bodySlot ?? 'offering.body', x: pad, y: cy, w: cellW - pad * 2, pct: innerPct, size: 15, color: t.body, align, name: 'Body' });
    kids.push(body);
    cy = bottom(body);
    if (o.price) {
      const pr = text(ctx, { slot: 'offering.price', x: pad, y: cy + 14, w: cellW - pad * 2, pct: innerPct, size: 18, color: ctx.pal.accent, weight: 700, align, name: 'Price' });
      kids.push(pr);
      cy = bottom(pr);
    }
    if (o.link) {
      const ln = text(ctx, { text: 'Learn more →', x: pad, y: cy + 14, w: cellW - pad * 2, pct: innerPct, size: 14, color: ctx.pal.accent, weight: 600, align, name: 'Link' });
      kids.push({ ...ln, href: o.link });
      cy = bottom(ln);
    }
    const ch = cy + (filled ? 30 : 6);
    maxH = Math.max(maxH, ch);
    items.push(group(ctx, { name: `Card ${i + 1}`, x: 0, y: 0, w: cellW, h: ch, children: kids, flow: { gap: 10, pad: filled ? 30 : 6 }, ...(filled ? { fill: t.card, radius, border: o.tone === 'dark' ? undefined : t.line } : {}) }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const rows = Math.ceil(o.n / o.cols);
  const gh = rows * maxH + (rows - 1) * gap;
  layers.push(group(ctx, { name: 'Cards', x: PAD, y, w: CW, h: gh, children: items, layout: { cols: o.cols, bp: { tablet: Math.min(2, o.cols), mobile: 1 }, gap } }));
  y += gh;
  if (o.button) {
    const b = button(ctx, { slot: 'cta', href: '/services', x: 0, y: y + 48, look: t.btn });
    b.box.desktop.x = Math.round((W - b.box.desktop.w) / 2);
    layers.push(b);
    y = bottom(b);
  }
  return section(layers, y + 100, t.bg);
}

/** People in circles: portrait, name, role (+ bio). */
export function team(ctx: Ctx, o: { n: number; avatars: string[]; tone?: Tone; head?: HeadOpts | false; bio?: boolean; ring?: string; d?: number }): Section {
  const t = tone(ctx, o.tone ?? 'bg');
  const cols = Math.min(o.n, 4);
  const gap = 32;
  const cellW = Math.min(300, (CW - gap * (cols - 1)) / cols);
  const gridW = cellW * cols + gap * (cols - 1);
  const d = o.d ?? Math.min(200, cellW - 60);
  let y = 96;
  const layers: Node[] = [];
  if (o.head !== false) {
    const hb = headBlock(ctx, t, { ...(o.head ?? { heading: 'The folk behind the door' }), y });
    layers.push(...hb.nodes);
    y = hb.y + 56;
  }
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < o.n; i++) {
    const kids: Node[] = [];
    if (o.ring) kids.push(shape(ctx, { x: (cellW - d - 16) / 2, y: 0, w: d + 16, h: d + 16, fill: o.ring, radius: (d + 16) / 2, name: 'Ring' }));
    const off = o.ring ? 8 : 0;
    kids.push(image(ctx, { key: o.avatars[i % o.avatars.length], x: (cellW - d) / 2, y: off, w: d, h: d, circle: true }));
    let cy = d + off * 2 + 20;
    const nm = text(ctx, { slot: 'person.name', index: i, x: 0, y: cy, w: cellW, pct: 100, size: 20, color: t.head, font: 'head', align: 'center', role: 'h3', name: 'Name' });
    const rl = text(ctx, { slot: 'person.role', index: i, x: 0, y: bottom(nm) + 4, w: cellW, pct: 100, size: 14, color: t.muted, align: 'center', name: 'Role' });
    kids.push(nm, rl);
    cy = bottom(rl);
    if (o.bio) {
      const bi = text(ctx, { slot: 'person.bio', index: i, x: 0, y: cy + 10, w: cellW, pct: 100, size: 14, color: t.body, align: 'center', name: 'Bio' });
      kids.push(bi);
      cy = bottom(bi);
    }
    maxH = Math.max(maxH, cy + 6);
    items.push(group(ctx, { name: `Person ${i + 1}`, x: 0, y: 0, w: cellW, h: cy + 6, children: kids }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const rows = Math.ceil(o.n / cols);
  const gh = rows * maxH + (rows - 1) * 40;
  layers.push(group(ctx, { name: 'People', x: (W - gridW) / 2, y, w: gridW, h: gh, children: items, layout: { cols, bp: { tablet: Math.min(2, cols), mobile: 1 }, gap } }));
  return section(layers, y + gh + 100, t.bg);
}

/** A row of numbers. */
export function stats(ctx: Ctx, o: { n?: number; tone?: Tone; head?: HeadOpts | false; boxed?: boolean }): Section {
  const t = tone(ctx, o.tone ?? 'surface');
  const n = o.n ?? 4;
  const gap = 24;
  const cellW = (CW - gap * (n - 1)) / n;
  let y = 80;
  const layers: Node[] = [];
  if (o.head) {
    const hb = headBlock(ctx, t, { ...o.head, y });
    layers.push(...hb.nodes);
    y = hb.y + 44;
  }
  const items: Node[] = [];
  for (let i = 0; i < n; i++) {
    const v = text(ctx, { slot: 'stat.value', index: i, x: 0, y: o.boxed ? 26 : 0, w: cellW, pct: 100, size: 46, color: o.tone === 'dark' || o.tone === 'accent' ? t.head : ctx.pal.accent, font: 'head', align: 'center', name: 'Value' });
    const l = text(ctx, { slot: 'stat.label', index: i, x: 14, y: bottom(v) + 6, w: cellW - 28, pct: ((cellW - 28) / cellW) * 100, size: 14, color: t.body, align: 'center', name: 'Label' });
    items.push(group(ctx, { name: `Stat ${i + 1}`, x: 0, y: 0, w: cellW, h: bottom(l) + (o.boxed ? 26 : 0), children: [v, l], ...(o.boxed ? { fill: t.card, radius: ctx.fonts.cardRadius ?? 0, border: t.line } : {}) }));
  }
  const ih = Math.max(...items.map(hOf));
  for (const it of items) it.box.desktop.h = ih;
  layers.push(group(ctx, { name: 'Numbers', x: PAD, y, w: CW, h: ih, children: items, layout: { cols: n, bp: { tablet: Math.min(n, 2), mobile: Math.min(n, 2) }, gap } }));
  return section(layers, y + ih + 80, t.bg);
}

/** Reviews: quote cards with author (+ optional avatar). */
export function reviews(ctx: Ctx, o: { n?: number; tone?: Tone; head?: HeadOpts | false; avatars?: string[]; cols?: number; big?: boolean }): Section {
  const t = tone(ctx, o.tone ?? 'surface');
  const n = o.n ?? 3;
  const cols = o.cols ?? Math.min(n, 3);
  const gap = 28;
  const cellW = (CW - gap * (cols - 1)) / cols;
  const pad = 30;
  const pct = ((cellW - pad * 2) / cellW) * 100;
  let y = 96;
  const layers: Node[] = [];
  if (o.head !== false) {
    const hb = headBlock(ctx, t, { ...(o.head ?? { heading: 'Kind words from the neighbours' }), y });
    layers.push(...hb.nodes);
    y = hb.y + 52;
  }
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < n; i++) {
    const kids: Node[] = [];
    kids.push(text(ctx, { text: '“', x: pad, y: 18, w: 60, size: 64, color: ctx.pal.accent, font: 'head', lh: 1, name: 'Mark' }));
    const q = text(ctx, { slot: 'review.quote', index: i, x: pad, y: 76, w: cellW - pad * 2, pct, size: o.big ? 20 : 17, color: t.ink === ctx.pal.ink ? ctx.pal.ink : t.ink, font: o.big ? 'head' : 'body', italic: !o.big, lh: 1.55, weight: 400, name: 'Quote' });
    kids.push(q);
    let cy = bottom(q) + 22;
    if (o.avatars?.length) {
      kids.push(image(ctx, { key: o.avatars[i % o.avatars.length], x: pad, y: cy, w: 48, h: 48, circle: true }));
      kids.push(text(ctx, { slot: 'review.author', index: i, x: pad + 62, y: cy + 12, w: cellW - pad * 2 - 62, pct: pct - (62 / cellW) * 100, size: 14, color: t.muted, weight: 600, name: 'Author' }));
      cy += 48;
    } else {
      const a = text(ctx, { slot: 'review.author', index: i, x: pad, y: cy, w: cellW - pad * 2, pct, size: 14, color: t.muted, weight: 600, name: 'Author' });
      kids.push(a);
      cy = bottom(a);
    }
    maxH = Math.max(maxH, cy + 30);
    items.push(group(ctx, { name: `Review ${i + 1}`, x: 0, y: 0, w: cellW, h: cy + 30, children: kids, fill: t.card, radius: ctx.fonts.cardRadius ?? 0, ...(o.tone === 'dark' ? {} : { border: t.line }) }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const rows = Math.ceil(n / cols);
  const gh = rows * maxH + (rows - 1) * gap;
  layers.push(group(ctx, { name: 'Reviews', x: PAD, y, w: CW, h: gh, children: items, layout: { cols, bp: { tablet: Math.min(cols, 2), mobile: 1 }, gap } }));
  return section(layers, y + gh + 100, t.bg);
}

/** "Trusted by" — wordmarks of other fae businesses, set in type. */
export function logos(ctx: Ctx, o: { n?: number; tone?: Tone; label?: string; seeds: string[] }): Section {
  const t = tone(ctx, o.tone ?? 'bg');
  const n = o.n ?? 5;
  const lab = text(ctx, { text: o.label ?? 'Trusted by burrows, bowers and halls across the wood', x: PAD, y: 56, w: CW, size: 14, color: t.muted, align: 'center', name: 'Label' });
  const cellW = (CW - 20 * (n - 1)) / n;
  const marks: Node[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < n; i++) {
    let other = createFaeSite({ seed: o.seeds[i % o.seeds.length] + ':' + i });
    // two neighbours rolling the same name read as a copy-paste: re-roll until it is new
    for (let r = 1; seen.has(other.brand) && r < 20; r++) other = createFaeSite({ seed: `${o.seeds[i % o.seeds.length]}:${i}:${r}` });
    seen.add(other.brand);
    marks.push(text(ctx, { text: `${GLYPHS[(i * 5) % GLYPHS.length]} ${other.brand.replace(/^The /, '')}`, x: 0, y: 0, w: cellW, pct: 100, size: 16, color: t.muted, font: 'head', weight: 700, align: 'center', lh: 1.3, name: 'Wordmark' }));
  }
  const mh = Math.max(...marks.map(hOf));
  const g = group(ctx, { name: 'Wordmarks', x: PAD, y: bottom(lab) + 26, w: CW, h: mh, children: marks, layout: { cols: n, bp: { tablet: 3, mobile: 2 }, gap: 20 } });
  return section([lab, g], bottom(g) + 60, t.bg);
}

/** A coloured call-to-action band. */
export function ctaBand(ctx: Ctx, o: { tone?: Tone; split?: boolean; photo?: string; buttons?: 1 | 2 }): Section {
  const t = tone(ctx, o.tone ?? 'accent');
  const layers: Node[] = [];
  if (o.split) {
    const h = text(ctx, { slot: 'headline', x: PAD, y: 0, w: 640, size: 38, color: t.head, font: 'head', name: 'Heading' });
    const p = text(ctx, { slot: 'subhead', x: PAD, y: 0, w: 600, size: 17, color: t.body, name: 'Paragraph' });
    const st = stackDown([h, p], 90, 16);
    const b = button(ctx, { href: '/contact', x: W - PAD - 240, y: 0, w: 240, look: o.tone === 'accent' ? 'light' : t.btn });
    b.box.desktop.y = Math.round((90 + st.y) / 2 - 25);
    layers.push(...st.nodes, b);
    return section(layers, st.y + 90, t.bg);
  }
  const nodes: Node[] = [
    text(ctx, { slot: 'headline', x: 200, y: 0, w: 800, size: 42, color: t.head, font: 'head', align: 'center', name: 'Heading' }),
    text(ctx, { slot: 'subhead', x: 280, y: 0, w: 640, size: 17, color: t.body, align: 'center', name: 'Paragraph' }),
  ];
  const st = stackDown(nodes, 100, 18);
  const b1 = button(ctx, { href: '/contact', x: 0, y: st.y + 32, look: o.tone === 'accent' ? 'light' : t.btn });
  const b2 = o.buttons === 2 ? button(ctx, { href: '/services', x: 0, y: st.y + 32, look: o.tone === 'bg' || o.tone === 'surface' ? 'outline' : 'ghost-light' }) : null;
  const bw = b1.box.desktop.w + (b2 ? b2.box.desktop.w + 14 : 0);
  b1.box.desktop.x = Math.round((W - bw) / 2);
  if (b2) b2.box.desktop.x = b1.box.desktop.x + b1.box.desktop.w + 14;
  const extra: Record<string, unknown> = {};
  if (o.photo) extra.bgPin = { src: ctx.photo(o.photo), paintFrame: true, pinned: false, overlay: 'rgba(8,12,10,0.58)' };
  return section([...st.nodes, b1, ...(b2 ? [b2] : [])], st.y + 32 + 50 + 100, o.photo ? wash('rgba(8,12,10,0.58)') : t.bg, 'text-rich-text-atomic', extra);
}

/** Questions and answers — an accordion. */
export function faq(ctx: Ctx, o: { n?: number; tone?: Tone; head?: HeadOpts | false; side?: boolean }): Section {
  const t = tone(ctx, o.tone ?? 'bg');
  const n = o.n ?? 5;
  let y = 96;
  const layers: Node[] = [];
  const side = o.side !== false;
  const aw = side ? 680 : 820;
  const ax = side ? W - PAD - aw : (W - aw) / 2;
  if (o.head !== false) {
    const hb = headBlock(ctx, t, { ...(o.head ?? { heading: 'Questions we hear at the door' }), y, ...(side ? { x: PAD, w: 320, align: 'left' } : {}) });
    layers.push(...hb.nodes);
    if (!side) y = hb.y + 48;
  }
  const padX = 22;
  const padY = 18;
  const headH = padY * 2 + 24;
  const itemGap = 12;
  const items: Node[] = [];
  for (let i = 0; i < n; i++) {
    const q = copy(ctx, 'faq.question', i).text;
    const ans = text(ctx, { slot: 'faq.answer', index: i, x: padX, y: 0, w: aw - padX * 2, pct: ((aw - padX * 2) / aw) * 100, size: 15, color: t.body, name: 'Answer' });
    items.push({
      id: ctx.id('q'),
      type: 'group',
      name: `Accordion ${i + 1}`,
      text: q,
      flow: { gap: 8, pad: padY },
      box: { desktop: box(0, i * (headH + itemGap), 100, headH, '%') },
      style: { color: { fill: t.card, border: t.line, borderWidth: 1, borderRadius: ctx.fonts.cardRadius ?? 0 } },
      children: [ans],
    });
  }
  const ah = n * headH + (n - 1) * itemGap;
  layers.push({
    id: ctx.id('f'),
    type: 'group',
    name: 'Accordion',
    fold: { sign: 'plus', single: true, head: { size: 17, weight: 600, color: t.head, signColor: ctx.pal.accent, padX, padY } },
    flow: { gap: itemGap },
    box: { desktop: box(ax, y, aw, ah) },
    style: { font: { family: ctx.fonts.body } },
    children: items,
  });
  return section(layers, y + ah + 100 + (side ? 0 : 0), t.bg);
}

/** Contact: the details on one side, a picture or a note card on the other. */
export function contact(ctx: Ctx, o: { tone?: Tone; photo?: string; heading?: string }): Section {
  const t = tone(ctx, o.tone ?? 'bg');
  const s = ctx.site;
  const nodes: Node[] = [
    text(ctx, { text: o.heading ?? 'Find our door', x: PAD, y: 0, w: 480, size: 44, color: t.head, font: 'head', role: 'h1', name: 'Heading' }),
    text(ctx, { slot: 'subhead', x: PAD, y: 0, w: 480, size: 17, color: t.body, name: 'Paragraph' }),
  ];
  const rows: Array<[string, FaeSlot, string]> = [
    ['Where', 'address', s.address],
    ['Write', 'email', s.email],
    ['Ring', 'phone', s.phone],
    ['Open', 'hours', s.hours],
  ];
  for (const [label, slot] of rows) {
    nodes.push(text(ctx, { text: label, x: PAD, y: 0, w: 480, size: 12, color: ctx.pal.accent, weight: 700, upper: true, track: 2, name: `${label} label` }));
    nodes.push(text(ctx, { slot, index: 0, x: PAD, y: 0, w: 480, size: 17, color: t.ink, name: label }));
  }
  const st = stackDown(nodes, 110, [18, 34, 6, 18, 6, 18, 6, 18, 6]);
  const b = button(ctx, { text: 'Send us a note', href: '/contact', x: PAD, y: st.y + 34, look: t.btn });
  const H = Math.max(bottom(b) + 110, 640);
  const right: Node[] = [];
  if (o.photo) right.push(image(ctx, { key: o.photo, x: 640, y: 90, w: 500, h: H - 180, radius: ctx.fonts.cardRadius ?? 0 }));
  else {
    right.push(shape(ctx, { x: 640, y: 90, w: 500, h: H - 180, fill: t.card, radius: ctx.fonts.cardRadius ?? 0, border: t.line, name: 'Note card' }));
    right.push(text(ctx, { slot: 'paragraph', x: 690, y: 150, w: 400, size: 18, color: t.ink, font: 'head', italic: true, name: 'Note' }));
  }
  return section([...st.nodes, b, ...right], H, t.bg);
}

/** Plans side by side; the middle one marked. */
export function pricing(ctx: Ctx, o: { n?: number; tone?: Tone; head?: HeadOpts | false }): Section {
  const t = tone(ctx, o.tone ?? 'bg');
  const n = o.n ?? 3;
  const gap = 24;
  const cellW = (CW - gap * (n - 1)) / n;
  const pad = 30;
  const pct = ((cellW - pad * 2) / cellW) * 100;
  let y = 96;
  const layers: Node[] = [];
  if (o.head !== false) {
    const hb = headBlock(ctx, t, { ...(o.head ?? { heading: 'Plain prices, no hidden acorns', intro: true }), y });
    layers.push(...hb.nodes);
    y = hb.y + 52;
  }
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < n; i++) {
    const hot = i === Math.floor(n / 2);
    const ink = hot ? ctx.pal.accentInk : t.head;
    const body = hot ? ctx.pal.accentInk : t.body;
    const kids: Node[] = [];
    const ti = text(ctx, { slot: 'offering.title', index: i, x: pad, y: 32, w: cellW - pad * 2, pct, size: 20, color: ink, font: 'head', name: 'Plan', role: 'h3' });
    const pr = text(ctx, { slot: 'offering.price', index: i, x: pad, y: bottom(ti) + 10, w: cellW - pad * 2, pct, size: 38, color: ink, font: 'head', weight: 700, name: 'Price' });
    const bo = text(ctx, { slot: 'offering.body', index: i, x: pad, y: bottom(pr) + 12, w: cellW - pad * 2, pct, size: 15, color: body, name: 'What you get' });
    kids.push(ti, pr, bo);
    let cy = bottom(bo) + 16;
    for (let k = 0; k < 3; k++) {
      const li = text(ctx, { text: `✓ ${copy(ctx, 'offering.title', i * 3 + k + 1).text}`, x: pad, y: cy, w: cellW - pad * 2, pct, size: 14, color: body, name: 'Includes' });
      kids.push(li);
      cy = bottom(li) + 6;
    }
    const b = button(ctx, { slot: 'cta', href: '/contact', x: pad, y: cy + 18, pct, look: hot ? 'light' : 'solid' });
    kids.push(b);
    cy = bottom(b) + 32;
    maxH = Math.max(maxH, cy);
    items.push(group(ctx, { name: `Plan ${i + 1}`, x: 0, y: 0, w: cellW, h: cy, children: kids, fill: hot ? ctx.pal.accent : t.card, radius: ctx.fonts.cardRadius ?? 0, ...(hot ? {} : { border: t.line }) }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  layers.push(group(ctx, { name: 'Plans', x: PAD, y, w: CW, h: maxH, children: items, layout: { cols: n, bp: { tablet: 1, mobile: 1 }, gap } }));
  return section(layers, y + maxH + 100, t.bg);
}

/** Alternating picture/text rows. `art` rows draw a composed panel instead of a photo. */
export function zigzag(
  ctx: Ctx,
  o: {
    rows: Array<{ photo?: string; art?: (ctx: Ctx, x: number, y: number, w: number, h: number) => Node[]; bullets?: number; pill?: boolean }>;
    tone?: Tone;
    head?: HeadOpts | false;
    startRight?: boolean;
    card?: boolean;
  },
): Section[] {
  const out: Section[] = [];
  const t = tone(ctx, o.tone ?? 'bg');
  o.rows.forEach((row, i) => {
    const layers: Node[] = [];
    let y = 80;
    if (i === 0 && o.head !== false && o.head) {
      const hb = headBlock(ctx, t, { ...o.head, y: 96 });
      layers.push(...hb.nodes);
      y = hb.y + 60;
    }
    const picRight = (i % 2 === 0) !== !!o.startRight;
    const pw = 540;
    const ph = 400;
    const px = picRight ? W - PAD - pw : PAD;
    const tx = picRight ? PAD : PAD + pw + 70;
    const tw = CW - pw - 70;
    const nodes: Node[] = [];
    if (row.pill) {
      const lab = copy(ctx, 'eyebrow').text;
      nodes.push({ ...text(ctx, { text: lab, x: tx, y: 0, w: Math.min(tw, lab.length * 8 + 40), size: 12, color: ctx.pal.accent, weight: 700, upper: true, track: 1.4, name: 'Tag' }) });
    }
    nodes.push(text(ctx, { slot: 'headline', x: tx, y: 0, w: tw, size: 34, color: t.head, font: 'head', name: 'Heading' }));
    nodes.push(text(ctx, { slot: 'paragraph', x: tx, y: 0, w: tw, size: 16, color: t.body, name: 'Paragraph' }));
    for (let k = 0; k < (row.bullets ?? 0); k++) nodes.push(text(ctx, { text: `✦  ${copy(ctx, 'offering.title').text}`, x: tx, y: 0, w: tw, size: 15, color: t.ink, name: 'Point' }));
    const gaps = [...(row.pill ? [12] : []), 16, 18, ...Array(row.bullets ?? 0).fill(8)];
    const th = stackDown(nodes.map((n) => ({ ...n, box: { desktop: { ...n.box.desktop } } })), 0, gaps).y;
    const rowH = Math.max(ph, th);
    const st = stackDown(nodes, y + (rowH - th) / 2, gaps);
    if (row.photo) layers.push(image(ctx, { key: row.photo, x: px, y: y + (rowH - ph) / 2, w: pw, h: ph, radius: ctx.fonts.cardRadius ?? 0 }));
    else if (row.art) layers.push(...row.art(ctx, px, y + (rowH - ph) / 2, pw, ph));
    layers.push(...st.nodes);
    out.push(section(picRight ? [...st.nodes, ...layers.filter((l) => !st.nodes.includes(l))] : layers, y + rowH + 80, t.bg));
  });
  return out;
}

/** Numbered steps across. */
export function steps(ctx: Ctx, o: { n?: number; tone?: Tone; head?: HeadOpts | false }): Section {
  return cards(ctx, { n: o.n ?? 3, cols: o.n ?? 3, kind: 'numbered', tone: o.tone, head: o.head ?? { heading: 'How it works', intro: true }, cardFill: false, titleSlot: 'offering.title', bodySlot: 'offering.body' });
}

/** Journal: photo cards with a date line and an excerpt. */
export function posts(ctx: Ctx, o: { n?: number; photos: string[]; tone?: Tone; head?: HeadOpts | false }): Section {
  const t = tone(ctx, o.tone ?? 'bg');
  const n = o.n ?? 3;
  const gap = 28;
  const cellW = (CW - gap * (n - 1)) / n;
  let y = 96;
  const layers: Node[] = [];
  if (o.head !== false) {
    const hb = headBlock(ctx, t, { ...(o.head ?? { heading: 'From the journal' }), y });
    layers.push(...hb.nodes);
    y = hb.y + 52;
  }
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < n; i++) {
    const ih = Math.round(cellW * 0.62);
    const kids: Node[] = [image(ctx, { key: o.photos[i % o.photos.length], x: 0, y: 0, w: cellW, h: ih, pct: 100, radius: ctx.fonts.cardRadius ?? 0 })];
    const d = text(ctx, { slot: 'event.date', index: i, x: 0, y: ih + 18, w: cellW, pct: 100, size: 12, color: ctx.pal.accent, weight: 700, upper: true, track: 1.4, name: 'Date' });
    const ti = text(ctx, { slot: 'post.title', index: i, x: 0, y: bottom(d) + 8, w: cellW, pct: 100, size: 21, color: t.head, font: 'head', role: 'h3', name: 'Title' });
    const ex = text(ctx, { slot: 'post.excerpt', index: i, x: 0, y: bottom(ti) + 8, w: cellW, pct: 100, size: 15, color: t.body, name: 'Excerpt' });
    kids.push(d, ti, ex);
    maxH = Math.max(maxH, bottom(ex) + 6);
    items.push(group(ctx, { name: `Post ${i + 1}`, x: 0, y: 0, w: cellW, h: bottom(ex) + 6, children: kids, flow: { gap: 8, pad: 6 } }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  layers.push(group(ctx, { name: 'Posts', x: PAD, y, w: CW, h: maxH, children: items, layout: { cols: n, bp: { tablet: 2, mobile: 1 }, gap } }));
  return section(layers, y + maxH + 100, t.bg);
}

/** A page-top title band for inner pages. */
export function pageTitle(ctx: Ctx, o: { title: string; tone?: Tone; photo?: string; intro?: boolean; align?: 'left' | 'center' }): Section {
  const t = o.photo ? tone(ctx, 'dark') : tone(ctx, o.tone ?? 'surface');
  const centre = (o.align ?? 'center') === 'center';
  const nodes: Node[] = [
    text(ctx, { text: o.title, x: centre ? 200 : PAD, y: 0, w: centre ? 800 : 760, size: 54, color: o.photo ? '#ffffff' : t.head, font: 'head', role: 'h1', align: centre ? 'center' : 'left', name: 'Title' }),
  ];
  if (o.intro !== false) nodes.push(text(ctx, { slot: 'subhead', x: centre ? 280 : PAD, y: 0, w: 640, size: 18, color: o.photo ? 'rgba(255,255,255,0.88)' : t.body, align: centre ? 'center' : 'left', name: 'Intro' }));
  const st = stackDown(nodes, 120, 18);
  const H = Math.max(st.y + 110, o.photo ? 420 : 0);
  if (o.photo) {
    const off = (H - st.y - 110) / 2;
    for (const n of st.nodes) n.box.desktop.y += Math.round(off);
  }
  const extra: Record<string, unknown> = {};
  if (o.photo) extra.bgPin = { src: ctx.photo(o.photo), paintFrame: true, pinned: false, overlay: 'rgba(8,12,10,0.52)' };
  return section(st.nodes, H, o.photo ? wash('rgba(8,12,10,0.52)') : t.bg, o.photo ? 'banner-image-atomic' : 'text-rich-text-atomic', extra);
}

// ————————————————————————————————————————————————————————————— composed art

/** A ledger/dashboard panel drawn from shapes: a card, a figure, a bar chart, a row of chips. */
export function chartPanel(look: { card: string; ink: string; muted: string; bar: string; bar2?: string; line?: string; radius?: number; dark?: boolean }) {
  return (ctx: Ctx, x: number, y: number, w: number, h: number): Node[] => {
    const kids: Node[] = [];
    const pad = 28;
    kids.push(text(ctx, { text: 'Hoard this season', x: pad, y: 24, w: 260, size: 13, color: look.muted, weight: 600, name: 'Label' }));
    kids.push(text(ctx, { text: `${(ctx.site.seed.charCodeAt(5) % 9) + 1},${(ctx.site.seed.charCodeAt(6) % 900) + 100} gold acorns`, x: pad, y: 46, w: w - pad * 2, size: 30, color: look.ink, font: 'head', weight: 700, name: 'Figure' }));
    kids.push(text(ctx, { text: '▲ 18% since the last harvest', x: pad, y: 92, w: 300, size: 13, color: look.bar, weight: 600, name: 'Trend' }));
    const chartTop = 140;
    const chartH = h - chartTop - 70;
    const n = 8;
    const bw = (w - pad * 2 - (n - 1) * 14) / n;
    for (let i = 0; i < n; i++) {
      const v = 0.35 + 0.6 * Math.abs(Math.sin((i + 1) * 1.7 + ctx.site.seed.length));
      const bh = Math.round(chartH * v);
      kids.push(shape(ctx, { x: pad + i * (bw + 14), y: chartTop + chartH - bh, w: bw, h: bh, fill: i === n - 2 ? look.bar : (look.bar2 ?? look.line ?? look.bar), radius: 6, name: 'Bar' }));
    }
    const months = ['Bud', 'Leaf', 'Bloom', 'Sun', 'Hay', 'Fruit', 'Mist', 'Frost'];
    for (let i = 0; i < n; i++) kids.push(text(ctx, { text: months[i], x: pad + i * (bw + 14) - 6, y: chartTop + chartH + 10, w: bw + 12, size: 11, color: look.muted, align: 'center', name: 'Month' }));
    kids.push(shape(ctx, { x: pad, y: h - 36, w: w - pad * 2, h: 1, fill: look.line ?? look.muted, name: 'Rule' }));
    return [fitPhone(group(ctx, { name: 'Ledger panel', x, y, w, h, children: kids, fill: look.card, radius: look.radius ?? 18, shadow: look.dark ? undefined : '0px 20px 50px rgba(20,20,40,0.12)', border: look.line }))];
  };
}

/** A drawn panel's parts are placed in px for its desktop width; on a phone the panel narrows to the column, so each
 *  part gets a phone face scaled sideways to match (heights keep: the rows still fit). */
export function fitPhone(panel: Node, phoneW = 358): Node {
  const dw = panel.box.desktop.w;
  if (dw <= phoneW) return panel;
  const f = phoneW / dw;
  // no face on the panel itself: an explicit phone box pins a node out of the stack (it went absolute, off-screen);
  // in the stack it already shrinks to the column via max-width — only its insides need the phone geometry
  for (const k of (panel.children as Node[] | undefined) ?? []) {
    if (k.box.desktop.wu === '%') continue;
    (k.box as Record<string, unknown>).mobile = { x: Math.round(k.box.desktop.x * f), w: Math.round(k.box.desktop.w * f) };
  }
  return panel;
}

/** A list panel: rows of name + amount (a "transactions" card). */
export function listPanel(look: { card: string; ink: string; muted: string; accent: string; line?: string; radius?: number; avatars?: string[] }) {
  return (ctx: Ctx, x: number, y: number, w: number, h: number): Node[] => {
    const kids: Node[] = [];
    const pad = 26;
    kids.push(text(ctx, { text: 'Recent tallies', x: pad, y: 22, w: 260, size: 16, color: look.ink, font: 'head', weight: 700, name: 'Title' }));
    const rowH = 58;
    const n = Math.max(3, Math.min(5, Math.floor((h - 80) / rowH)));
    for (let i = 0; i < n; i++) {
      const ry = 70 + i * rowH;
      if (look.avatars?.length) kids.push(image(ctx, { key: look.avatars[i % look.avatars.length], x: pad, y: ry, w: 40, h: 40, circle: true }));
      else kids.push(shape(ctx, { x: pad, y: ry, w: 40, h: 40, fill: look.line ?? look.muted, radius: 20, name: 'Dot' }));
      kids.push(text(ctx, { text: copy(ctx, 'review.author', i + 7).text.split(',')[0], x: pad + 54, y: ry + 2, w: w - pad * 2 - 160, size: 14, color: look.ink, weight: 600, name: 'Name' }));
      kids.push(text(ctx, { text: copy(ctx, 'offering.title', i).text, x: pad + 54, y: ry + 21, w: w - pad * 2 - 160, size: 12, color: look.muted, name: 'What' }));
      kids.push(text(ctx, { text: `${(i * 37 + 12) % 90 + 9}.${(i * 13) % 9}0 ⟡`, x: w - pad - 100, y: ry + 10, w: 100, size: 14, color: look.accent, weight: 700, align: 'right', name: 'Amount' }));
      if (i < n - 1) kids.push(shape(ctx, { x: pad, y: ry + rowH - 9, w: w - pad * 2, h: 1, fill: look.line ?? look.muted, name: 'Rule' }));
    }
    return [fitPhone(group(ctx, { name: 'Tally panel', x, y, w, h, children: kids, fill: look.card, radius: look.radius ?? 18, shadow: '0px 20px 50px rgba(20,20,40,0.12)', border: look.line }))];
  };
}

// ————————————————————————————————————————————————————————————— pages + bundle

export type PageSpec = { slug: string; title: string; build: (ctx: Ctx) => Array<Section | Section[]> };

export type TemplateSpec = {
  key: string;
  ref: string;
  name: string;
  industry: string;
  category: string;
  palette: Palette;
  fonts: Fonts;
  chrome: { nav: string; footer: string; note?: string };
  description: string;
  pages: PageSpec[];
  /** the photo/art keys this template uses, for the ledger */
  tags?: string[];
};

export type Ledger = { photos: Record<string, { url: string; uses: string[] }> };

export function buildTemplate(spec: TemplateSpec, ledger: Ledger, uuid: () => string) {
  const templateId = `fae-${spec.key}`;
  const site = createFaeSite({ seed: templateId, industry: spec.industry });
  const used = new Set<string>();
  const pages = spec.pages.map((p) => {
    let n = 0;
    const counters = new Map<string, number>();
    const ctx: Ctx = {
      site,
      pal: spec.palette,
      fonts: spec.fonts,
      id: (hint) => `${hint}${(++n).toString(36)}-${p.slug.replace(/[^a-z0-9]/g, '') || 'home'}`,
      photo: (key) => {
        const ph = ledger.photos[key];
        if (!ph) throw new Error(`${spec.key}: no photo ${key} in the ledger`);
        used.add(key);
        return ph.url;
      },
      next: (slot) => {
        const v = counters.get(slot) ?? 0;
        counters.set(slot, v + 1);
        return v;
      },
    };
    const sections = p.build(ctx).flat();
    const model = {
      id: uuid(),
      slug: p.slug,
      title: p.title,
      chrome: { navEnabled: true, footerEnabled: true },
      sections: sections.map((s) => ({
        id: uuid(),
        type: s.type,
        enabled: true,
        blocks: [],
        config: { props: {} },
        layers: s.layers,
        layersFrame: s.layersFrame,
      })),
      layoutMode: 'stack',
      fae: { seed: templateId, industry: spec.industry, cast: site.cast },
    };
    return { slug: p.slug, title: p.title, model, isPublic: true, inNav: true };
  });
  return { templateId, site, pages, used: [...used] };
}

/** Drawn portraits for the site's own people, matching each person's species (a-<species>-<n>).
 *  `offset` shifts which of the six drawings a template starts on, so neighbouring templates differ. */
export function avatarsFor(site: FaeSite, offset = 0): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  const list = site.people.length ? site.people : [{ species: site.cast.mode === 'single' ? site.cast.species : site.cast.species[0] }];
  for (let i = 0; i < 6; i++) {
    const sp = (list[i % list.length] as { species: string }).species;
    const k = seen.get(sp) ?? 0;
    seen.set(sp, k + 1);
    out.push(`a-${sp}-${(k + offset) % 6}`);
  }
  return out;
}

/** A wide picture on its own band (the illustration/photo strip under a centred hero). */
export function photoBand(ctx: Ctx, o: { photo: string; tone?: Tone; h?: number; radius?: number; inset?: boolean }): Section {
  const t = tone(ctx, o.tone ?? 'bg');
  const h = o.h ?? 520;
  const inset = o.inset !== false;
  const pic = image(ctx, { key: o.photo, x: inset ? PAD : 0, y: inset ? 0 : 0, w: inset ? CW : W, h, radius: inset ? (o.radius ?? ctx.fonts.cardRadius ?? 0) : 0 });
  return section([pic], h + (inset ? 90 : 0), t.bg);
}

/** A composed panel (chartPanel / listPanel) centred on its own band — the "dashboard under the hero". */
export function artBand(ctx: Ctx, o: { art: (ctx: Ctx, x: number, y: number, w: number, h: number) => Node[]; tone?: Tone; w?: number; h?: number }): Section {
  const t = tone(ctx, o.tone ?? 'bg');
  const w = o.w ?? 880;
  const h = o.h ?? 440;
  return section(o.art(ctx, (W - w) / 2, 0, w, h), h + 90, t.bg);
}

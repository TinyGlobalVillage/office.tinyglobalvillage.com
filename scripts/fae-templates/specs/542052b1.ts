// Ref — a charcoal tech studio with coral buttons: words left over a drifting field of dots, bordered split panels.
// Kept: split hero (words left, dot-field art right) · bordered panel: heading + paragraph left, 2×2 icon cards right ·
// ring art beside paragraphs + coral button · "proud of our numbers" strip · closing band.
import {
  avatarsFor, badge, bottom, button, cards, ctaBand, faq, GLYPHS, group, hero, PAD, pageTitle, pricing, reviews, section, shape,
  stats, team, text, tone, zigzag, type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';

const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** A field of dots swelling in a slow wave — narrow enough to keep its dots round on a phone. */
function dotField(c: Ctx, x: number, y: number, w: number, h: number): Node[] {
  const cols = 11;
  const rows = 10;
  const step = 32;
  const gw = cols * step;
  const gh = rows * step;
  const kids: Node[] = [];
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++) {
      const v = 0.5 + 0.5 * Math.sin(k * 0.6 + r * 0.45);
      const d = Math.round(4 + v * 10);
      const a = (0.18 + v * 0.7).toFixed(2);
      kids.push(shape(c, { x: k * step + (step - d) / 2, y: r * step + (step - d) / 2, w: d, h: d, fill: v > 0.82 ? '#ff6b57' : `rgba(170,185,255,${a})`, radius: d / 2, name: 'Dot' }));
    }
  return [group(c, { name: 'Dot field', x: x + (w - gw) / 2, y: y + Math.max(0, (h - gh) / 2), w: gw, h: gh, children: kids })];
}

/** Concentric rings with a short line of words in the middle. */
function rings(c: Ctx, x: number, y: number, w: number, h: number): Node[] {
  const d = 340;
  const kids: Node[] = [];
  [340, 260, 180].forEach((s, i) =>
    kids.push(shape(c, { x: (d - s) / 2, y: (d - s) / 2, w: s, h: s, fill: i === 2 ? 'rgba(255,107,87,0.14)' : 'rgba(0,0,0,0)', border: i === 2 ? '#ff6b57' : 'rgba(170,185,255,0.45)', radius: s / 2, name: 'Ring' })),
  );
  kids.push(text(c, { text: 'Every rune, on time', x: 100, y: 150, w: 140, size: 15, color: '#ffffff', weight: 700, align: 'center', lh: 1.3, name: 'Ring words' }));
  return [group(c, { name: 'Rings', x: x + (w - d) / 2, y: y + Math.max(0, (h - d) / 2), w: d, h: d, children: kids })];
}

/** A bordered panel: heading + paragraph + button on the left, a 2×2 grid of icon cards on the right. */
function borderedSplit(c: Ctx): Section {
  const t = tone(c, 'bg');
  const left: Node[] = [];
  const h = text(c, { slot: 'headline', x: 40, y: 50, w: 400, size: 36, color: t.head, font: 'head', name: 'Heading' });
  const p = text(c, { slot: 'about', x: 40, y: bottom(h) + 18, w: 400, size: 16, color: t.body, name: 'Paragraph' });
  const b = button(c, { slot: 'cta', href: '/services', x: 40, y: bottom(p) + 28 });
  left.push(h, p, b);
  const cellW = 250;
  const gap = 20;
  const items: Node[] = [];
  let maxH = 0;
  for (let i = 0; i < 4; i++) {
    const ti = text(c, { slot: 'offering.title', x: 22, y: 92, w: cellW - 44, pct: 82, size: 18, color: '#aab9ff', font: 'head', weight: 600, role: 'h3', name: 'Title' });
    const bo = text(c, { slot: 'offering.body', x: 22, y: bottom(ti) + 8, w: cellW - 44, pct: 82, size: 14, color: t.body, name: 'Body' });
    const kids = [...badge(c, { x: 22, y: 24, d: 48, glyph: GLYPHS[(i * 2 + 1) % GLYPHS.length], fill: 'rgba(255,107,87,0.16)', ink: '#ff6b57' }), ti, bo];
    maxH = Math.max(maxH, bottom(bo) + 24);
    items.push(group(c, { name: `Card ${i + 1}`, x: 0, y: 0, w: cellW, h: bottom(bo) + 24, children: kids, fill: c.pal.surface, radius: 14, flow: { gap: 8, pad: 22 } }));
  }
  for (const it of items) it.box.desktop.h = maxH;
  const gh = maxH * 2 + gap;
  const grid = group(c, { name: 'Cards', x: 1080 - 40 - (cellW * 2 + gap), y: 40, w: cellW * 2 + gap, h: gh, children: items, layout: { cols: 2, bp: { tablet: 2, mobile: 1 }, gap } });
  // phone: the panel's flow re-tops its kids but keeps their desktop x/w — pull the grid under the words, one card per row
  (grid.box as Record<string, unknown>).mobile = { x: 20, w: 318, h: maxH * 4 + gap * 3 };
  const ph = Math.max(bottom(b) + 50, gh + 80);
  const panel = group(c, { name: 'Panel', x: PAD, y: 60, w: 1080, h: ph, children: [...left, grid], border: c.pal.line, radius: 22, flow: { gap: 22, pad: 40 } });
  return section([panel], ph + 120, t.bg);
}

const spec: TemplateSpec = {
  key: '542052b1',
  ref: '542052b1',
  name: 'Starling Runeworks',
  industry: 'agency',
  category: 'Agency',
  description: 'A rune-tech studio by ember-light: drifting dots, bordered panels, rings of timing and proud numbers.',
  palette: {
    bg: '#16161b', surface: '#1f1f27', ink: '#f3f3f7', body: 'rgba(243,243,247,0.7)', muted: 'rgba(243,243,247,0.5)',
    accent: '#ff6b57', accentInk: '#ffffff', dark: '#0f0f13', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.72)', darkAccent: '#aab9ff',
    line: 'rgba(255,255,255,0.14)',
  },
  fonts: { head: sans, body: sans, headWeight: 600, headTrack: -0.5, btnRadius: 8, cardRadius: 14 },
  chrome: { nav: 'wordmark left, links right, log-in link + outline CTA', footer: 'charcoal: wordmark + socials left, three link columns' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'split-art', tone: 'bg', art: dotField, h: 660, buttons: 1, eyebrow: true }),
        borderedSplit(c),
        zigzag(c, { tone: 'bg', rows: [{ art: rings, bullets: 2 }] }),
        stats(c, { n: 4, tone: 'surface', head: { heading: 'Numbers we hum about', align: 'left' } }),
        ctaBand(c, { tone: 'accent', split: true }),
      ],
    },
    {
      slug: 'services',
      title: 'Services',
      build: (c) => [
        pageTitle(c, { title: 'Runes we cast', tone: 'surface', align: 'left', intro: true }),
        cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'bg', head: false, align: 'left' }),
        pricing(c, { n: 3, tone: 'surface', head: { heading: 'Pick a spell-book' } }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'The rune circle', tone: 'bg', align: 'left' }),
        team(c, { n: 4, avatars: avatarsFor(c.site, 6), tone: 'surface', ring: '#ff6b57', bio: true }),
        reviews(c, { n: 3, tone: 'bg', head: false }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [
        pageTitle(c, { title: 'Send a starling', tone: 'surface', align: 'left', intro: true }),
        faq(c, { n: 5, tone: 'bg', side: true }),
        ctaBand(c, { tone: 'dark' }),
      ],
    },
  ],
};
export default spec;

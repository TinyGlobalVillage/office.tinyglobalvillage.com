// Ref — a pale-green garden outfit: a big serif headline left with a small note right, a wide inset photo, square green buttons.
// Kept: headline left + note right · wide inset photo · quote panel (heading + line left, form right) ·
// services as big serif lines between hairlines + button · ragged three-photo gallery.
import {
  avatarsFor, bottom, button, cards, contact, CW, faq, group, image, PAD, pageTitle, photoBand, reviews, section, shape, stackDown,
  steps, team, text, tone, W, type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';

const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** Big headline on the left, a short note + button tucked right. */
function headlineNote(c: Ctx): Section {
  const t = tone(c, 'bg');
  const h = text(c, { slot: 'headline', x: PAD, y: 130, w: 700, size: 70, color: t.head, font: 'head', role: 'h1', lh: 1.04, name: 'Headline' });
  const note = text(c, { slot: 'subhead', x: 860, y: 0, w: 280, size: 16, color: t.body, name: 'Note' });
  const b = button(c, { href: '/contact', x: 860, y: 0 });
  const st = stackDown([note, b], Math.max(150, bottom(h) - 150), 22);
  return section([h, ...st.nodes], Math.max(bottom(h), st.y) + 70, t.bg);
}

/** Heading + line on the left, a drawn form on the right: labelled lines and a button. */
function quoteForm(c: Ctx): Section {
  const t = tone(c, 'surface');
  const h = text(c, { text: 'Ask for a free garden reading', x: PAD, y: 110, w: 420, size: 40, color: t.head, font: 'head', name: 'Heading' });
  const p = text(c, { slot: 'paragraph', x: PAD, y: bottom(h) + 18, w: 420, size: 16, color: t.body, name: 'Paragraph' });
  const fw = 520;
  const kids: Node[] = [];
  let y = 0;
  for (const label of ['Your name', 'Your burrow or bower', 'What should grow?']) {
    kids.push(text(c, { text: label, x: 0, y, w: fw, pct: 100, size: 13, color: t.muted, weight: 600, upper: true, track: 1.5, name: 'Label' }));
    kids.push(shape(c, { x: 0, y: y + 48, w: fw, pct: 100, h: 1, fill: c.pal.ink, name: 'Line' }));
    y += 82;
  }
  const b = button(c, { text: 'Send the request', href: '/contact', x: 0, y: y + 10 });
  kids.push(b);
  const form = group(c, { name: 'Form', x: W - PAD - fw, y: 110, w: fw, h: bottom(b), children: kids, flow: { gap: 30, pad: 0 } });
  return section([h, p, form], Math.max(bottom(p), bottom(form)) + 110, t.bg);
}

/** An eyebrow, then services as big serif lines with hairlines between, then a button. */
function serviceLines(c: Ctx): Section {
  const t = tone(c, 'bg');
  const nodes: Node[] = [text(c, { text: 'What we tend', x: PAD, y: 0, w: CW, size: 13, color: c.pal.accent, weight: 700, upper: true, track: 2.4, name: 'Eyebrow' })];
  const gaps: number[] = [24];
  for (let i = 0; i < 4; i++) {
    nodes.push(shape(c, { x: PAD, y: 0, w: CW, h: 1, fill: c.pal.line, name: 'Hairline' }));
    nodes.push(text(c, { slot: 'offering.title', x: PAD, y: 0, w: CW, size: 46, color: t.head, font: 'head', role: 'h3', lh: 1.15, name: 'Service' }));
    gaps.push(22, 22);
  }
  nodes.push(shape(c, { x: PAD, y: 0, w: CW, h: 1, fill: c.pal.line, name: 'Hairline' }));
  nodes.push(button(c, { slot: 'cta', href: '/services', x: PAD, y: 0, look: 'outline' }));
  gaps.push(40);
  const st = stackDown(nodes, 110, gaps);
  return section(st.nodes, st.y + 110, t.bg);
}

/** Three photos in a row at different heights, tops aligned, so the foot runs ragged. */
function raggedGallery(c: Ctx, photos: string[]): Section {
  const t = tone(c, 'bg');
  const gap = 24;
  const cw = (CW - gap * 2) / 3;
  const hs = [440, 340, 400];
  const pics = photos.map((p, i) => image(c, { key: p, x: 0, y: 0, w: cw, h: hs[i % 3], pct: 100 }));
  const g = group(c, { name: 'Gallery', x: PAD, y: 20, w: CW, h: Math.max(...hs), children: pics, layout: { cols: 3, bp: { tablet: 3, mobile: 1 }, gap } });
  return section([g], Math.max(...hs) + 120, t.bg);
}

const hero = '@garden|flowers';
const gallery = ['@garden|flowers#2', '@moss|nature', '@flowers|garden#3'];

const spec: TemplateSpec = {
  key: 'f15bf837',
  ref: 'f15bf837',
  name: 'Fernhollow Growers',
  industry: 'agency',
  category: 'Agency',
  description: 'A gnome garden guild in pale green: a big serif headline, a wide photo, services set as tall lines between hairlines.',
  palette: {
    bg: '#eef3e8', surface: '#e2ead9', ink: '#1d2a1c', body: '#4a5947', muted: '#768472',
    accent: '#24432a', accentInk: '#ffffff', dark: '#1f3523', darkInk: '#f2f6ec', darkBody: 'rgba(242,246,236,0.8)', darkAccent: '#cfe3b8',
    line: '#c9d5c0',
  },
  fonts: { head: serif, body: sans, headWeight: 400, headTrack: -0.5, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'wordmark left, links centred, square green CTA right', footer: 'dark green: wordmark, address, link columns, fine print' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        headlineNote(c),
        photoBand(c, { photo: hero, tone: 'bg', h: 540, radius: 0 }),
        quoteForm(c),
        serviceLines(c),
        raggedGallery(c, gallery),
      ],
    },
    {
      slug: 'services',
      title: 'Services',
      build: (c) => [
        pageTitle(c, { title: 'What we tend', tone: 'surface', align: 'left', intro: true }),
        cards(c, { n: 4, cols: 2, kind: 'photo', photos: gallery, tone: 'bg', head: false, price: true }),
        steps(c, { n: 3, tone: 'surface', head: { heading: 'From seed to bloom' } }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'Hands in the soil', tone: 'dark', photo: hero }),
        team(c, { n: 4, avatars: avatarsFor(c.site, 9), tone: 'bg', head: { heading: 'The growers' } }),
        reviews(c, { n: 3, tone: 'surface', big: true }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', photo: gallery[1], heading: 'Come by the potting shed' }), quoteForm(c), faq(c, { n: 4, tone: 'bg' })],
    },
  ],
};
export default spec;

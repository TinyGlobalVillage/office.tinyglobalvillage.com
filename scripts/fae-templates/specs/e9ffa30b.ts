// Ref — a one-screen personal card on light grey: a big round portrait left, a huge "hello", a short bio and
// three coloured circle buttons; a four-column footer of phone / e-mail / follow / fine print.
// Kept: round portrait + giant greeting + bio + three circle buttons · resumé (numbered roles, numbers) ·
// projects wall · contact.
import { avatarsFor, bottom, button, cards, contact, group, image, pageTitle, reviews, section, stats, text, tone, type Ctx, type Node, type Section, type TemplateSpec } from '../kit.ts';

const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const DOTS: Array<[string, string, string]> = [
  ['Resumé', '/resume', '#f0a30a'],
  ['Projects', '/projects', '#ff3d24'],
  ['Contact', '/contact', '#80d8dc'],
];

/** The greeting card: round portrait left; greeting, a small heading, the bio and three circle buttons right. */
function hello(c: Ctx, avatar: string): Section {
  const t = tone(c, 'bg');
  const H = 620;
  const d = 320;
  const pic = image(c, { key: avatar, x: 180, y: (H - d) / 2, w: d, h: d, circle: true, alt: 'Portrait' });
  const hi = text(c, { text: 'Well met', x: 560, y: 150, w: 520, size: 84, color: t.head, font: 'head', weight: 800, role: 'h1', lh: 1.05, name: 'Greeting' });
  const sub = text(c, { text: 'A little about me', x: 564, y: bottom(hi) + 18, w: 400, size: 20, color: t.head, font: 'head', weight: 700, role: 'h2', name: 'Heading' });
  const bio = text(c, { slot: 'about', x: 564, y: bottom(sub) + 8, w: 300, size: 14, color: t.body, name: 'Bio' });
  const dots: Node[] = DOTS.map(([label, href, fill], i) => {
    const b = button(c, { text: label, href, x: i * 98, y: 0, w: 88, look: 'outline', size: 14 });
    b.box.desktop.h = 88;
    const col = (b.style as { color: Record<string, unknown> }).color;
    col.fill = fill;
    col.border = 'rgba(0,0,0,0.45)';
    col.text = '#111111';
    col.borderRadius = 44;
    (b.style as Record<string, unknown>).padding = { top: 0, right: 0, bottom: 0, left: 0 };
    return b;
  });
  const row = group(c, { name: 'Circle buttons', x: 564, y: bottom(bio) + 24, w: 284, h: 88, children: dots });
  return section([pic, hi, sub, bio, row], Math.max(H, bottom(row) + 90), t.bg);
}

const spec: TemplateSpec = {
  key: 'e9ffa30b',
  ref: 'e9ffa30b',
  name: 'Hollyhock Hello',
  industry: 'blog',
  category: 'Blog',
  description: 'A fae editor’s calling card: one round portrait, a giant greeting and three bright circle buttons.',
  palette: { bg: '#f3f3f3', surface: '#ffffff', ink: '#0d0d0d', body: '#3a3a3a', muted: '#707070', accent: '#f0a30a', accentInk: '#111111', dark: '#111111', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', darkAccent: '#80d8dc', line: 'rgba(13,13,13,0.14)' },
  fonts: { head: sans, body: sans, headWeight: 700, headTrack: -0.5, btnRadius: 999, cardRadius: 0 },
  chrome: { nav: 'dot + name + small title left, links right split by thin bars', footer: 'hairline, four columns: phone · e-mail · follow · fine print' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [hello(c, avatarsFor(c.site, 0)[0])],
    },
    {
      slug: 'resume',
      title: 'Resumé',
      build: (c) => [
        pageTitle(c, { title: 'Resumé', tone: 'bg', align: 'left' }),
        cards(c, { n: 4, cols: 2, kind: 'numbered', tone: 'surface', head: { heading: 'Where I have worked', align: 'left' }, titleSlot: 'person.role', bodySlot: 'paragraph' }),
        stats(c, { n: 3, tone: 'bg' }),
      ],
    },
    {
      slug: 'projects',
      title: 'Projects',
      build: (c) => [
        pageTitle(c, { title: 'Projects', tone: 'bg', align: 'left' }),
        cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'bg', photos: ['@books', '@study', '@library'], head: false, titleSlot: 'post.title', bodySlot: 'post.excerpt', cardFill: false, imgH: 240 }),
        reviews(c, { n: 2, tone: 'surface', avatars: avatarsFor(c.site, 3), head: { heading: 'What collaborators say' } }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Send word' })],
    },
  ],
};
export default spec;

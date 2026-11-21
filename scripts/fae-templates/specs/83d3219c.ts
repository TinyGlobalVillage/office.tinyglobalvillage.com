// Ref — an all-black design studio: a short intro over a huge left headline, an email tucked right, lilac work tiles.
// Kept: intro + big left headline + email corner · 2×2 work tiles with captions · one long statement line ·
// a wide rounded picture band · closing words + white pill button.
import {
  avatarsFor, bottom, contact, ctaBand, CW, group, imageStory, PAD, pageTitle, photoBand, reviews, section, shape,
  splitHeading, stackDown, stats, team, text, tone, W, type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';

const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** A small intro line over a huge headline on the left; the studio's email low on the right. */
function introHero(c: Ctx): Section {
  const t = tone(c, 'bg');
  const intro = text(c, { slot: 'subhead', x: PAD + 40, y: 0, w: 440, size: 18, color: t.ink, name: 'Intro' });
  const head = text(c, { slot: 'headline', x: PAD + 40, y: 0, w: 720, size: 76, color: t.head, font: 'head', role: 'h1', lh: 1.05, name: 'Headline' });
  const st = stackDown([intro, head], 120, 30);
  const mail = text(c, { slot: 'email', index: 0, x: W - PAD - 340, y: st.y - 56, w: 300, size: 15, color: t.ink, align: 'right', name: 'Email' });
  const hint = text(c, { text: 'Drift down to wander ↓', x: W - PAD - 340, y: bottom(mail) + 2, w: 300, size: 14, color: t.muted, align: 'right', name: 'Hint' });
  return section([...st.nodes, mail, hint], st.y + 90, t.bg);
}

/** Lilac work tiles, each with a drawn screen inside and a caption under it. */
function workTiles(c: Ctx, n = 4): Section {
  const t = tone(c, 'bg');
  const gap = 28;
  const cellW = (CW - gap - 80) / 2;
  const tileH = 360;
  const items: Node[] = [];
  for (let i = 0; i < n; i++) {
    const kids: Node[] = [
      shape(c, { x: 0, y: 0, w: cellW, pct: 100, h: tileH, fill: c.pal.accent, radius: 16, name: 'Tile' }),
      shape(c, { x: 40, y: 48, w: cellW * 0.62, pct: 62, h: tileH - 96, fill: '#15151c', radius: 14, name: 'Screen' }),
    ];
    [36, 48, 28].forEach((p, k) =>
      kids.push(shape(c, { x: 64, y: 84 + k * 34, w: cellW * (p / 100), pct: p, h: 12, fill: k === 0 ? c.pal.accent : 'rgba(255,255,255,0.18)', radius: 6, name: 'Line' })),
    );
    kids.push(shape(c, { x: 64, y: tileH - 120, w: 48, h: 48, fill: ['#6f5cff', '#2fd3a0', '#ff8a5c', '#f5c84c'][i % 4], radius: 24, name: 'Dot' }));
    kids.push(text(c, { slot: 'offering.title', x: 0, y: tileH + 16, w: cellW, pct: 100, size: 15, color: t.ink, name: 'Caption' }));
    items.push(group(c, { name: `Work ${i + 1}`, x: 0, y: 0, w: cellW, h: tileH + 52, children: kids }));
  }
  const rows = Math.ceil(n / 2);
  const gh = rows * (tileH + 52) + (rows - 1) * gap;
  const grid = group(c, { name: 'Work', x: PAD + 40, y: 30, w: CW - 80, h: gh, children: items, layout: { cols: 2, bp: { tablet: 2, mobile: 1 }, gap } });
  return section([grid], gh + 110, t.bg);
}

/** One long statement, left-aligned, no heading. */
function statement(c: Ctx): Section {
  const t = tone(c, 'bg');
  const p = text(c, { slot: 'about', x: PAD + 40, y: 90, w: CW - 80, size: 26, color: t.ink, lh: 1.45, name: 'Statement' });
  return section([p], bottom(p) + 90, t.bg);
}

const spec: TemplateSpec = {
  key: '83d3219c',
  ref: '83d3219c',
  name: 'Moonmoth Studio',
  industry: 'agency',
  category: 'Agency',
  description: 'A faerie design studio in pure night: a huge left headline, lilac work tiles, one quiet statement.',
  palette: {
    bg: '#000000', surface: '#111114', ink: '#ffffff', body: 'rgba(255,255,255,0.78)', muted: 'rgba(255,255,255,0.5)',
    accent: '#cbc4fc', accentInk: '#111114', dark: '#000000', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', darkAccent: '#cbc4fc',
    line: 'rgba(255,255,255,0.12)',
  },
  fonts: { head: sans, body: sans, headWeight: 500, headTrack: -1.5, btnRadius: 999, cardRadius: 16 },
  chrome: { nav: 'small wordmark left, three links right, white pill CTA', footer: 'black: closing line + button left, two link columns right' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        introHero(c),
        workTiles(c, 4),
        statement(c),
        photoBand(c, { photo: '@mist|forest', tone: 'bg', h: 440, radius: 16 }),
        ctaBand(c, { tone: 'dark', split: true }),
      ],
    },
    {
      slug: 'work',
      title: 'Work',
      build: (c) => [
        pageTitle(c, { title: 'Work', tone: 'bg', align: 'left' }),
        workTiles(c, 6),
        reviews(c, { n: 3, tone: 'surface', head: false }),
      ],
    },
    {
      slug: 'studio',
      title: 'Studio',
      build: (c) => [
        pageTitle(c, { title: 'The studio', tone: 'bg', align: 'left' }),
        imageStory(c, { photo: '@books|study', side: 'left', tone: 'surface' }),
        stats(c, { n: 4, tone: 'bg' }),
        team(c, { n: 3, avatars: avatarsFor(c.site, 5), tone: 'bg', ring: '#cbc4fc', head: { heading: 'Who keeps the lamps lit' } }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Leave word at the window' }), splitHeading(c, { tone: 'surface', button: false })],
    },
  ],
};
export default spec;

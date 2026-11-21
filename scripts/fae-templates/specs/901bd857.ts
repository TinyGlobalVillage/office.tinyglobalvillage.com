// Ref — an airy travel outfit: a big photo hero with centred serif words, warm story band, thin outline buttons.
// Kept: centred photo hero + one button · centred story on a warm band + outline button · "what makes us special"
// three unboxed icon cards · a dark film band with a play mark · a strip of three photos.
import {
  avatarsFor, cards, centered, contact, faq, group, hero, image, imageStory, pageTitle, posts, reviews, section,
  shape, stackDown, steps, team, text, tone, W, type Ctx, type Node, type Section, type TemplateSpec,
} from '../kit.ts';

const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** A dark band standing in for a film: a round play mark over a centred heading and line. */
function filmBand(c: Ctx): Section {
  const t = tone(c, 'dark');
  const d = 96;
  const play = group(c, {
    name: 'Play', x: (W - d) / 2, y: 0, w: d, h: d,
    children: [
      shape(c, { x: 0, y: 0, w: d, h: d, fill: 'rgba(255,255,255,0)', border: 'rgba(255,255,255,0.8)', radius: d / 2, name: 'Play ring' }),
      text(c, { text: '▶', x: 6, y: 26, w: d, size: 34, color: '#ffffff', align: 'center', lh: 1.2, name: 'Play glyph' }),
    ],
  });
  const h = text(c, { text: 'Watch the trail unwind', x: 200, y: 0, w: 800, size: 44, color: t.head, font: 'head', align: 'center', name: 'Heading' });
  const p = text(c, { slot: 'subhead', x: 300, y: 0, w: 600, size: 17, color: t.body, align: 'center', name: 'Paragraph' });
  const st = stackDown([play, h, p], 130, [30, 16]);
  return section(st.nodes, st.y + 130, t.bg);
}

/** Three photos edge to edge, no words. */
function photoStrip(c: Ctx, photos: string[]): Section {
  const t = tone(c, 'bg');
  const gap = 12;
  const cw = (W - gap * 2) / 3;
  const ph = 420;
  const pics: Node[] = photos.map((p) => image(c, { key: p, x: 0, y: 0, w: cw, h: ph, pct: 100 }));
  const g = group(c, { name: 'Strip', x: 0, y: 0, w: W, h: ph, children: pics, layout: { cols: 3, bp: { tablet: 3, mobile: 1 }, gap } });
  return section([g], ph, t.bg);
}

const strip = ['@landscape|nature', '@water|sky', '@forest|mist'];

const spec: TemplateSpec = {
  key: '901bd857',
  ref: '901bd857',
  name: 'Wayfern Wanderers',
  industry: 'agency',
  category: 'Agency',
  description: 'A wandering-elf guide house: a wide photo hero, a warm story, a film band and a strip of far places.',
  palette: {
    bg: '#ffffff', surface: '#f4eee6', ink: '#1e1c19', body: '#57524b', muted: '#8b847a',
    accent: '#1e1c19', accentInk: '#ffffff', dark: '#22201d', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', darkAccent: '#ffffff',
    line: '#e6ded3',
  },
  fonts: { head: serif, body: sans, headWeight: 400, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'wordmark left, links right, outline CTA, over the hero photo', footer: 'white: wordmark, columns of trails and links, socials' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'photo-center', photo: '@mist|landscape', h: 720, overlay: 'rgba(20,18,14,0.36)' }),
        centered(c, { tone: 'surface', eyebrow: true, slot: 'about', button: true }),
        cards(c, { n: 3, cols: 3, kind: 'icon', tone: 'bg', cardFill: false, head: { heading: 'What makes a fern-trail special' } }),
        filmBand(c),
        photoStrip(c, strip),
      ],
    },
    {
      slug: 'trails',
      title: 'Trails',
      build: (c) => [
        pageTitle(c, { title: 'Trails we walk', tone: 'surface', photo: '@mist|landscape' }),
        posts(c, { n: 3, photos: strip, tone: 'bg', head: false }),
        steps(c, { n: 3, tone: 'surface', head: { heading: 'How a wander begins' } }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'The wander-folk', tone: 'surface' }),
        imageStory(c, { photo: '@water|sky', side: 'left', tone: 'bg' }),
        team(c, { n: 4, avatars: avatarsFor(c.site, 7), tone: 'surface', head: { heading: 'Your trail guides' } }),
        reviews(c, { n: 3, tone: 'bg' }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', photo: '@forest|mist', heading: 'Ask about a trail' }), faq(c, { n: 5, tone: 'surface' })],
    },
  ],
};
export default spec;

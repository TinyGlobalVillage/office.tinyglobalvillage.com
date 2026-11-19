// Ref — a calm wild-places cause: landscape photo hero with the words low-left, a grey statement band,
// two alternating picture rows with navy buttons, a quote over a full-bleed green photo, a sign-up split.
// Kept: photo hero (one white button) · grey split statement · picture right / picture left story rows ·
// centred quote on a photo band · heading-left / e-mail sign-up right.
import { PAD, avatarsFor, bottom, button, cards, contact, ctaBand, group, hero, imageStory, pageTitle, section, shape, splitHeading, stackDown, stats, team, text, tone, wash, type Ctx, type Node, type Section, type TemplateSpec } from '../kit.ts';

const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** A single big quote, centred, over a full-bleed photo. */
function quoteBand(c: Ctx, photo: string): Section {
  const ov = 'rgba(14,30,18,0.5)';
  const st = stackDown([
    text(c, { slot: 'review.quote', index: 0, x: 200, y: 0, w: 800, size: 30, color: '#ffffff', font: 'head', align: 'center', lh: 1.35, name: 'Quote' }),
    text(c, { slot: 'review.author', index: 0, x: 300, y: 0, w: 600, size: 15, color: 'rgba(255,255,255,0.8)', align: 'center', name: 'Source' }),
  ], 130, 24);
  return section(st.nodes, st.y + 130, wash(ov), 'banner-image-atomic', { bgPin: { src: c.photo(photo), paintFrame: true, pinned: false, overlay: ov } });
}

/** Heading on the left; a line of words, an e-mail field and a button on the right. */
function signUp(c: Ctx): Section {
  const t = tone(c, 'bg');
  const head = text(c, { text: 'Walk the wild paths with us, out under the real sky', x: PAD + 45, y: 90, w: 420, size: 30, color: t.head, font: 'head', name: 'Heading' });
  const para = text(c, { slot: 'newsletter', x: 650, y: 94, w: 440, size: 15, color: t.body, name: 'Paragraph' });
  const fy = bottom(para) + 22;
  const field = group(c, { name: 'E-mail field', x: 650, y: fy, w: 300, h: 50, children: [
    shape(c, { x: 0, y: 0, w: 300, h: 50, fill: '#ffffff', border: t.line, name: 'Field' }),
    text(c, { text: 'Your owl-post address', x: 18, y: 14, w: 260, size: 13, color: t.muted, name: 'Placeholder' }),
  ] });
  const b = button(c, { text: 'Sign up', href: '/contact', x: 958, y: fy, w: 132, look: 'solid', size: 14 });
  return section([head, para, field, b], Math.max(bottom(head), bottom(b)) + 90, t.bg);
}

const spec: TemplateSpec = {
  key: '1f99d107',
  ref: '1f99d107',
  name: 'Wildroot Watch',
  industry: 'blog',
  category: 'Blog',
  description: 'A co-op of elf, faerie and gnome walkers keeping a journal of wild places: a misty hillside hero, two walking stories, a quote over the green.',
  palette: { bg: '#ffffff', surface: '#e4e4df', ink: '#141414', body: '#3f4140', muted: '#7b7d7a', accent: '#243453', accentInk: '#ffffff', dark: '#1d2a22', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#cfe0c4', line: 'rgba(20,20,20,0.14)' },
  fonts: { head: sans, body: sans, headWeight: 500, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'brand-left, links right, socials, boxed white CTA — transparent over the hero', footer: 'white, brand + links in one row' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'photo-left', photo: '@forest|nature', h: 520, buttons: 1, overlay: 'rgba(10,20,14,0.3)', headSize: 46 }),
        splitHeading(c, { tone: 'surface', button: false }),
        imageStory(c, { photo: '@mist', side: 'right', tone: 'bg', button: true, h: 560 }),
        imageStory(c, { photo: '@moss|nature', side: 'left', tone: 'bg', button: true, h: 560 }),
        quoteBand(c, '@forest#2'),
        signUp(c),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'Why we walk', photo: '@forest|nature', align: 'left' }),
        splitHeading(c, { tone: 'bg', paras: 2, button: false }),
        stats(c, { n: 4, tone: 'surface' }),
        team(c, { n: 4, avatars: avatarsFor(c.site, 2), tone: 'bg', head: { heading: 'The path-keepers' } }),
      ],
    },
    {
      slug: 'initiatives',
      title: 'Initiatives',
      build: (c) => [
        pageTitle(c, { title: 'What we tend', tone: 'surface', align: 'left' }),
        cards(c, { n: 6, cols: 3, kind: 'numbered', tone: 'bg', head: false, titleSlot: 'post.title', bodySlot: 'post.excerpt', link: '/initiatives' }),
        ctaBand(c, { tone: 'accent', split: true }),
      ],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', photo: '@mist', heading: 'Find the trailhead' })],
    },
  ],
};
export default spec;

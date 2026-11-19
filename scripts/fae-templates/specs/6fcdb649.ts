// Ref — a one-screen "opening soon" page for a fashion label: a full-bleed moody photo, a small wordmark, a big
// line, a short note, an email field with a ghost button, and a row of social marks.
// Kept: full-screen photo · wordmark · headline + note · email signup row · social marks.
import {
  W, avatarsFor, button, contact, group, imageStory, pageTitle, section, shape, splitHeading, stackDown, team, text, wash, zigzag,
  type Ctx, type Section, type TemplateSpec,
} from '../kit.ts';

const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const helv = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** The whole opening screen: photo behind, everything centred. */
function soon(ctx: Ctx, photo: string): Section {
  const cw = 560;
  const cx = (W - cw) / 2;
  const mark = text(ctx, { slot: 'brand', x: cx, y: 0, w: cw, size: 15, color: '#ffffff', weight: 600, upper: true, track: 6, align: 'center', name: 'Wordmark' });
  const head = text(ctx, { text: 'The moonsilk looms are nearly ready', x: cx - 60, y: 0, w: cw + 120, size: 56, color: '#ffffff', font: 'head', align: 'center', lh: 1.1, role: 'h1', name: 'Headline' });
  const note = text(ctx, { slot: 'subhead', x: cx, y: 0, w: cw, size: 17, color: 'rgba(255,255,255,0.86)', align: 'center', name: 'Note' });
  const field = group(ctx, {
    name: 'Email field', x: cx, y: 0, w: cw, h: 52,
    children: [
      shape(ctx, { x: 0, y: 0, w: cw, h: 52, pct: 100, fill: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.7)', name: 'Field' }),
      text(ctx, { text: 'Your name, for the owl…', x: 20, y: 15, w: cw - 40, pct: 90, size: 15, color: 'rgba(255,255,255,0.7)', lh: 1.3, name: 'Placeholder' }),
    ],
  });
  const btn = button(ctx, { text: 'Send me word', href: '/contact', x: 0, y: 0, look: 'ghost-light' });
  btn.box.desktop.x = Math.round((W - btn.box.desktop.w) / 2);
  const socials = text(ctx, { text: '✦      ❦      ☾      ✿', x: cx, y: 0, w: cw, size: 18, color: '#ffffff', align: 'center', name: 'Socials' });
  const st = stackDown([mark, head, note, field, btn, socials], 150, [70, 22, 40, 16, 60]);
  const ov = 'rgba(12,12,14,0.5)';
  return section(st.nodes, Math.max(760, st.y + 150), wash(ov), 'banner-image-atomic', { bgPin: { src: ctx.photo(photo), paintFrame: true, pinned: false, overlay: ov } });
}

const spec: TemplateSpec = {
  key: '6fcdb649', ref: '6fcdb649', name: 'Moonloom Atelier', industry: 'fashion', category: 'Fashion',
  description: 'An elven atelier still behind its curtain: one hushed full-screen photo, a whispered promise and a place to leave your name.',
  palette: { bg: '#ffffff', surface: '#f3f1ee', ink: '#151515', body: '#4d4d4d', muted: '#8a8a8a', accent: '#151515', accentInk: '#ffffff', dark: '#121214', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#ffffff', line: 'rgba(0,0,0,0.12)' },
  fonts: { head: serif, body: helv, headWeight: 400, headTrack: -0.5, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'none on the opening screen; inner pages: wordmark left, small caps links right', footer: 'a single thin line of social marks' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [soon(c, '@mist|forest')] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'Behind the curtain', tone: 'bg' }),
      splitHeading(c, { tone: 'bg', paras: 2 }),
      team(c, { n: 3, avatars: avatarsFor(c.site, 0), tone: 'surface', bio: true }),
    ] },
    { slug: 'lookbook', title: 'Lookbook', build: (c) => [
      pageTitle(c, { title: 'First glimpses', tone: 'dark' }),
      zigzag(c, { rows: [{ photo: '@fabric' }, { photo: '@fabric#2' }], tone: 'bg' }),
      imageStory(c, { photo: '@studio|art', side: 'right', tone: 'dark', heading: 'Stitched by starlight' }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'surface' })] },
  ],
};
export default spec;


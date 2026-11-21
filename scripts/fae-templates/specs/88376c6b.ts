// Ref — a design studio in charcoal and orange: hero photo with a dark text card on its right, a pale strip of
// three arrowed points, a diagonal white section (arched picture + eyebrow + orange heading + bullets + button),
// a dark band of three photo service tiles, a "trusted by" wordmark row, one closing button.
// Kept: split hero on charcoal · three-point strip · picture-and-bullets row · dark photo service cards · wordmarks · CTA.
import { avatarsFor, cards, chartPanel, contact, copy, ctaBand, group, hero, logos, pageTitle, posts, pricing, section, splitHeading, stats, team, text, tone, zigzag, PAD, CW, type Ctx, type Section, type TemplateSpec } from '../kit.ts';
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** A pale strip of three short points, each led by an arrow. */
function pointStrip(c: Ctx): Section {
  const t = tone(c, 'surface');
  const gap = 24;
  const cellW = (CW - gap * 2) / 3;
  const pts = [0, 1, 2].map(() => text(c, { text: `▶  ${copy(c, 'offering.title').text}`, x: 0, y: 0, w: cellW, pct: 100, size: 15, color: t.ink, weight: 700, align: 'center', name: 'Point' }));
  const ph = Math.max(...pts.map((p) => p.box.desktop.h));
  const g = group(c, { name: 'Points', x: PAD, y: 34, w: CW, h: ph, children: pts, layout: { cols: 3, bp: { tablet: 3, mobile: 1 }, gap } });
  return section([g], ph + 68, t.bg);
}

const spec: TemplateSpec = {
  key: '88376c6b', ref: '88376c6b', name: 'Cinder & Quill', industry: 'agency', category: 'Agency',
  description: 'A gnome design forge in charcoal and ember orange: split hero, three quick promises, dark picture tiles, a row of neighbours.',
  palette: { bg: '#ffffff', surface: '#f2f2f2', ink: '#222222', body: '#4b4b4b', muted: '#7a7a7a', accent: '#ff5f1f', accentInk: '#ffffff', dark: '#2e2e2e', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#ff8a55', line: 'rgba(34,34,34,0.12)' },
  fonts: { head: sans, body: sans, headWeight: 700, headTrack: -0.3, btnRadius: 4, cardRadius: 0 },
  chrome: { nav: 'charcoal: spaced wordmark left with an orange dot, small links right, orange CTA', footer: 'charcoal, wordmark, three columns, orange rule' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'split', tone: 'dark', photo: '@desk|study|books', buttons: 1, h: 600, imageRadius: 0 }),
      pointStrip(c),
      zigzag(c, { rows: [{ art: chartPanel({ card: '#ffffff', ink: '#222222', muted: '#7a7a7a', bar: '#ff5f1f', bar2: '#ffd6c4', line: '#ececec', radius: 0 }), bullets: 4, pill: true }], tone: 'bg', startRight: true }),
      cards(c, { n: 3, cols: 3, kind: 'photo', tone: 'dark', cardFill: false, photos: ['@workshop|library', '@art|craft|light', '@craft|warm|candle'], head: { heading: 'Fine work, fair acorns' }, imgH: 300, align: 'center' }),
      logos(c, { tone: 'bg', label: 'Trusted by burrows you know', seeds: ['cinder-a', 'cinder-b', 'cinder-c', 'cinder-d'], n: 4 }),
      ctaBand(c, { tone: 'bg' }),
    ] },
    { slug: 'services', title: 'Services', build: (c) => [
      pageTitle(c, { title: 'Services', tone: 'dark' }),
      cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'bg', head: false, align: 'left' }),
      pricing(c, { n: 3, tone: 'surface' }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About the forge', tone: 'surface' }),
      splitHeading(c, { tone: 'bg', paras: 2 }),
      stats(c, { n: 4, tone: 'dark' }),
      team(c, { n: 4, avatars: avatarsFor(c.site), tone: 'bg', head: { heading: 'The forge hands' } }),
    ] },
    { slug: 'blog', title: 'Blog', build: (c) => [
      pageTitle(c, { title: 'From the forge', tone: 'surface' }),
      posts(c, { n: 3, photos: ['@workshop|library', '@art|craft|light', '@desk|study|books'], tone: 'bg', head: false }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg' })] },
  ],
};
export default spec;

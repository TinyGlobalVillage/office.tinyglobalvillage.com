// Ref — a marketing conference in black, signal red and mint: a split hero (words on pale grey, black linework
// art right), black title bands between sections, a crowd photo with a paragraph, a full grid of speakers,
// a dark photo band for last year's highlights.
// Kept: split hero with art panel · black title band · photo + paragraph story · black title band · speaker grid · photo CTA band.
import { avatarsFor, cards, chartPanel, contact, ctaBand, faq, hero, imageStory, pageTitle, pricing, section, team, text, tone, PAD, CW, type Ctx, type Section, type TemplateSpec } from '../kit.ts';
const sans = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

/** A slim black band holding one tracked-capital title (the ref's section labels). */
function titleBand(c: Ctx, heading: string): Section {
  const t = tone(c, 'dark');
  const h = text(c, { text: heading, x: PAD + 30, y: 64, w: CW - 60, size: 26, color: t.ink, font: 'head', weight: 400, upper: true, track: 2.4, role: 'h2', name: 'Title' });
  return section([h], h.box.desktop.h + 128, t.bg);
}

const spec: TemplateSpec = {
  key: 'b6d4d638', ref: 'b6d4d638', name: 'Glimmerfair Summit', industry: 'agency', category: 'Agency',
  description: 'A herald-guild gathering in black, ember red and mint: split hero with linework art, title bands, a wall of speakers.',
  palette: { bg: '#ecebe9', surface: '#ffffff', ink: '#111111', body: '#3d3d3d', muted: '#6f6f6f', accent: '#f2381f', accentInk: '#ffffff', dark: '#000000', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', darkAccent: '#a9d8cc', line: 'rgba(17,17,17,0.14)' },
  fonts: { head: sans, body: sans, headWeight: 600, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'black bar: brand left, three spaced capital links; under it a boxed strip — tickets, socials, date', footer: 'black, brand + socials + fine print' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'split-art', tone: 'bg', buttons: 1, eyebrow: 'Third gathering · first frost', h: 620, art: chartPanel({ card: '#000000', ink: '#ffffff', muted: 'rgba(255,255,255,0.6)', bar: '#f2381f', bar2: '#a9d8cc', line: 'rgba(255,255,255,0.18)', radius: 0, dark: true }) }),
      titleBand(c, 'The third gathering'),
      imageStory(c, { photo: '@stage|light|warm', side: 'left', tone: 'bg', inset: false, h: 560 }),
      titleBand(c, 'Voices on the stage'),
      team(c, { n: 8, avatars: avatarsFor(c.site, 5), tone: 'dark', head: false }),
      ctaBand(c, { tone: 'dark', photo: '@stage#2|candle|light' }),
    ] },
    { slug: 'speakers', title: 'Speakers', build: (c) => [
      pageTitle(c, { title: 'Speakers', tone: 'dark', align: 'left' }),
      team(c, { n: 8, avatars: avatarsFor(c.site, 5), tone: 'bg', bio: true, head: false }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About the gathering', tone: 'bg', align: 'left' }),
      cards(c, { n: 4, cols: 2, kind: 'numbered', tone: 'surface', head: { heading: 'The day, hour by hour', align: 'left' } }),
      pricing(c, { n: 3, tone: 'bg', head: { heading: 'Tickets' } }),
      faq(c, { n: 5, tone: 'surface' }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg', heading: 'Find the gathering' })] },
  ],
};
export default spec;

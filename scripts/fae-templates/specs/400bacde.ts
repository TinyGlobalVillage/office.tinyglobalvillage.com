// Ref — a calm, grey-and-white fashion house: a split hero (words left, tall photo right) on pale grey, a bestsellers
// heading-with-button over four products with "from" prices, a photo story with the words on the right, and a
// two-photo collage (small beside big) with a caption.
// Kept: split hero · bestsellers row · photo story · small + big photo collage.
import {
  PAD, avatarsFor, bottom, button, contact, hero, image, imageStory, pageTitle, section, splitHeading, stackDown, stackLast, stats, team, text, tone,
  type Ctx, type Section, type TemplateSpec,
} from '../kit.ts';
import { circleRow, shelf } from './91242216.ts';

const serif2 = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const helv = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** A small photo beside a big one, with a few words under the small one. */
function collage(ctx: Ctx, small: string, big: string): Section {
  const t = tone(ctx, 'bg');
  const a = image(ctx, { key: small, x: PAD, y: 90, w: 380, h: 470 });
  const words = stackDown([
    text(ctx, { text: 'Cut for long evenings', x: PAD, y: 0, w: 380, size: 28, color: t.head, font: 'head', role: 'h2', name: 'Heading' }),
    text(ctx, { slot: 'caption', x: PAD, y: 0, w: 380, size: 15, color: t.body, name: 'Caption' }),
    button(ctx, { slot: 'cta', href: '/collections', x: PAD, y: 0, look: 'outline' }),
  ], bottom(a) + 28, [10, 22]);
  const b = image(ctx, { key: big, x: 500, y: 90, w: 640, h: 760 });
  return section([...stackLast([a], 40), ...words.nodes, ...stackLast([b], 60)], Math.max(words.y, bottom(b)) + 90, t.bg);
}

const spec: TemplateSpec = {
  key: '400bacde', ref: '400bacde', name: 'Willowmere House', industry: 'fashion', category: 'Fashion',
  description: 'An unhurried elven fashion house in pale grey: a tall photo beside its words, a short row of favourites and a gallery-like collage.',
  palette: { bg: '#ffffff', surface: '#f1f1ef', ink: '#1c1c1c', body: '#4e4e4e', muted: '#8d8d8d', accent: '#1c1c1c', accentInk: '#ffffff', dark: '#22221f', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#e8e2d6', line: 'rgba(0,0,0,0.1)' },
  fonts: { head: serif2, body: helv, headWeight: 400, headTrack: -0.3, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'wordmark left, links centre, search/bag right on white', footer: 'pale grey, newsletter left + link columns right' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'split', tone: 'surface', photo: '@fabric|studio', h: 640, buttons: 1, imageRadius: 0, headSize: 52 }),
      shelf(c, { n: 4, cols: 4, tone: 'bg', head: { heading: 'Most asked for', button: 'Shop all' }, tiles: ['#ecebe8'], tileH: 380, variant: true }),
      imageStory(c, { photo: '@forest|mist', side: 'left', tone: 'surface', button: true, heading: 'Woven where the willows lean' }),
      collage(c, '@craft|jewelry', '@landscape|nature'),
    ] },
    { slug: 'collections', title: 'Collections', build: (c) => [
      pageTitle(c, { title: 'Collections', tone: 'surface', align: 'left' }),
      circleRow(c, { n: 5, tone: 'bg', fills: ['#f1f1ef'], ink: '#1c1c1c', labels: ['Gowns', 'Cloaks', 'Veils', 'Boots', 'Capes'], d: 96 }),
      shelf(c, { n: 8, cols: 4, tone: 'bg', head: false, tiles: ['#ecebe8'], tileH: 380, variant: true }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'The house by the mere', tone: 'bg', intro: true }),
      splitHeading(c, { tone: 'surface', paras: 2 }),
      team(c, { n: 4, avatars: avatarsFor(c.site, 0), tone: 'bg' }),
      stats(c, { n: 3, tone: 'dark' }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'surface' })] },
  ],
};
export default spec;

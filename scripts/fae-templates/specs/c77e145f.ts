// Ref — a quiet, white fashion label: a full photo hero with a tiny caps line and a bold tracked headline, a grey
// band with one centred paragraph, a centred "collections" heading, then large photos alternating with text.
// Kept: photo-centre hero · grey statement band · centred heading · alternating photo rows.
import { avatarsFor, centered, contact, hero, logos, pageTitle, reviews, stats, zigzag, type TemplateSpec } from '../kit.ts';
import { shelf } from './91242216.ts';

const helv = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const spec: TemplateSpec = {
  key: 'c77e145f', ref: 'c77e145f', name: 'Ashleaf & Vale', industry: 'fashion', category: 'Fashion',
  description: 'A spare elven label that lets the cloth speak: one wide photo, one quiet sentence on grey, then the collections in alternating rows.',
  palette: { bg: '#ffffff', surface: '#eeeeee', ink: '#111111', body: '#4a4a4a', muted: '#8c8c8c', accent: '#111111', accentInk: '#ffffff', dark: '#111111', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#ffffff', line: 'rgba(0,0,0,0.12)' },
  fonts: { head: helv, body: helv, headWeight: 700, headTrack: 3, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'bold tracked wordmark centred, small caps links in a row beneath', footer: 'white, centred socials + one line' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-center', photo: '@fabric|studio', h: 640, eyebrow: 'Spring under the ash', buttons: 1, overlay: 'rgba(0,0,0,0.5)', headSize: 50 }),
      centered(c, { tone: 'surface', slot: 'about', size: 22 }),
      centered(c, { tone: 'bg', heading: 'The collections', eyebrow: 'Woven this year', button: false }),
      zigzag(c, { rows: [{ photo: '@forest|landscape' }, { photo: '@craft|jewelry', pill: true }], tone: 'bg', startRight: false }),
    ] },
    { slug: 'collections', title: 'Collections', build: (c) => [
      pageTitle(c, { title: 'Collections', tone: 'bg' }),
      shelf(c, { n: 6, cols: 3, tone: 'bg', head: false, tiles: ['#eeeeee', '#e6e3df'], tileH: 440, align: 'center' }),
      centered(c, { tone: 'dark', heading: 'Book a fitting under the ash', button: true }),
    ] },
    { slug: 'as-seen-in', title: 'As seen in', build: (c) => [
      pageTitle(c, { title: 'Worn about the realm', tone: 'surface' }),
      logos(c, { n: 5, tone: 'bg', seeds: ['ash-a', 'ash-b', 'ash-c', 'ash-d', 'ash-e'] }),
      reviews(c, { n: 2, tone: 'bg', avatars: avatarsFor(c.site, 0), cols: 2, big: true }),
      stats(c, { n: 3, tone: 'surface' }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg' })] },
  ],
};
export default spec;

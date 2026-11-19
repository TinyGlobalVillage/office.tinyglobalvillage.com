// Ref — a dark navy shop with a violet accent: a row of round story bubbles over a big photo hero with the words
// on the left, three numbered category photo tiles, a product row, then big numbered link rows on the dark.
// Kept: story-bubble row · photo-left hero · three numbered category tiles · product shelf · numbered row list.
import { avatarsFor, contact, faq, hero, pageTitle, reviews, stats, type TemplateSpec } from '../kit.ts';
import { circleRow, rowList, shelf, tileRows } from './91242216.ts';

const grot = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

const spec: TemplateSpec = {
  key: '1c76a261', ref: '1c76a261', name: 'Nightjar Bazaar', industry: 'ecommerce', category: 'Ecommerce',
  description: 'A night-market stall under violet lanterns: round faces of the stallkeepers up top, a bold photo front, and numbered lanes of wares.',
  palette: { bg: '#10142b', surface: '#181d3a', ink: '#ffffff', body: 'rgba(255,255,255,0.78)', muted: 'rgba(255,255,255,0.6)', accent: '#8b6cff', accentInk: '#ffffff', dark: '#0a0d1f', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.78)', darkAccent: '#ffffff', line: 'rgba(255,255,255,0.14)' },
  fonts: { head: grot, body: sans, headWeight: 700, headTrack: -1, btnRadius: 999, btnUpper: false, cardRadius: 14 },
  chrome: { nav: 'dark bar: wordmark left, links centre, search/cart icons right', footer: 'dark, logo + four link columns + socials' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      circleRow(c, { n: 6, tone: 'bg', avatars: avatarsFor(c.site, 0), ring: '#8b6cff', d: 76 }),
      hero(c, { variant: 'photo-left', photo: '@forest|nature', h: 600, buttons: 2, overlay: 'rgba(10,13,31,0.55)', headSize: 58 }),
      tileRows(c, { tone: 'bg', head: { heading: 'Pick a lane of the market', align: 'left' }, rows: [{ h: 420, items: [
        { photo: '@fabric|craft', number: '01' }, { photo: '@jewelry|product', number: '02' }, { photo: '@craft|workshop', number: '03' },
      ] }] }),
      shelf(c, { n: 4, cols: 4, tone: 'surface', head: { heading: 'Glowing this week', button: 'All wares' }, tiles: ['#262c55', '#2f2560', '#1f3350', '#35284f'], chips: ['New moon', '', 'Few left', ''] }),
      rowList(c, { n: 4, tone: 'dark', head: { heading: 'Lanes after dark', align: 'left' } }),
    ] },
    { slug: 'shop', title: 'Shop', build: (c) => [
      pageTitle(c, { title: 'All wares', tone: 'surface', align: 'left' }),
      shelf(c, { n: 8, cols: 4, tone: 'bg', head: false, tiles: ['#262c55', '#2f2560', '#1f3350', '#35284f'], chips: ['', 'New moon', '', '', 'Few left', '', '', ''], button: 'Show more wares' }),
      stats(c, { n: 3, tone: 'accent' }),
    ] },
    { slug: 'stories', title: 'Stories', build: (c) => [
      pageTitle(c, { title: 'Stallkeeper stories', tone: 'bg', intro: true }),
      reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 2), cols: 3 }),
      faq(c, { n: 5, tone: 'bg', side: true }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'surface' })] },
  ],
};
export default spec;

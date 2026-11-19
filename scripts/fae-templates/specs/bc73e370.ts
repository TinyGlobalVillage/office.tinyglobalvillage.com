// Ref — a lively fashion store in white and blush: a black sale ribbon, a photo hero with the words on the left and
// two buttons, a split sale countdown, four category tiles with labels, another ribbon, two promo photo tiles, and a
// "trending" heading-with-button over a five-wide product row with colour dots.
// Kept: sale ribbon · photo-left hero · split countdown · category tiles · ribbon · promo photo tiles · trending row.
import { avatarsFor, contact, faq, hero, imageStory, pageTitle, reviews, team, type TemplateSpec } from '../kit.ts';
import { countdown, marquee, shelf, tileRows } from './91242216.ts';

const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const avenir = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

const spec: TemplateSpec = {
  key: 'bc73e370', ref: 'bc73e370', name: 'Foxglove Mode', industry: 'fashion', category: 'Fashion',
  description: 'A bustling faerie dress-shop in white and foxglove pink: ribbons of news, a ticking sale and racks of cloaks to browse.',
  palette: { bg: '#ffffff', surface: '#fbe9e7', ink: '#1a1a1a', body: '#4f4f4f', muted: '#8b8b8b', accent: '#1a1a1a', accentInk: '#ffffff', dark: '#1a1a1a', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#f7c6c0', line: 'rgba(0,0,0,0.1)' },
  fonts: { head: avenir, body: sans, headWeight: 600, headTrack: -0.4, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'black ribbon on top; wordmark left, links centre, icons right', footer: 'light, newsletter + four link columns + payment marks' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      marquee(c, { tone: 'dark', words: ['Free owl post on cloaks', 'Swaps till the next moon', 'Fresh foxglove dyes'] }),
      hero(c, { variant: 'photo-left', photo: '@fabric|flowers', h: 620, buttons: 2, overlay: 'rgba(20,14,14,0.42)', eyebrow: 'Woven this season' }),
      countdown(c, { split: true, tone: 'surface', eyebrow: 'Deal of the moon', heading: 'A third off every starlight veil', link: 'Shop the deal →' }),
      tileRows(c, { tone: 'bg', head: { heading: 'Browse the racks', align: 'center' }, rows: [{ h: 320, items: [
        { fill: '#f6dcd8', eyebrow: 'For the frost' }, { fill: '#e9e4f3', eyebrow: 'For the dance' }, { fill: '#e2efe6', eyebrow: 'For the road' }, { fill: '#f3ead9', eyebrow: 'For the feast' },
      ] }] }),
      marquee(c, { tone: 'surface', words: ['Spun by hand', 'Dyed with petals', 'Fitted under the oak', 'Spun by hand'] }),
      tileRows(c, { tone: 'bg', top: 40, rows: [{ h: 440, items: [
        { photo: '@studio|craft', eyebrow: 'New arrivals', sub: true, button: true }, { photo: '@jewelry|product', eyebrow: 'Little shining things', button: true },
      ] }] }),
      shelf(c, { n: 5, cols: 5, tone: 'bg', head: { heading: 'Trending in the glade', button: 'See all' }, tiles: ['#f4f4f4'], chips: ['', 'Sale', '', 'New', ''], swatches: true, titleSize: 14 }),
    ] },
    { slug: 'shop', title: 'Shop', build: (c) => [
      pageTitle(c, { title: 'The racks', tone: 'surface' }),
      shelf(c, { n: 10, cols: 5, tone: 'bg', head: false, tiles: ['#f4f4f4'], chips: ['Sale', '', '', '', 'New'], swatches: true, titleSize: 14, button: 'Show more' }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'The foxglove sisters', tone: 'bg', intro: true }),
      imageStory(c, { photo: '@workshop|craft', side: 'right', tone: 'surface', button: true }),
      team(c, { n: 3, avatars: avatarsFor(c.site, 0), tone: 'bg', ring: '#f7c6c0' }),
      reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 3), cols: 3 }),
    ] },
    { slug: 'help', title: 'Help', build: (c) => [
      pageTitle(c, { title: 'Fittings & swaps', tone: 'surface' }),
      faq(c, { n: 5, tone: 'bg', side: true }),
      contact(c, { tone: 'surface' }),
    ] },
  ],
};
export default spec;

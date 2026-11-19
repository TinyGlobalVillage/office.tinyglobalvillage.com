// Ref — navy and coral, a clean geometric sans: photo hero with the words in a pale box top-left, four dark
// icon tiles under it, an about block beside a photo, a list of services each with a price and a button.
// Kept: photo hero (words left) · four dark icon tiles · about text + photo right · price-row service list · wide photo band.
import { avatarsFor, cards, contact, faq, hero, imageStory, pageTitle, photoBand, splitHeading, stats, team, type TemplateSpec } from '../kit.ts';
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";
const spec: TemplateSpec = {
  key: '40453488', ref: '40453488', name: 'Lanternway Heralds', industry: 'agency', category: 'Agency',
  description: 'A brisk elven herald-house in navy and coral: photo hero, four dark promise tiles, a priced list of crafts.',
  palette: { bg: '#ffffff', surface: '#f2f2f3', ink: '#1e2033', body: '#4a4c5e', muted: '#7a7c8e', accent: '#ff7f50', accentInk: '#1e2033', dark: '#1e2033', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#ff9b75', line: 'rgba(30,32,51,0.18)' },
  fonts: { head: sans, body: sans, headWeight: 400, headTrack: -0.4, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'navy logo block left, links right, log-in, coral CTA + navy arrow tab', footer: 'pale grey, brand + three link columns' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: '@city|light|warm', h: 660, buttons: 1, overlay: 'rgba(30,32,51,0.42)' }),
      cards(c, { n: 4, cols: 4, kind: 'icon', tone: 'dark', head: false }),
      imageStory(c, { photo: '@studio|desk|study', side: 'right', tone: 'bg', button: true, heading: 'Who we are' }),
      cards(c, { n: 4, cols: 1, kind: 'price-row', tone: 'surface', price: true, link: '/contact', head: { heading: 'Our crafts', align: 'left' } }),
      photoBand(c, { photo: '@light|candle', tone: 'surface', h: 420, inset: true }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About the house', tone: 'surface', align: 'left' }),
      splitHeading(c, { tone: 'bg', paras: 2 }),
      stats(c, { n: 4, tone: 'dark' }),
      team(c, { n: 4, avatars: avatarsFor(c.site, 4), tone: 'bg', head: { heading: 'The heralds', intro: true } }),
    ] },
    { slug: 'services', title: 'Crafts', build: (c) => [
      pageTitle(c, { title: 'Crafts & prices', tone: 'dark' }),
      cards(c, { n: 6, cols: 1, kind: 'price-row', tone: 'bg', price: true, link: '/contact', head: false }),
      faq(c, { n: 5, tone: 'surface' }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg' })] },
  ],
};
export default spec;

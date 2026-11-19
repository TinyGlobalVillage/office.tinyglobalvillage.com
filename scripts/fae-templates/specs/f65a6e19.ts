// Ref — an outdoor-gear shop in navy and signal red, capitals in the heads: an inset photo hero, two promo
// photo tiles, a wide adventure photo band, a "giving back" trio on pale grey, a row of best-sellers with prices.
// Kept: photo hero (words left) · two photo promo cards · photo call-to-action band · three icon cards + button · product row with prices.
import { avatarsFor, cards, contact, ctaBand, hero, imageStory, pageTitle, posts, team, type TemplateSpec } from '../kit.ts';
const sans = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";
const spec: TemplateSpec = {
  key: 'f65a6e19', ref: 'f65a6e19', name: "Wayfarer's Banner", industry: 'agency', category: 'Agency',
  description: 'A gnome herald-house for travellers in navy and redcap red: wild hero, two promo tiles, a priced row of wares.',
  palette: { bg: '#ffffff', surface: '#f0f0f2', ink: '#14114f', body: '#46456a', muted: '#7b7a98', accent: '#d7173a', accentInk: '#ffffff', dark: '#14114f', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.8)', darkAccent: '#ff8094', line: 'rgba(20,17,79,0.14)' },
  fonts: { head: sans, body: sans, headWeight: 500, headTrack: 0.6, btnRadius: 0, cardRadius: 0 },
  chrome: { nav: 'thin red announcement bar; navy logo block left, small-caps links right, log-in + basket', footer: 'white, centred brand, socials, fine print' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'photo-left', photo: '@landscape|nature', h: 640, buttons: 1, overlay: 'rgba(14,12,60,0.32)', sideNote: true }),
      cards(c, { n: 2, cols: 2, kind: 'photo', tone: 'bg', photos: ['@forest', '@mist|sky'], head: false, link: '/shop', imgH: 300 }),
      ctaBand(c, { tone: 'dark', photo: '@water|mushroom|moss' }),
      cards(c, { n: 3, cols: 3, kind: 'icon', tone: 'surface', cardFill: false, button: true, head: { heading: 'Giving back to the wood' } }),
      cards(c, { n: 4, cols: 4, kind: 'plain', tone: 'bg', price: true, head: { heading: 'Our best-loved wares' } }),
    ] },
    { slug: 'shop', title: 'Shop', build: (c) => [
      pageTitle(c, { title: 'The wares', photo: '@landscape|nature', align: 'left' }),
      cards(c, { n: 8, cols: 4, kind: 'icon', tone: 'bg', price: true, head: false }),
      ctaBand(c, { tone: 'accent', split: true }),
    ] },
    { slug: 'journal', title: 'Journal', build: (c) => [
      pageTitle(c, { title: 'Trail notes', tone: 'surface' }),
      posts(c, { n: 3, photos: ['@forest', '@mist|sky', '@water|mushroom|moss'], tone: 'bg', head: false }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About the banner', tone: 'dark' }),
      imageStory(c, { photo: '@forest', side: 'left', tone: 'bg', eyebrow: true }),
      team(c, { n: 3, avatars: avatarsFor(c.site, 2), tone: 'surface', bio: true, head: { heading: 'The trail-keepers' } }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'bg' })] },
  ],
};
export default spec;

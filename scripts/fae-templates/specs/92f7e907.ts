// Ref — a cosy creator page: rounded white cards with a blush border floating over a picnic photo; a menu card of
// drawn icons beside a main statement card; a schedule card with a drawn figure; "hi, I'm…" words beside a photo;
// a get-in-touch card. Condensed serif caps, mustard buttons, olive footer.
// Kept: statement card with a picture · icon menu of six links · schedule card with a drawn list · hello words +
// picture · contact card.
import { avatarsFor, cards, contact, hero, imageStory, listPanel, pageTitle, posts, reviews, splitHeading, team, zigzag, type TemplateSpec } from '../kit.ts';
const serif = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const spec: TemplateSpec = {
  key: '92f7e907', ref: '92f7e907', name: 'Toadstool Nook', industry: 'agency', category: 'Agency',
  description: 'A gnome-run cosy studio of rounded cards on cream and olive: statement card, a menu of drawn icons, a schedule, a hello.',
  palette: { bg: '#efe8d4', surface: '#ffffff', ink: '#4a3a28', body: '#6b5a46', muted: '#8f7e66', accent: '#e0b259', accentInk: '#3a2a12', dark: '#6b6634', darkInk: '#fbf6e8', darkBody: 'rgba(251,246,232,0.84)', darkAccent: '#f1d79a', line: '#e8c7c0' },
  fonts: { head: serif, body: serif, headWeight: 400, headTrack: 0.5, btnRadius: 6, cardRadius: 28 },
  chrome: { nav: 'small link left, brand centred, mustard pill right, over the photo', footer: 'olive with a curved top: links left, brand centre, socials right' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'split', photo: '@forest|nature', tone: 'bg', h: 600, buttons: 1, imageRadius: 28 }),
      cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'surface', head: false, align: 'left', link: '/about' }),
      zigzag(c, { rows: [{ art: listPanel({ card: '#ffffff', ink: '#4a3a28', muted: '#8f7e66', accent: '#c6912f', line: '#e8c7c0', radius: 28, avatars: avatarsFor(c.site, 2) }), bullets: 3 }], tone: 'bg', startRight: true }),
      imageStory(c, { photo: '@mushroom|moss', side: 'right', tone: 'surface', eyebrow: true }),
      contact(c, { tone: 'bg', photo: '@books|study', heading: 'Get in touch' }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About the nook', tone: 'surface' }),
      splitHeading(c, { tone: 'bg', paras: 2 }),
      team(c, { n: 3, avatars: avatarsFor(c.site, 2), tone: 'surface', bio: true, head: false }),
    ] },
    { slug: 'journal', title: 'Journal', build: (c) => [
      pageTitle(c, { title: 'Notes from the nook', tone: 'bg' }),
      posts(c, { n: 3, photos: ['@forest|nature', '@mushroom|moss', '@books|study'], tone: 'bg', head: false }),
      reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 2) }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'surface', heading: 'Say hello' })] },
  ],
};
export default spec;

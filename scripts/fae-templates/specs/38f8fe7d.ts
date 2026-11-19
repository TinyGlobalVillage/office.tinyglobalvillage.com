// Ref — a warm children's therapy practice: a blue split hero with a rounded picture, a beige welcome, a yellow band
// of picture + points, service icons, round staff portraits with a red ring, a blue "our why" close.
// Kept: dark split hero with a soft-cornered picture · centred welcome · picture beside a bulleted list on a colour
// band · icon service cards · ringed team circles · centred dark closing band.
import { avatarsFor, cards, centered, contact, faq, hero, imageStory, pageTitle, stats, steps, team, zigzag, type TemplateSpec } from '../kit.ts';

const serif = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";
const avenir = "'Avenir Next', 'Segoe UI', var(--tgv-fontBody, 'Inter'), Arial, sans-serif";

const spec: TemplateSpec = {
  key: '38f8fe7d',
  ref: '38f8fe7d',
  name: 'Hollowbloom Hearth',
  industry: 'education',
  category: 'Education',
  description: 'A gentle gnome nursery for growing minds: a sky-blue welcome with a rounded window, honey bands and ringed portraits.',
  palette: { bg: '#ebe5dc', surface: '#edd17f', ink: '#23384f', body: '#3c4a5c', muted: '#5b6676', accent: '#cf3b2c', accentInk: '#ffffff', dark: '#33669a', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.86)', darkAccent: '#f4dc93', line: 'rgba(35,56,79,0.16)' },
  fonts: { head: serif, body: avenir, headWeight: 600, btnRadius: 28, cardRadius: 18 },
  chrome: { nav: 'logo left, links centre, red rounded "book a visit" button right', footer: 'blue, logo + address + hours in three columns' },
  pages: [
    {
      slug: 'home',
      title: 'Home',
      build: (c) => [
        hero(c, { variant: 'split', tone: 'dark', photo: '@garden|flowers', h: 640, imageRadius: 200, buttons: 1 }),
        centered(c, { tone: 'bg', eyebrow: true, button: true }),
        zigzag(c, { rows: [{ photo: '@nature|forest', bullets: 5 }], tone: 'surface', startRight: true, head: false }),
        cards(c, { n: 3, cols: 3, kind: 'icon', tone: 'bg', head: { heading: 'Ways we help little ones grow', intro: true } }),
        team(c, { n: 3, avatars: avatarsFor(c.site, 1), tone: 'bg', ring: '#cf3b2c', head: { heading: 'Your hearth-keepers' } }),
        centered(c, { tone: 'dark', heading: 'Why we tend this hollow', button: true }),
      ],
    },
    {
      slug: 'services',
      title: 'Services',
      build: (c) => [
        pageTitle(c, { title: 'What we offer', tone: 'surface' }),
        cards(c, { n: 4, cols: 2, kind: 'numbered', tone: 'bg', head: false }),
        steps(c, { n: 3, tone: 'surface', head: { heading: 'Your first visit' } }),
      ],
    },
    {
      slug: 'about',
      title: 'About',
      build: (c) => [
        pageTitle(c, { title: 'About the hollow', tone: 'dark' }),
        imageStory(c, { photo: avatarsFor(c.site, 1)[1], side: 'left', tone: 'bg', h: 600 }),
        stats(c, { n: 3, tone: 'surface' }),
      ],
    },
    {
      slug: 'faqs',
      title: 'FAQs',
      build: (c) => [pageTitle(c, { title: 'Questions parents ask', tone: 'surface', intro: false }), faq(c, { n: 7, tone: 'bg', head: false, side: false })],
    },
    {
      slug: 'contact',
      title: 'Contact',
      build: (c) => [contact(c, { tone: 'bg', heading: 'Visit the hollow' }), centered(c, { tone: 'dark', heading: 'Every sprout grows at its own pace' })],
    },
  ],
};
export default spec;

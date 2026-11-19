// Ref — a pet groomer in sky blue and navy: big words left with a cut-out picture right, a centred promise with three
// inline perks, a picture strip, raised review cards, a navy closing band. Rounded geometric sans, pill buttons.
// Kept: split hero · centred heading + three small icon perks + pill button · row of pictures · reviews on blue · navy CTA.
import { avatarsFor, cards, contact, ctaBand, CW, group, hero, image, imageStory, PAD, pageTitle, pricing, reviews, section, team, type Ctx, type TemplateSpec } from '../kit.ts';
const grot = "var(--font-space-grotesk, 'Space Grotesk'), 'Helvetica Neue', Arial, sans-serif";

/** A strip of pictures with no words (the groomed-creature row). */
function photoRow(c: Ctx, asks: string[], bg: string, h = 200) {
  const gap = 12;
  const n = asks.length;
  const cellW = (CW - gap * (n - 1)) / n;
  const cells = asks.map((a, i) => group(c, { name: `Picture ${i + 1}`, x: 0, y: 0, w: cellW, h, children: [image(c, { key: a, x: 0, y: 0, w: cellW, h, pct: 100, radius: 6 })] }));
  return section([group(c, { name: 'Picture row', x: PAD, y: 0, w: CW, h, children: cells, layout: { cols: n, bp: { tablet: n, mobile: 1 }, gap } })], h + 80, bg);
}

const spec: TemplateSpec = {
  key: '4db3ba23', ref: '4db3ba23', name: 'Whisker & Burr', industry: 'barbershop-salon', category: 'Barbershop & Salon',
  description: 'A faerie grooming parlour for woodland creatures in sky blue and navy: split hero, three perks, a picture strip, raised reviews.',
  palette: { bg: '#ffffff', surface: '#abd4dd', ink: '#1b4b8a', body: '#2e5687', muted: '#4b6c94', accent: '#1b4b8a', accentInk: '#ffffff', dark: '#1b4b8a', darkInk: '#ffffff', darkBody: 'rgba(255,255,255,0.84)', darkAccent: '#cfeaf0', line: 'rgba(27,75,138,0.14)' },
  fonts: { head: grot, body: grot, headWeight: 700, btnRadius: 999, cardRadius: 6 },
  chrome: { nav: 'brand-left, links right with a pill on the current page, log-in right', footer: 'navy, brand + links + socials' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'split', photo: '@moss|nature', tone: 'surface', h: 600, buttons: 1, headSize: 58 }),
      cards(c, { n: 3, cols: 3, kind: 'icon', tone: 'bg', cardFill: false, head: { heading: 'Every creature deserves a fuss' }, button: true }),
      photoRow(c, ['@mushroom|moss', '@forest|nature', '@garden|flowers|nature'], '#ffffff'),
      reviews(c, { n: 3, tone: 'surface', avatars: avatarsFor(c.site, 1) }),
      ctaBand(c, { tone: 'dark' }),
    ] },
    { slug: 'services', title: 'Services', build: (c) => [
      pageTitle(c, { title: 'Brushes, baths and burr-picking', tone: 'surface' }),
      cards(c, { n: 6, cols: 3, kind: 'icon', tone: 'bg', head: false, price: true }),
      pricing(c, { n: 3, tone: 'surface', head: { heading: 'Pick a fuss' } }),
    ] },
    { slug: 'about', title: 'About', build: (c) => [
      pageTitle(c, { title: 'About the parlour', tone: 'bg' }),
      imageStory(c, { photo: avatarsFor(c.site, 1)[0], side: 'left', tone: 'surface' }),
      team(c, { n: 3, avatars: avatarsFor(c.site, 1), tone: 'bg', bio: true, head: { heading: 'The gentle paws' } }),
    ] },
    { slug: 'contact', title: 'Contact', build: (c) => [contact(c, { tone: 'surface', heading: 'Book a brushing' })] },
  ],
};
export default spec;

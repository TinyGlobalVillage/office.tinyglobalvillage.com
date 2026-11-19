// Ref — a soft invitation site: peach and sage, coral accents, thin elegant serif heads, all centred.
// Kept: plain centred hero on sage with a flower picture under it · a large centred statement · two centred
// columns (when / where) with small links on peach · a centred block of address, phone, email · two host bios.
import { avatarsFor, button, cards, centered, contact, faq, hero, pageTitle, photoBand, section, stackDown, steps, team, text, tone, type Ctx, type Node, type Section, type TemplateSpec, type Tone, W } from '../kit.ts';

const serif = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const sans = "var(--tgv-fontBody, 'Inter'), 'Helvetica Neue', Arial, sans-serif";

/** The centred "practical" block: a small heading, then address, hours, phone, email on their own lines, one button. */
function infoBlock(ctx: Ctx, o: { tone: Tone; heading: string }): Section {
  const t = tone(ctx, o.tone);
  const line = (slot: 'address' | 'hours' | 'phone' | 'email') => text(ctx, { slot, x: 300, y: 0, w: 600, size: 17, color: t.body, align: 'center', name: 'Line' });
  const nodes: Node[] = [
    text(ctx, { text: o.heading, x: 240, y: 0, w: 720, size: 34, color: t.head, font: 'head', align: 'center', role: 'h2', name: 'Heading' }),
    line('address'), line('hours'), line('phone'), line('email'),
  ];
  const b = button(ctx, { slot: 'cta', href: '/rsvp', x: 0, y: 0, look: 'outline' });
  b.box.desktop.x = Math.round((W - b.box.desktop.w) / 2);
  nodes.push(b);
  const st = stackDown(nodes, 100, [26, 6, 6, 6, 32]);
  return section(st.nodes, st.y + 100, t.bg);
}

const spec: TemplateSpec = {
  key: '631a9317', ref: '631a9317', name: 'Petalgate Soirée', industry: 'artist', category: 'Artist',
  description: 'A faerie gallery opening told like an invitation: sage hero, a flower picture, when and where, two hosts.',
  palette: { bg: '#fdeee6', surface: '#dde6df', ink: '#3b3330', body: '#665a55', muted: '#9a8b84', accent: '#e07a66', accentInk: '#ffffff', dark: '#3b3330', darkInk: '#fdeee6', darkBody: 'rgba(253,238,230,0.82)', darkAccent: '#f2a493', line: 'rgba(59,51,48,0.16)' },
  fonts: { head: serif, body: sans, headWeight: 400, headTrack: 0.3, btnRadius: 0, btnUpper: true, cardRadius: 0 },
  chrome: { nav: 'one link left, name centred in serif, a coral "reply" button right', footer: 'peach, centred name and date, tiny print' },
  pages: [
    { slug: 'home', title: 'Home', build: (c) => [
      hero(c, { variant: 'plain-center', tone: 'surface', h: 520, eyebrow: true, buttons: 1, headSize: 64 }),
      photoBand(c, { photo: '@flowers|garden|moss', tone: 'surface', h: 520 }),
      centered(c, { tone: 'bg', heading: 'Come as the dusk comes', slot: 'about', size: 34 }),
      cards(c, { n: 2, cols: 2, kind: 'plain', tone: 'bg', head: false, cardFill: false, align: 'center', titleSlot: 'event.title', bodySlot: 'event.date', link: '/details' }),
      infoBlock(c, { tone: 'surface', heading: 'Finding the gate' }),
      team(c, { n: 2, avatars: avatarsFor(c.site, 1), tone: 'bg', bio: true, ring: '#e07a66', head: { heading: 'Your hosts' } }),
    ] },
    { slug: 'details', title: 'Details', build: (c) => [
      pageTitle(c, { title: 'The evening', tone: 'surface' }),
      steps(c, { n: 4, tone: 'bg', head: { heading: 'How the night unfolds' } }),
      faq(c, { n: 5, tone: 'surface' }),
    ] },
    { slug: 'travel', title: 'Travel', build: (c) => [
      pageTitle(c, { title: 'Getting here', tone: 'bg', photo: '@candle|light|warm' }),
      cards(c, { n: 3, cols: 3, kind: 'icon', tone: 'bg', head: false }),
      infoBlock(c, { tone: 'surface', heading: 'Lanterns along the path' }),
    ] },
    { slug: 'rsvp', title: 'RSVP', build: (c) => [contact(c, { tone: 'bg', heading: 'Send your reply' })] },
  ],
};
export default spec;

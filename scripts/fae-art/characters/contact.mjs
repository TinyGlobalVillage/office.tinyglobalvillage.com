// Contact sheets for review: one JPEG per kind per species/industry group, every variant labelled
// with its file name, so Gio (or I) can pick the keeper of each pair. Picks go in <out>/picks.json:
//   { "elf-f-03": 1, "scene-542052b1": 0, "gnome-m-07": null }   ← variant index; null = reject
//
//   node contact.mjs <out>
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
if (!out) throw new Error('usage: contact.mjs <out>');
const sheets = join(out, 'sheets');
mkdirSync(sheets, { recursive: true });
const font = process.env.FAE_FONT || '/System/Library/Fonts/Supplemental/Arial.ttf';

for (const kind of ['portrait', 'scene']) {
  const dir = join(out, kind);
  if (!existsSync(dir)) continue;
  const pngs = readdirSync(dir).filter((f) => f.endsWith('.png') && !f.includes('.part')).sort();
  // portraits group by species, scenes in pages of 24
  const groups = new Map();
  pngs.forEach((f, i) => {
    const g = kind === 'portrait' ? f.split('-')[0] : `p${Math.floor(i / 24) + 1}`;
    groups.set(g, [...(groups.get(g) ?? []), f]);
  });
  for (const [g, files] of groups) {
    const sheet = join(sheets, `${kind}-${g}.jpg`);
    const geo = kind === 'portrait' ? '256x256+4+4' : '336x192+4+4';
    execFileSync('magick', [
      'montage', '-label', '%t', ...files.map((f) => join(dir, f)), '-tile', kind === 'portrait' ? '8x' : '6x',
      '-geometry', geo, '-font', font, '-pointsize', '13', '-background', '#111', '-fill', '#fff', '-quality', '80', sheet,
    ]);
    console.log(`sheet ${sheet} (${files.length})`);
  }
}

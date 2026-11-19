#!/usr/bin/env node
// Original fae portrait avatars — flat, friendly, drawn from a seed. No photos of real people.
//   node avatars.mjs <outDir> [count-per-species=6] [startIndex=0]
// Writes <species>-<n>.svg + .png (600×600). Upload the PNGs with `pool.mjs add`.
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [outDir, perArg = "6", startArg = "0"] = process.argv.slice(2);
if (!outDir) throw new Error("usage: avatars.mjs <outDir> [count] [start]");
const PER = Number(perArg);
const START = Number(startArg);

function rng(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];

const SKIN = ["#f6d3b8", "#eebd96", "#d99a6c", "#b97a4f", "#8d5a3b", "#6a412a", "#f1c9a5", "#c98d62"];
const BG = ["#e9efe1", "#f3e6d4", "#e2e8f2", "#efe2ea", "#e6f0ec", "#f4ecd8", "#e4e0f1", "#f2e3dc"];
const HAIR = ["#2b1d14", "#5a3a22", "#8b5a2b", "#c48a3f", "#e3c27a", "#d9d4cc", "#7a2e1f", "#3b3f52"];
const CLOTH = ["#4f6d4a", "#8a3b2e", "#2f4a6b", "#7a5c2e", "#5b3f6b", "#2e5f5c", "#a0612d", "#43506b"];
const HAT = ["#b33a2e", "#2f5d8a", "#3f7a45", "#7d4a8c", "#c27b2a"];
const WING = ["#7cc4e4", "#e59ccf", "#93d283", "#e2c556", "#a896ec"];
const FLOWER = ["#f28aa8", "#f5c542", "#a98ff0", "#ffffff", "#f39b6b"];

function face(r, skin) {
  const eye = "#2a211b";
  const smileW = 26 + r() * 12;
  return `
  <circle cx="268" cy="292" r="7" fill="${eye}"/><circle cx="332" cy="292" r="7" fill="${eye}"/>
  <circle cx="250" cy="322" r="14" fill="#e8796b" opacity="0.28"/><circle cx="350" cy="322" r="14" fill="#e8796b" opacity="0.28"/>
  <path d="M${300 - smileW / 2} 338 Q300 ${352 + r() * 8} ${300 + smileW / 2} 338" stroke="${eye}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
}
function body(cloth) {
  return `<path d="M150 600 Q150 450 300 440 Q450 450 450 600 Z" fill="${cloth}"/>
  <path d="M262 446 L300 500 L338 446" fill="none" stroke="#00000022" stroke-width="6"/>`;
}

function gnome(r) {
  const skin = pick(r, SKIN.slice(0, 6)), cloth = pick(r, CLOTH), hat = pick(r, HAT);
  const beard = r() < 0.55, beardC = pick(r, ["#f1efe9", "#d9d4cc", "#b98a52", "#7a4a2a", "#9a9590"]);
  const glasses = r() < 0.35;
  const tilt = (r() - 0.5) * 50;
  return `${body(cloth)}
  <circle cx="300" cy="300" r="92" fill="${skin}"/>
  <circle cx="300" cy="318" r="18" fill="${skin}" stroke="#00000018" stroke-width="3"/>
  ${beard ? `<path d="M212 320 Q220 452 300 470 Q380 452 388 320 Q350 372 300 362 Q250 372 212 320Z" fill="${beardC}"/>` : ""}
  ${face(r, skin)}
  ${glasses ? `<g fill="none" stroke="#3a2c20" stroke-width="5"><circle cx="268" cy="292" r="20"/><circle cx="332" cy="292" r="20"/><path d="M288 292h24"/></g>` : ""}
  <path d="M196 262 Q300 228 404 262 L${330 + tilt} 60 Q300 40 ${290 + tilt} 70 Z" fill="${hat}"/>
  <path d="M190 262 Q300 222 410 262 Q300 290 190 262Z" fill="#00000026"/>`;
}

function elf(r) {
  const skin = pick(r, SKIN), cloth = pick(r, CLOTH), hair = pick(r, HAIR);
  const long = r() < 0.7;
  const circlet = r() < 0.5;
  return `
  ${long ? `<path d="M196 270 Q190 470 230 520 L370 520 Q410 470 404 270 Z" fill="${hair}"/>` : ""}
  ${body(cloth)}
  <path d="M214 300 L140 214 L230 270 Z" fill="${skin}" stroke="#00000014" stroke-width="3"/>
  <path d="M386 300 L460 214 L370 270 Z" fill="${skin}" stroke="#00000014" stroke-width="3"/>
  <ellipse cx="300" cy="300" rx="88" ry="100" fill="${skin}"/>
  ${face(r, skin)}
  <path d="M208 280 Q214 186 300 182 Q386 186 392 280 Q350 236 300 232 Q250 236 208 280Z" fill="${hair}"/>
  ${circlet ? `<path d="M212 248 Q300 214 388 248" stroke="#d8b75a" stroke-width="6" fill="none"/><circle cx="300" cy="226" r="9" fill="#9ad3e6" stroke="#d8b75a" stroke-width="4"/>` : ""}`;
}

function faerie(r) {
  const skin = pick(r, SKIN), cloth = pick(r, CLOTH), hair = pick(r, HAIR), wing = pick(r, WING), fl = pick(r, FLOWER);
  let sparkles = "";
  for (let i = 0; i < 7; i++) {
    const x = 60 + r() * 480, y = 60 + r() * 300, s = 4 + r() * 6;
    sparkles += `<path d="M${x} ${y - s}L${x + s * 0.3} ${y - s * 0.3}L${x + s} ${y}L${x + s * 0.3} ${y + s * 0.3}L${x} ${y + s}L${x - s * 0.3} ${y + s * 0.3}L${x - s} ${y}L${x - s * 0.3} ${y - s * 0.3}Z" fill="#ffffff" opacity="0.85"/>`;
  }
  return `
  <g opacity="0.7" fill="${wing}" stroke="#2a211b" stroke-opacity="0.25" stroke-width="4">
    <g transform="translate(170 330)"><g transform="rotate(-35)"><ellipse cx="0" cy="0" rx="110" ry="64"/></g></g>
    <g transform="translate(430 330)"><g transform="rotate(35)"><ellipse cx="0" cy="0" rx="110" ry="64"/></g></g>
    <g transform="translate(190 430)"><g transform="rotate(25)"><ellipse cx="0" cy="0" rx="70" ry="40"/></g></g>
    <g transform="translate(410 430)"><g transform="rotate(-25)"><ellipse cx="0" cy="0" rx="70" ry="40"/></g></g>
  </g>
  ${sparkles}
  ${body(cloth)}
  <path d="M216 296 L182 252 L232 276 Z" fill="${skin}"/><path d="M384 296 L418 252 L368 276 Z" fill="${skin}"/>
  <circle cx="300" cy="300" r="88" fill="${skin}"/>
  ${face(r, skin)}
  <path d="M210 286 Q206 196 300 192 Q394 196 390 286 Q372 238 300 236 Q228 238 210 286Z" fill="${hair}"/>
  ${[0, 1, 2, 3, 4].map((i) => {
    const x = 226 + i * 37, y = 224 - Math.sin((i / 4) * Math.PI) * 18;
    return `<circle cx="${x}" cy="${y}" r="13" fill="${fl}"/><circle cx="${x}" cy="${y}" r="5" fill="#f5c542"/>`;
  }).join("")}`;
}

const DRAW = { gnome, elf, faerie };
await fs.mkdir(outDir, { recursive: true });
for (const species of Object.keys(DRAW)) {
  for (let i = START; i < START + PER; i++) {
    const r = rng(`${species}-${i}`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <rect width="600" height="600" fill="${pick(r, BG)}"/>
  <g transform="translate(300 340) scale(1.22) translate(-300 -330)">${DRAW[species](r)}</g>
</svg>`;
    const base = path.join(outDir, `${species}-${i}`);
    await fs.writeFile(`${base}.svg`, svg);
    execFileSync("magick", ["-background", "none", "-density", "96", `${base}.svg`, "-quality", "88", `${base}.jpg`]);
    console.log(`${base}.jpg`);
  }
}

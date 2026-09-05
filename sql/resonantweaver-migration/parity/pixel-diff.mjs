// Pixel parity between two PNGs — the stricter half of the pair beside it.
//
// `token-parity.mjs` answers "same words, same elements". It cannot answer
// "same page", because the whole class of defect this migration keeps hitting
// is LAYOUT: Marthe's rollback list was "menu is different, images are
// different, buttons are different, boxes are different", and three of those
// four survive a token compare untouched. The one that caught the field guide
// under her nav pill was a screenshot, not a token count.
//
// NO DEPENDENCIES ON PURPOSE. Pillow is not installed on this Mac and the
// worktree has no `playwright` package either; a parity harness that needs an
// install is a harness that is not there on the day it is needed — which is
// how the first copy of the file beside this one was lost. Node ships zlib,
// and a PNG is zlib plus five filter cases, so this decodes them itself.
//
//   node parity/pixel-diff.mjs baseline.png candidate.png
//
// Exits 1 on any differing pixel and prints the bounding box, so it can gate a
// wave the way `generate.mjs --check` gates the SQL. Alpha is ignored: both
// captures are opaque screenshots, and comparing RGB keeps a PNG saved as RGB
// comparable with one saved as RGBA.
import fs from "node:fs";
import zlib from "node:zlib";

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function readPng(path) {
  const data = fs.readFileSync(path);
  if (data.readUInt32BE(0) !== 0x89504e47) throw new Error(`${path}: not a PNG`);
  let i = 8;
  const idat = [];
  let width, height, depth, colorType;
  while (i < data.length) {
    const len = data.readUInt32BE(i);
    const type = data.toString("latin1", i + 4, i + 8);
    const body = data.subarray(i + 8, i + 8 + len);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      colorType = body[9];
    } else if (type === "IDAT") idat.push(body);
    i += 12 + len;
  }
  if (depth !== 8) throw new Error(`${path}: ${depth}-bit PNG, expected 8`);
  const ch = CHANNELS[colorType];
  if (!ch) throw new Error(`${path}: unsupported colour type ${colorType}`);
  if (colorType === 3) throw new Error(`${path}: palette PNGs are not supported`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const out = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = Buffer.from(raw.subarray(pos, pos + stride));
    pos += stride;
    // The five filters from the PNG spec, in the spec's order.
    if (filter === 1) {
      for (let x = ch; x < stride; x++) line[x] = (line[x] + line[x - ch]) & 255;
    } else if (filter === 2) {
      for (let x = 0; x < stride; x++) line[x] = (line[x] + prev[x]) & 255;
    } else if (filter === 3) {
      for (let x = 0; x < stride; x++) {
        const a = x >= ch ? line[x - ch] : 0;
        line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255;
      }
    } else if (filter === 4) {
      for (let x = 0; x < stride; x++) {
        const a = x >= ch ? line[x - ch] : 0;
        const b = prev[x];
        const c = x >= ch ? prev[x - ch] : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    } else if (filter !== 0) throw new Error(`${path}: unknown filter ${filter}`);
    line.copy(out, y * stride);
    prev = line;
  }
  return { width, height, ch, px: out };
}

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error("usage: node parity/pixel-diff.mjs <baseline.png> <candidate.png>");
  process.exit(2);
}

const A = readPng(a);
const B = readPng(b);

// A size difference is itself the finding — report it and compare the overlap,
// rather than exiting blind. A shorter page is the shape the 2026-08-07
// rollback took (6047 px against 5357 px), and the overlap says whether the
// content moved or just stopped.
const sizeDiffers = A.width !== B.width || A.height !== B.height;
if (sizeDiffers) {
  console.log(`size differs: ${a} ${A.width}x${A.height} vs ${b} ${B.width}x${B.height}`);
}
const W = Math.min(A.width, B.width);
const H = Math.min(A.height, B.height);

let diff = 0, maxDelta = 0;
let minX = W, maxX = -1, minY = H, maxY = -1;
for (let y = 0; y < H; y++) {
  const ra = y * A.width * A.ch;
  const rb = y * B.width * B.ch;
  for (let x = 0; x < W; x++) {
    const ia = ra + x * A.ch;
    const ib = rb + x * B.ch;
    const d = Math.max(
      Math.abs(A.px[ia] - B.px[ib]),
      Math.abs(A.px[ia + 1] - B.px[ib + 1]),
      Math.abs(A.px[ia + 2] - B.px[ib + 2]),
    );
    if (!d) continue;
    diff++;
    if (d > maxDelta) maxDelta = d;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}

const total = W * H;
console.log(
  `${diff} of ${total} px differ (${((diff / total) * 100).toFixed(4)}%) over ${W}x${H}`,
);
if (diff) {
  console.log(`bbox x ${minX}..${maxX}  y ${minY}..${maxY}  max channel delta ${maxDelta}`);
}
process.exit(diff || sizeDiffers ? 1 : 0);

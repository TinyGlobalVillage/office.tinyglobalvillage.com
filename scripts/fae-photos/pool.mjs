#!/usr/bin/env node
// Fae template photo pool — Mac side. See README.md in this folder.
//
//   node pool.mjs search "<query>" [--n 16] [--page 1] [--source wikimedia] [--min 1300] [--any]
//                                                         → contact sheet of fresh CC0/PD photos
//   node pool.mjs import <i,i,…> --tags a,b               → resize on the Mac, deposit in the shared gallery
//   node pool.mjs use <photoId> <templateId>              → record a use (refuses a 6th site)
//   node pool.mjs free [tag]                              → photos that still have uses left
//
// Ledger: docs/template-gallery/photo-ledger.json (one entry per photo, with every site using it).
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LEDGER = path.resolve(HERE, "../../docs/template-gallery/photo-ledger.json");
const SCRATCH = process.env.FAE_SCRATCH || path.join(os.tmpdir(), "fae-photos");
const RCS_HOST = process.env.FAE_RCS_HOST || "rcs";
const RCS_OFFICE = process.env.FAE_RCS_OFFICE || "/srv/refusion-core/clients/office.tinyglobalvillage.com";
const MAX_USES = 5;
const MAX_EDGE = 2000;
const UA = "tgv-template-gallery/1.0";

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};

async function readLedger() {
  try {
    return JSON.parse(await fs.readFile(LEDGER, "utf8"));
  } catch {
    return { maxUses: MAX_USES, photos: {} };
  }
}
async function writeLedger(l) {
  const sorted = Object.fromEntries(Object.entries(l.photos).sort(([a], [b]) => a.localeCompare(b)));
  await fs.writeFile(LEDGER, JSON.stringify({ ...l, photos: sorted }, null, 2) + "\n");
}

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}
async function download(url, to) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await fs.writeFile(to, Buffer.from(await res.arrayBuffer()));
}

// Openverse's `url` is not always the full photo. What each provider actually hands over:
// stocksnap 960px, flickr 1024px, rawpixel 1300px (after the rewrite below), wikimedia full size.
const PROVIDER_EDGE = { stocksnap: 960, flickr: 1024, rawpixel: 1300 };
const deliverable = (r) => Math.min(r.width ?? 0, PROVIDER_EDGE[r.provider] ?? Infinity);
async function fetchBest(r, to) {
  if (r.provider === "rawpixel" && r.url.includes("/editor_1024/")) {
    try {
      return await download(r.url.replace("/editor_1024/", "/image_1300/"), to);
    } catch {
      /* fall through to the listed url */
    }
  }
  return download(r.url, to);
}

async function search() {
  const q = args[1];
  if (!q) throw new Error('usage: search "<query>"');
  const n = Number(flag("n", 16));
  const page = Number(flag("page", 1));
  const ledger = await readLedger();
  const known = new Set(Object.values(ledger.photos).map((p) => p.sourceId));
  const u = new URL("https://api.openverse.org/v1/images/");
  u.searchParams.set("q", q);
  u.searchParams.set("license", "cc0,pdm");
  if (!args.includes("--any")) u.searchParams.set("category", "photograph");
  if (flag("source")) u.searchParams.set("source", flag("source"));
  u.searchParams.set("mature", "false");
  u.searchParams.set("page_size", String(Math.min(n + 4, 20)));
  u.searchParams.set("page", String(page));
  const d = await getJson(u);
  const results = d.results
    .filter((r) => !known.has(r.id) && deliverable(r) >= Number(flag("min", 900)))
    .slice(0, n);
  const dir = path.join(SCRATCH, "search");
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const thumbs = [];
  for (const [i, r] of results.entries()) {
    const t = path.join(dir, `${String(i).padStart(2, "0")}.jpg`);
    try {
      await download(r.thumbnail, t);
      thumbs.push(t);
    } catch (e) {
      console.error(`thumb ${i}: ${e.message}`);
    }
  }
  const sheet = path.join(SCRATCH, "sheet.jpg");
  execFileSync("montage", [
    ...thumbs.flatMap((t) => ["-label", path.basename(t, ".jpg"), t]),
    "-tile", "6x", "-geometry", "220x150+4+4", "-font", process.env.FAE_FONT || "/System/Library/Fonts/Supplemental/Arial.ttf", "-pointsize", "16", "-background", "#222", "-fill", "#fff", sheet,
  ]);
  await fs.writeFile(path.join(SCRATCH, "last-search.json"), JSON.stringify({ q, results }, null, 2));
  console.log(`sheet: ${sheet}`);
  for (const [i, r] of results.entries()) {
    console.log(`${String(i).padStart(2, "0")} ${r.provider} ~${Math.round(deliverable(r))}px ${r.license} | ${r.title.slice(0, 60)}`);
  }
}

async function importPicks() {
  const picks = (args[1] || "").split(",").filter(Boolean).map(Number);
  const tags = (flag("tags", "") || "").split(",").map((t) => t.trim()).filter(Boolean);
  if (!picks.length) throw new Error("usage: import <i,i,…> --tags a,b");
  const { q, results } = JSON.parse(await fs.readFile(path.join(SCRATCH, "last-search.json"), "utf8"));
  const out = path.join(SCRATCH, "upload");
  await fs.rm(out, { recursive: true, force: true });
  await fs.mkdir(out, { recursive: true });
  const items = [];
  for (const i of picks) {
    const r = results[i];
    if (!r) throw new Error(`no result ${i}`);
    const key = `p-${r.id.slice(0, 8)}`;
    const raw = path.join(out, `${key}.src`);
    const jpg = path.join(out, `${key}.jpg`);
    await fetchBest(r, raw);
    execFileSync("magick", [raw, "-auto-orient", "-resize", `${MAX_EDGE}x${MAX_EDGE}>`, "-strip", "-quality", "82", jpg]);
    await fs.rm(raw);
    items.push({
      key,
      path: `/tmp/fae-photos/${key}.jpg`,
      filename: `fae-${key}.jpg`,
      contentType: "image/jpeg",
      title: r.title.slice(0, 180),
      tags: ["fae-template", ...tags, `license:${r.license}`],
      _src: r,
    });
  }
  const job = { items: items.map(({ _src, ...rest }) => rest) };
  await fs.writeFile(path.join(out, "job.json"), JSON.stringify(job));
  await fs.copyFile(path.join(HERE, "rcs-upload.mjs"), path.join(out, "rcs-upload.mjs"));
  execFileSync("ssh", [RCS_HOST, "rm -rf /tmp/fae-photos && mkdir -p /tmp/fae-photos"]);
  execFileSync("scp", ["-q", ...(await fs.readdir(out)).map((f) => path.join(out, f)), `${RCS_HOST}:/tmp/fae-photos/`]);
  const stdout = execFileSync("ssh", [
    RCS_HOST,
    `cd ${RCS_OFFICE} && node --env-file=.env.local /tmp/fae-photos/rcs-upload.mjs /tmp/fae-photos/job.json; rm -rf /tmp/fae-photos`,
  ]).toString();
  const ledger = await readLedger();
  for (const line of stdout.split("\n").filter((l) => l.startsWith("{"))) {
    const res = JSON.parse(line);
    const item = items.find((x) => x.key === res.key);
    if (!res.ok) {
      console.log(`FAIL ${res.key}: ${res.error}`);
      continue;
    }
    const r = item._src;
    const dims = execFileSync("magick", ["identify", "-format", "%w %h", path.join(out, `${res.key}.jpg`)]).toString().split(" ").map(Number);
    ledger.photos[res.key] = {
      id: res.key,
      url: res.url.endsWith("/") ? res.url : `${res.url}/`, // TGV runs trailingSlash — skip the 308
      fileId: res.fileId,
      width: dims[0],
      height: dims[1],
      title: r.title,
      tags,
      query: q,
      source: "openverse",
      sourceId: r.id,
      provider: r.provider,
      license: r.license,
      licenseUrl: r.license_url,
      creator: r.creator ?? null,
      landing: r.foreign_landing_url,
      uses: [],
    };
    console.log(`OK ${res.key} ${res.url}`);
  }
  await writeLedger(ledger);
}

async function use() {
  const [, id, templateId] = args;
  const ledger = await readLedger();
  const p = ledger.photos[id];
  if (!p) throw new Error(`unknown photo ${id}`);
  if (p.uses.includes(templateId)) return console.log(`${id} already used by ${templateId}`);
  if (p.uses.length >= MAX_USES) throw new Error(`${id} is already on ${MAX_USES} sites — pick another`);
  p.uses.push(templateId);
  await writeLedger(ledger);
  console.log(`${id} → ${templateId} (${p.uses.length}/${MAX_USES})`);
}

async function free() {
  const tag = args[1];
  const ledger = await readLedger();
  for (const p of Object.values(ledger.photos)) {
    if (p.uses.length >= MAX_USES || (tag && !p.tags.includes(tag))) continue;
    console.log(`${p.id} ${p.uses.length}/${MAX_USES} ${p.width}x${p.height} [${p.tags.join(",")}] ${p.title.slice(0, 50)}`);
  }
}

const commands = { search, import: importPicks, use, free };
const cmd = commands[args[0]];
if (!cmd) {
  console.log("commands: search | import | use | free");
  process.exit(1);
}
await cmd().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

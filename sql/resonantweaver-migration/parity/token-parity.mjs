// Parity between two renders of the SAME component — the app route and the
// page-editor section — reduced to the two things that must not differ.
//
// NOT a pixel diff and NOT a byte diff. styled-components mints a new class hash
// whenever the CSS it hashes changes, so a byte compare of two renders of one
// component reports a difference on every unrelated restyle and is worth
// nothing.
//
// NOT a DOM-path compare either, which was the first cut: React streams, so the
// same subtree arrives inline in one render and inside a hidden `<div>` fixup
// block in the other. Identical output, wildly different paths.
//
// What IS stable under both: the multiset of VISIBLE TEXT and the multiset of
// TAG NAMES. Same words, same elements, in whatever order the stream chose.
import fs from "node:fs";

const IGNORE = new Set(["script", "style", "template", "noscript", "link", "meta", "title"]);

function reduce(html) {
  const body = html.slice(html.indexOf("<body"));
  const text = new Map();
  const tags = new Map();
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>|([^<]+)/g;
  let skip = 0, skipTag = null, m;
  while ((m = re.exec(body))) {
    const [, close, tagRaw, txt] = m;
    if (txt !== undefined) {
      if (skip) continue;
      const t = txt.replace(/\s+/g, " ").trim();
      // React's streaming markers ride in as comment text; they are mechanism.
      if (t && !/^!--/.test(t)) bump(text, t);
      continue;
    }
    const tag = tagRaw.toLowerCase();
    if (skip) {
      if (tag === skipTag) skip += close ? -1 : 1;
      if (skip === 0) skipTag = null;
      continue;
    }
    if (IGNORE.has(tag)) {
      if (!close && !m[0].endsWith("/>")) { skip = 1; skipTag = tag; }
      continue;
    }
    if (!close) bump(tags, tag);
  }
  return { text, tags };
}
const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);

function diff(a, b) {
  const out = [];
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(k) || 0, y = b.get(k) || 0;
    if (x !== y) out.push([k, x, y]);
  }
  return out.sort((p, q) => p[0].localeCompare(q[0]));
}

const [fa, fb, label] = process.argv.slice(2);
if (!fa || !fb) {
  console.error("usage: node parity/token-parity.mjs <baseline.html> <candidate.html> [label]");
  process.exit(2);
}
const A = reduce(fs.readFileSync(fa, "utf8"));
const B = reduce(fs.readFileSync(fb, "utf8"));
const dt = diff(A.text, B.text);
const dg = diff(A.tags, B.tags);

const words = [...A.text.values()].reduce((n, v) => n + v, 0);
console.log(`\n${label || ""}`);
console.log(`  text   ${A.text.size} distinct strings (${words} nodes) — ${dt.length} differing`);
console.log(`  tags   ${A.tags.size} distinct elements — ${dg.length} differing`);
for (const [k, x, y] of dg) console.log(`    <${k}>  route ${x} → row ${y}`);
for (const [k, x, y] of dt.slice(0, 40)) console.log(`    ${String(x).padStart(3)} → ${String(y).padStart(3)}  ${JSON.stringify(k).slice(0, 120)}`);
if (dt.length > 40) console.log(`    … ${dt.length - 40} more`);
process.exit(dt.length || dg.length ? 1 : 0);

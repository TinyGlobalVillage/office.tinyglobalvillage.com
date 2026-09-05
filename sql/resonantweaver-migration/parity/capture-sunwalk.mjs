// Capture the Sun Walk twice — once as the ROUTE renders it, once as the ROW
// does — including the four popups, which a page screenshot cannot see.
//
// WHY A SCRIPT AND NOT THE BROWSER TOOL BY HAND. The page shot alone would have
// passed W9 while every popup rendered blank: the eight currents' descriptions
// and the two reference essays live entirely behind a click. Five captures per
// mode, in a fixed order, is not something to do twice by hand and get right.
//
// WHERE PLAYWRIGHT COMES FROM. Not from this worktree — it has two client
// package.json files and a bare install here destroys the lockfile for the whole
// fleet (see the repo's CLAUDE.md). It is resolved from wherever a copy already
// exists on this machine, npx's cache included, and the script says so plainly
// when there is none rather than failing on an import line.
//
//   node parity/capture-sunwalk.mjs <label> [url]
//
// Writes parity/shots/<label>-{page,current,anchor,weektypes,dossier}.png and a
// .txt of each popup's text, so a difference in words shows up in a diff and a
// difference in layout shows up in pixel-diff.mjs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const [label, url = "http://resonantweaver.localhost:3111/sun-walk/"] = process.argv.slice(2);
if (!label) {
  console.error("usage: node parity/capture-sunwalk.mjs <label> [url]");
  process.exit(2);
}

// WHICH copy of playwright, decided by which one can actually open a browser.
// There are three in npx's cache on this machine and they do not agree about
// which chromium build to look for — the newest wants one that was never
// downloaded — so this tries them in turn and keeps the first that launches,
// rather than picking by version and failing on a missing binary.
async function launchBrowser() {
  const npx = path.join(process.env.HOME, ".npm/_npx");
  const candidates = [
    ...(fs.existsSync(npx)
      ? fs
          .readdirSync(npx, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => path.join(npx, d.name, "node_modules/playwright/index.mjs"))
      : []),
    "/opt/homebrew/lib/node_modules/playwright/index.mjs",
  ].filter((f) => fs.existsSync(f));

  const failures = [];
  for (const file of candidates) {
    try {
      const { chromium } = await import(pathToFileURL(file).href);
      return await chromium.launch();
    } catch (err) {
      failures.push(path.relative(process.env.HOME, file) + ": " + String(err.message).split("\n")[0]);
    }
  }
  throw new Error(
    "no working playwright on this machine.\n" +
      (failures.length ? "tried:\n  " + failures.join("\n  ") + "\n" : "") +
      "Install one OUTSIDE this worktree (npx playwright install) — never `pnpm add` here, " +
      "which rewrites the fleet's lockfile.",
  );
}

const browser = await launchBrowser();
const shots = path.join(HERE, "shots");
fs.mkdirSync(shots, { recursive: true });

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "networkidle" });

const out = (name, ext) => path.join(shots, `${label}-${name}.${ext}`);

await page.screenshot({ path: out("page", "png"), fullPage: true });

// The four popups. Each is a dialog portalled to <body>; Escape closes it.
const POPUPS = [
  { name: "current", click: '[aria-label^="About the"]' },
  { name: "anchor", click: '[aria-label="About anchor weeks"]' },
  { name: "weektypes", click: 'button:has-text("Week types")' },
  { name: "dossier", click: 'button:has-text("Week dossier")' },
];

for (const popup of POPUPS) {
  await page.locator(popup.click).first().click();
  const dialog = page.locator('[role="dialog"]').first();
  await dialog.waitFor({ state: "visible", timeout: 5000 });
  await page.waitForTimeout(400); // the shell fades in
  await page.screenshot({ path: out(popup.name, "png") });
  const text = await dialog.evaluate((el) => el.innerText);
  fs.writeFileSync(out(popup.name, "txt"), text.trim() + "\n");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(200);
}

await browser.close();
console.log(
  `${label}: page + ${POPUPS.length} popups → ${path.relative(process.cwd(), shots)}/${label}-*.png`,
);

// Capture the Galactic Field Guide twice — once as the ROUTE renders it, once as
// the ROW does — including a dossier and a star card, which a page screenshot
// cannot see, and the TEXT of all 42 dossiers and all 62 star cards, which no
// number of screenshots can see.
//
// WHY THE TEXT AND NOT ONLY PIXELS. W10 moved about 170 KB of writing out of the
// build and into her row. A page shot proves the chart still draws; it proves
// nothing at all about seven hundred paragraphs that are each behind a click and
// a 1.4-second flight. So this walks every system in the registry, reads the
// dossier it opens, and writes one text file per mode. Two of those files
// diffing empty IS the parity result for the words; the screenshots are for the
// layout.
//
// IT DRIVES THE REGISTRY, NOT THE CHART. Clicking a star on the field means
// hitting a moving target under a pan/zoom transform; the registry list on the
// left is the same `onSelect` with a stable DOM row. `travel()` runs a 1400 ms
// flight before the dossier opens, so every step waits for the panel rather than
// for a timer.
//
// WHERE PLAYWRIGHT COMES FROM — same answer as capture-sunwalk.mjs: whichever
// copy already on this machine can actually open a browser. Never `pnpm add`
// here; this worktree has two client package.json files and an install rewrites
// the whole fleet's lockfile.
//
//   node parity/capture-fieldguide.mjs <label> [url]
//
// Writes parity/shots/<label>-{page,registry,dossier,starcard}.png and
// parity/shots/<label>-dossiers.txt (every system, every star card).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const [label, url = "http://resonantweaver.localhost:3111/galactic-field-guide/"] =
  process.argv.slice(2);
if (!label) {
  console.error("usage: node parity/capture-fieldguide.mjs <label> [url]");
  process.exit(2);
}

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
      failures.push(
        path.relative(process.env.HOME, file) + ": " + String(err.message).split("\n")[0],
      );
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
const out = (name, ext) => path.join(shots, `${label}-${name}.${ext}`);

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector(".reg-list .row", { timeout: 15000 });
await page.waitForTimeout(600); // the initial fit animates

await page.screenshot({ path: out("page", "png") });

const dossier = page.locator(".dossier");
const rows = page.locator(".reg-list .row");
const count = await rows.count();

/** Open the nth registry row and wait for its dossier to finish flying in. */
async function openSystem(index) {
  await rows.nth(index).click();
  await page.waitForFunction(
    () => document.querySelector(".dossier")?.classList.contains("open") === true,
    undefined,
    { timeout: 10000 },
  );
  await page.waitForTimeout(250);
}

const lines = [];
let starCards = 0;
for (let i = 0; i < count; i += 1) {
  const name = (await rows.nth(i).locator(".name").innerText()).trim();
  await openSystem(i);
  const text = (await dossier.evaluate((el) => el.innerText)).trim();
  lines.push(`═══ SYSTEM ${String(i + 1).padStart(2, "0")} — ${name} ═══`, text, "");

  if (i === 0) {
    await page.screenshot({ path: out("dossier", "png") });
  }

  // Its star cards, which are a second click inside the same registry row.
  const substars = rows.nth(i).locator("xpath=../..").locator(".substar");
  const starCount = await substars.count();
  for (let s = 0; s < starCount; s += 1) {
    const starName = (await substars.nth(s).locator(".sname").innerText()).trim();
    await substars.nth(s).click();
    await page.waitForFunction(
      () => !!document.querySelector(".dossier .dos-species.starcard"),
      undefined,
      { timeout: 10000 },
    );
    await page.waitForTimeout(200);
    const starText = (await dossier.evaluate((el) => el.innerText)).trim();
    lines.push(`─── STAR — ${name} / ${starName} ───`, starText, "");
    starCards += 1;
    if (starCards === 1) await page.screenshot({ path: out("starcard", "png") });
    await page.locator(".dos-return button").first().click();
    await page.waitForTimeout(200);
  }
}

// The registry itself, shot last so it carries the "visited" state of a full walk.
await page.screenshot({ path: out("registry", "png") });

fs.writeFileSync(out("dossiers", "txt"), lines.join("\n"));
await browser.close();

console.log(
  `${label}: ${count} dossiers + ${starCards} star cards → ` +
    `${path.relative(process.cwd(), shots)}/${label}-*.{png,txt}`,
);

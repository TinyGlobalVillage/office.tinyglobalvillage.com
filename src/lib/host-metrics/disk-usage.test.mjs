/**
 * Box Usage Monitor — disk sweep planning tests.
 *
 *   npm run test:host-metrics
 *
 * Runs against a scratch directory, never a real target. `--conditions=react-server`
 * is what lets a plain node test import a module that starts with `import "server-only"`.
 *
 * What's worth testing here is the arithmetic of "what would go": keep-newest,
 * minimum age, minimum size, and the refusal rules. The deleting itself is three
 * lines of fs; the decision of WHICH three files is where a mistake costs you a
 * directory you wanted.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, utimes, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { planFor, isInsideTarget } from "./disk-usage.ts";

const DAY = 24 * 60 * 60 * 1000;

async function ageFile(p, days) {
  const t = new Date(Date.now() - days * DAY);
  await utimes(p, t, t);
}

async function scratch() {
  return mkdtemp(path.join(tmpdir(), "tgv-disk-"));
}

function filesTarget(dir, over = {}) {
  return {
    id: "test-files",
    label: "test",
    path: dir,
    group: "logs",
    what: "",
    consequence: "",
    sweep: { kind: "files", match: "^app\\.log\\.\\d+$", minAgeDays: 7, keep: 2, ...over },
  };
}

test("files: keeps the newest N and skips anything younger than the age floor", async () => {
  const dir = await scratch();
  // .1 newest … .5 oldest, one day apart
  for (let i = 1; i <= 5; i++) {
    const p = path.join(dir, `app.log.${i}`);
    await writeFile(p, "x".repeat(100));
    await ageFile(p, i * 3); // 3, 6, 9, 12, 15 days
  }
  await writeFile(path.join(dir, "app.log"), "live"); // no numeric suffix — never a candidate

  const plan = await planFor(filesTarget(dir), { enabled: true, minAgeDays: 7, keep: 2 });
  const names = plan.candidates.map((c) => path.basename(c.path)).sort();

  // .1 and .2 are kept by policy; .3 (9d), .4 (12d), .5 (15d) are old enough.
  assert.deepEqual(names, ["app.log.3", "app.log.4", "app.log.5"]);
  assert.equal(plan.totalBytes, 300);
  assert.ok(!names.includes("app.log"), "the live log is never a candidate");
  await rm(dir, { recursive: true, force: true });
});

test("files: minBytes ignores small files however old they are", async () => {
  const dir = await scratch();
  const small = path.join(dir, "app.log.1");
  const big = path.join(dir, "app.log.2");
  await writeFile(small, "x".repeat(10));
  await writeFile(big, "x".repeat(5000));
  await ageFile(small, 90);
  await ageFile(big, 90);

  const plan = await planFor(filesTarget(dir, { minBytes: 1000, keep: 0 }), {
    enabled: true,
    minAgeDays: 7,
    keep: 0,
  });
  assert.deepEqual(
    plan.candidates.map((c) => path.basename(c.path)),
    ["app.log.2"],
  );
  await rm(dir, { recursive: true, force: true });
});

test("files: truncate targets are emptied in place, not deleted", async () => {
  const dir = await scratch();
  const p = path.join(dir, "app.log.1");
  await writeFile(p, "x".repeat(200));
  await ageFile(p, 30);

  const plan = await planFor(filesTarget(dir, { truncate: true, keep: 0 }), {
    enabled: true,
    minAgeDays: 1,
    keep: 0,
  });
  assert.equal(plan.candidates[0].action, "truncate");
  await rm(dir, { recursive: true, force: true });
});

test("nested: finds the named artefacts inside each subdirectory, respecting age", async () => {
  const dir = await scratch();
  for (const lane of ["lane-a", "lane-b"]) {
    await mkdir(path.join(dir, lane, "node_modules"), { recursive: true });
    await writeFile(path.join(dir, lane, "node_modules", "f"), "x".repeat(50));
    await mkdir(path.join(dir, lane, "src"), { recursive: true }); // not in `entries`
  }
  await ageFile(path.join(dir, "lane-a", "node_modules"), 30);
  await ageFile(path.join(dir, "lane-b", "node_modules"), 1); // too young

  const target = {
    id: "test-nested",
    label: "test",
    path: dir,
    group: "builds",
    what: "",
    consequence: "",
    sweep: { kind: "nested", entries: ["node_modules", ".next"], minAgeDays: 14 },
  };
  const plan = await planFor(target, { enabled: true, minAgeDays: 14, keep: 0 });

  assert.equal(plan.candidates.length, 1);
  assert.ok(plan.candidates[0].path.endsWith("lane-a/node_modules"));
  await rm(dir, { recursive: true, force: true });
});

test("a disarmed policy plans nothing, and says why", async () => {
  const dir = await scratch();
  await writeFile(path.join(dir, "app.log.1"), "x");
  const plan = await planFor(filesTarget(dir), { enabled: false, minAgeDays: 0, keep: 0 });
  assert.equal(plan.armed, false);
  assert.equal(plan.reason, "disarmed in policy");
  assert.equal(plan.candidates.length, 0);
  await rm(dir, { recursive: true, force: true });
});

test("a measured-only target is never armed", async () => {
  const plan = await planFor(
    { id: "m", label: "m", path: "/srv/refusion-core", group: "system", what: "", consequence: "", sweep: null },
    { enabled: true, minAgeDays: 0, keep: 0 },
  );
  assert.equal(plan.armed, false);
  assert.equal(plan.reason, "measured only");
});

test("command targets are armed but unpreviewable", async () => {
  const plan = await planFor(
    {
      id: "c",
      label: "c",
      path: "/home/admin",
      group: "caches",
      what: "",
      consequence: "",
      sweep: { kind: "command", argv: ["pnpm", "store", "prune"] },
    },
    { enabled: true, minAgeDays: 0, keep: 0 },
  );
  assert.equal(plan.armed, true);
  assert.equal(plan.opaqueCommand, "pnpm store prune");
  assert.equal(plan.candidates.length, 0);
});

test("the delete gate refuses the target itself, escapes, and paths outside the allow-list", async () => {
  const dir = await scratch();
  await mkdir(path.join(dir, "child"), { recursive: true });

  // Inside the target, but the scratch dir is not under ALLOWED_ROOTS.
  assert.equal(await isInsideTarget(path.join(dir, "child"), dir), false);
  // The target directory itself is never a candidate.
  assert.equal(await isInsideTarget(dir, dir), false);
  // A sibling is not inside.
  assert.equal(await isInsideTarget("/etc/passwd", dir), false);
  // A real allow-listed pair: a path under /srv/refusion-core inside its target.
  assert.equal(
    await isInsideTarget("/srv/refusion-core/nope-does-not-exist", "/srv/refusion-core"),
    false, // realpath fails on a missing file — refuse rather than guess
  );
  await rm(dir, { recursive: true, force: true });
});

// deploy-bench — reads the deploy clock (Gio 2026-10-29: "tracks the stamp and benchmarks
// how long things are actually taking. include speed tests"). The Mac's build-pipeline
// scripts stamp every step into data/workshop/deploys/<client>.stamps.jsonl, rcs-promote
// stamps swap / restart / smoke / rollback into <client>.promote.jsonl, and link-speed.sh
// appends to _linkspeed.jsonl. This joins them by run id into what the Benchmarks panel
// draws. Format + writers: utils/scripts/build-pipeline/stamp-lib.README.md.
import fs from "node:fs";

const ROOT = "/srv/refusion-core";
const DEPLOY_DIR = `${ROOT}/data/workshop/deploys`;
const CFG = `${ROOT}/data/workshop/deploy-bench.json`;
const SPEED_REQ = `${DEPLOY_DIR}/_linkspeed.request.json`;
const TAIL_BYTES = 4 * 1024 * 1024;

export type BenchConfig = { uploadWarnMBps: number; contendedRssMb: number; trendRuns: number };
export const BENCH_DEFAULTS: BenchConfig = { uploadWarnMBps: 1, contendedRssMb: 1024, trendRuns: 20 };

type Ctx = { diskFreeGb?: number; swapUsedMb?: number; pressure?: number; devMb?: number; playwrightMb?: number;
  others?: Array<{ kind: string; lane?: string; mb: number; n: number }> };
type Event = { t: string; client: string; run?: string; promote?: string; step: string; ev: "start" | "end";
  host?: string; ok?: boolean; bytes?: number; secs?: number; compile?: number; code?: string;
  note?: string; result?: string; by?: string; mono?: string; ctx?: Ctx };

export type Step = { step: string; startMs: number; secs: number | null; ok: boolean | null;
  bytes?: number; compile?: number; code?: string; note?: string };
export type Promote = { id: string; at: string; by?: string; ok: boolean | null; secs: number | null; steps: Step[] };
export type Run = {
  run: string; client: string; at: string; secs: number | null; open: boolean;
  result: string | null; ok: boolean | null; by?: string; note?: string; mono?: string;
  contended: boolean; ctx: Ctx | null; steps: Step[]; promotes: Promote[];
};
export type StepTrend = { step: string; n: number; median: number; p90: number; last: number;
  series: Array<{ run: string; secs: number; contended: boolean; ok: boolean }> };
export type LinkRoute = { route: string; host?: string; sameAs?: string; error?: string; rttMs?: number | null;
  upMBps?: number | null; downMBps?: number | null; rsyncSecs?: number | null; timedOut?: boolean; upMB?: number; limitSecs?: number };
export type LinkTest = { t: string; kind: "probe" | "full"; host?: string; run?: string; routes: LinkRoute[] };

// Steps that are real build work: a run that only queued and found the build covered is noise.
const BUILD_RESULTS = new Set(["staged", "live", "ok", "failed"]);
const STEP_ORDER = ["queue", "preflight", "link-probe", "dists-build", "dists-rsync", "git-sync", "env-pull",
  "install", "pkg-build", "next-build", "rsync-next", "stage"];

const clampN = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : d;
};
export function sanitizeBenchConfig(c: Partial<BenchConfig> | null | undefined): BenchConfig {
  return {
    uploadWarnMBps: Math.round(clampN(c?.uploadWarnMBps, BENCH_DEFAULTS.uploadWarnMBps, 0.05, 1000) * 100) / 100,
    contendedRssMb: Math.round(clampN(c?.contendedRssMb, BENCH_DEFAULTS.contendedRssMb, 64, 65536)),
    trendRuns: Math.round(clampN(c?.trendRuns, BENCH_DEFAULTS.trendRuns, 3, 200)),
  };
}
export function readBenchConfig(): BenchConfig {
  try { return sanitizeBenchConfig(JSON.parse(fs.readFileSync(CFG, "utf8"))); } catch { return { ...BENCH_DEFAULTS }; }
}
export function writeBenchConfig(c: BenchConfig): void {
  fs.mkdirSync(`${ROOT}/data/workshop`, { recursive: true });
  const tmp = `${CFG}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(sanitizeBenchConfig(c), null, 2));
  fs.renameSync(tmp, CFG);
}

/** The last TAIL_BYTES of a jsonl file, parsed; a torn first line is dropped. */
function readJsonl<T>(file: string): T[] {
  let buf: Buffer;
  try {
    const fd = fs.openSync(file, "r");
    try {
      const size = fs.fstatSync(fd).size, len = Math.min(size, TAIL_BYTES);
      buf = Buffer.alloc(len); fs.readSync(fd, buf, 0, len, size - len);
      if (len < size) { const i = buf.indexOf(10); buf = i >= 0 ? buf.subarray(i + 1) : Buffer.alloc(0); }
    } finally { fs.closeSync(fd); }
  } catch { return []; }
  const out: T[] = [];
  for (const l of buf.toString("utf8").split("\n")) { if (!l) continue; try { out.push(JSON.parse(l)); } catch { /* torn */ } }
  return out;
}

const ms = (t: string) => Date.parse(t);
const pctl = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
};
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Pair start/end events into steps, in start order. An unmatched start is still running (secs null). */
function pairSteps(evs: Event[], originMs: number): Step[] {
  const open = new Map<string, Event>(), steps: Step[] = [];
  for (const e of evs) {
    if (e.step === "run" || e.step === "promote") continue;
    if (e.ev === "start") { open.set(e.step, e); continue; }
    const s = open.get(e.step); open.delete(e.step);
    const start = s ? ms(s.t) : ms(e.t);
    steps.push({
      step: e.step, startMs: start - originMs,
      secs: s ? Math.max(0, (ms(e.t) - start) / 1000) : (e.secs ?? 0),
      ok: e.ok ?? null, bytes: e.bytes, compile: e.compile, code: e.code, note: e.note ?? s?.note,
    });
  }
  for (const s of open.values()) steps.push({ step: s.step, startMs: ms(s.t) - originMs, secs: null, ok: null, note: s.note });
  return steps.sort((a, b) => a.startMs - b.startMs);
}

function isContended(ctxs: Ctx[], cfg: BenchConfig): boolean {
  return ctxs.some((c) => (c.devMb ?? 0) + (c.playwrightMb ?? 0) >= cfg.contendedRssMb || (c.pressure ?? 1) >= 2);
}

export function readRuns(client: string, cfg = readBenchConfig()): Run[] {
  const evs = readJsonl<Event>(`${DEPLOY_DIR}/${client}.stamps.jsonl`);
  const byRun = new Map<string, Event[]>();
  for (const e of evs) { if (!e.run) continue; (byRun.get(e.run) ?? byRun.set(e.run, []).get(e.run)!).push(e); }

  // promote events, grouped per promote invocation, filed under the build's run id
  const promotesByRun = new Map<string, Promote[]>();
  const byPromote = new Map<string, Event[]>();
  for (const e of readJsonl<Event>(`${DEPLOY_DIR}/${client}.promote.jsonl`)) {
    if (!e.promote) continue;
    (byPromote.get(e.promote) ?? byPromote.set(e.promote, []).get(e.promote)!).push(e);
  }
  for (const [id, pe] of byPromote) {
    const run = pe.find((e) => e.run)?.run; if (!run) continue;
    const t0 = ms(pe[0].t), last = pe[pe.length - 1];
    const end = pe.find((e) => e.step === "promote" && e.ev === "end") ?? pe.find((e) => e.step === "rollback" && e.ev === "end");
    const p: Promote = { id, at: pe[0].t, by: pe[0].by, ok: end?.ok ?? null, secs: (ms(last.t) - t0) / 1000, steps: pairSteps(pe, t0) };
    (promotesByRun.get(run) ?? promotesByRun.set(run, []).get(run)!).push(p);
  }

  const runs: Run[] = [];
  for (const [run, re] of byRun) {
    const start = re.find((e) => e.step === "run" && e.ev === "start") ?? re[0];
    const end = re.find((e) => e.step === "run" && e.ev === "end");
    const t0 = ms(start.t);
    const ctxs = re.map((e) => e.ctx).filter(Boolean) as Ctx[];
    const lastT = ms(re[re.length - 1].t);
    runs.push({
      run, client, at: start.t,
      secs: end ? (ms(end.t) - t0) / 1000 : null,
      open: !end && Date.now() - lastT < 6 * 3600_000,
      result: end?.result ?? null, ok: end?.ok ?? null,
      by: start.by, note: start.note, mono: start.mono ?? re.find((e) => e.step === "git-sync" && e.mono)?.mono,
      contended: isContended(ctxs, cfg),
      ctx: ctxs.reduce<Ctx | null>((a, c) => (!a || (c.devMb ?? 0) + (c.playwrightMb ?? 0) > (a.devMb ?? 0) + (a.playwrightMb ?? 0) ? c : a), null),
      steps: pairSteps(re, t0),
      promotes: promotesByRun.get(run) ?? [],
    });
  }
  return runs.sort((a, b) => ms(b.at) - ms(a.at));
}

const isBuild = (r: Run) => !!r.result && BUILD_RESULTS.has(r.result) && r.steps.some((s) => s.step === "next-build" || s.step === "dists-build");

export function trend(runs: Run[], cfg: BenchConfig): StepTrend[] {
  const recent = runs.filter((r) => !r.open && isBuild(r)).slice(0, cfg.trendRuns).reverse();
  const by = new Map<string, StepTrend["series"]>();
  const push = (step: string, r: Run, secs: number, ok: boolean) =>
    (by.get(step) ?? by.set(step, []).get(step)!).push({ run: r.run, secs, contended: r.contended, ok });
  for (const r of recent) {
    for (const s of r.steps) if (s.secs != null) push(s.step, r, s.secs, s.ok !== false);
    if (r.secs != null) push("total", r, r.secs, r.ok !== false);
    const p = r.promotes[r.promotes.length - 1];
    if (p) for (const s of p.steps) if (s.secs != null) push(s.step, r, s.secs, s.ok !== false);
  }
  const rank = (s: string) => { const i = STEP_ORDER.indexOf(s); return s === "total" ? 999 : i < 0 ? 500 : i; };
  return [...by.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([step, series]) => {
    // the headline numbers exclude contended runs when there are clean ones to use
    const clean = series.filter((x) => !x.contended && x.ok).map((x) => x.secs);
    const base = clean.length ? clean : series.map((x) => x.secs);
    return { step, n: series.length, median: median(base), p90: pctl(base, 0.9), last: series[series.length - 1].secs, series };
  });
}

/** "What to expect": median of the last 5 clean (not contended, succeeded) build runs. */
export function expectation(runs: Run[]): { secs: number; n: number; nextBuild: number | null } | null {
  const clean = runs.filter((r) => !r.open && isBuild(r) && r.ok && !r.contended && r.secs != null).slice(0, 5);
  if (!clean.length) return null;
  const nb = clean.map((r) => r.steps.find((s) => s.step === "next-build")?.secs).filter((x): x is number => x != null);
  return { secs: median(clean.map((r) => r.secs!)), n: clean.length, nextBuild: nb.length ? median(nb) : null };
}

export function liveRun(runs: Run[]): { run: string; step: string | null; stepSecs: number; secs: number } | null {
  const r = runs.find((x) => x.open); if (!r) return null;
  const cur = [...r.steps].reverse().find((s) => s.secs == null);
  const now = Date.now(), t0 = ms(r.at);
  return { run: r.run, step: cur?.step ?? null, stepSecs: cur ? (now - t0 - cur.startMs) / 1000 : 0, secs: (now - t0) / 1000 };
}

export function readLinkTests(limit = 60): LinkTest[] {
  return readJsonl<LinkTest>(`${DEPLOY_DIR}/_linkspeed.jsonl`).filter((x) => Array.isArray(x?.routes)).slice(-limit).reverse();
}
export function speedTestPending(): { at: string; by: string } | null {
  try { return JSON.parse(fs.readFileSync(SPEED_REQ, "utf8")); } catch { return null; }
}
/** Ask the Mac's watcher for a full speed test; it runs between builds and deletes this file. */
export function requestSpeedTest(by: string): void {
  fs.mkdirSync(DEPLOY_DIR, { recursive: true });
  fs.writeFileSync(SPEED_REQ, JSON.stringify({ at: new Date().toISOString(), by }));
}

// scripts/sync-media-processors.mjs — Office copy of tinyglobalvillage.com's script (same output
// paths, so @tgv/module-video-calls finds /media-processors/* on Office calls too).
// public/media-processors/deepfilternet3/ is checked in, copied as-is from tinyglobalvillage.com;
// rebuild with utils/scripts/media/build-deepfilternet.sh.
//
// Self-hosts every asset the meeting media processors need, so nothing loads from a CDN:
//   public/media-processors/tasks-vision/   ← @mediapipe/tasks-vision wasm fileset
//                                             (background blur / virtual backgrounds;
//                                             @livekit/track-processors defaults to jsdelivr)
//   public/media-processors/rnnoise*.wasm   ← @sapphi-red/web-noise-suppressor binaries
//   public/media-processors/rnnoise-worklet.js ← its AudioWorklet processor module
//   public/media-processors/selfie_segmenter.tflite ← MediaPipe model (checked in once via
//                                             this script; downloaded only when missing)
//
// Same contract as sync-livekit-e2ee-worker.mjs: runs before dev and build, idempotent,
// never blocks the build — a missing asset degrades that feature, not the call.
import { copyFileSync, mkdirSync, existsSync, statSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Office does not depend on the wasm packages itself — they belong to @tgv/module-video-calls
// (RNNoise) and to @livekit/track-processors (MediaPipe). Resolve each from its owner.
const fromApp = createRequire(join(appRoot, "package.json"));
const require = createRequire(fromApp.resolve("@tgv/module-video-calls/package.json"));
const fromTrackProcessors = createRequire(require.resolve("@livekit/track-processors"));
const destRoot = join(appRoot, "public", "media-processors");

const copyIfStale = (src, dest) => {
  if (existsSync(dest) && statSync(dest).size === statSync(src).size) return false;
  copyFileSync(src, dest);
  return true;
};

try {
  mkdirSync(join(destRoot, "tasks-vision"), { recursive: true });
  let synced = 0;

  // 1. MediaPipe tasks-vision wasm fileset (FilesetResolver.forVisionTasks points here).
  const tasksVisionWasm = join(dirname(fromTrackProcessors.resolve("@mediapipe/tasks-vision")), "wasm");
  for (const f of readdirSync(tasksVisionWasm)) {
    if (copyIfStale(join(tasksVisionWasm, f), join(destRoot, "tasks-vision", f))) synced++;
  }

  // 2. RNNoise wasm binaries + worklet module.
  const wnsDist = dirname(require.resolve("@sapphi-red/web-noise-suppressor"));
  for (const f of ["rnnoise.wasm", "rnnoise_simd.wasm"]) {
    if (copyIfStale(join(wnsDist, f), join(destRoot, f))) synced++;
  }
  if (copyIfStale(join(wnsDist, "rnnoise", "workletProcessor.js"), join(destRoot, "rnnoise-worklet.js"))) synced++;

  // 3. Selfie segmenter model — fetched once, then lives in the repo like any other public asset.
  const model = join(destRoot, "selfie_segmenter.tflite");
  if (!existsSync(model)) {
    const url =
      "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
    const res = await fetch(url);
    if (res.ok) {
      writeFileSync(model, Buffer.from(await res.arrayBuffer()));
      synced++;
    } else {
      console.warn(`[media-processors] model download failed (${res.status}) — backgrounds degrade until it lands.`);
    }
  }

  if (synced > 0) console.log(`[media-processors] synced ${synced} asset(s) → public/media-processors/`);
} catch (err) {
  console.warn(`[media-processors] sync skipped: ${err?.message ?? err}`);
}

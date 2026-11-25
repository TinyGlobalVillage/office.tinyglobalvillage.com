# DeepFilterNet3 (self-hosted noise filter)

Loaded by `@tgv/module-video-calls` `meetings/settings/noiseSuppression.ts` when a member's noise
filter is "DeepFilterNet" (the default where supported). Everything is served from this folder —
no third-party CDN at runtime. Built from source on RCS2, 2026-11-23.

| File | What |
|---|---|
| `deepfilter-worklet.js` | UTF-8 shims + wasm-bindgen 0.2.92 no-modules glue (generated) + AudioWorklet processor (from deepfilternet3-noise-filter@1.3.0, TGV underrun report) |
| `pkg/df_bg.wasm` | libDF `--features wasm` @ Rikorose/DeepFilterNet `7b14b895`, wasm-opt -O3 (8.6 MB, 2.3 MB gzip) |
| `models/DeepFilterNet3_onnx.tar.gz` | DeepFilterNet3 model from that repo's `models/` (8.0 MB) |
| `LICENSE-*.DeepFilterNet` | DeepFilterNet (MIT OR Apache-2.0, © Hendrik Schröter) |
| `LICENSE-MIT`, `LICENSE-APACHE` | the vendored processor class (Apache-2.0 OR MIT) |

Rebuild (wasm + model + glue): `utils/scripts/media/build-deepfilternet.sh [rev]` from the mono
lane root. The glue sits between the `wasm-bindgen glue` and `Processor` markers in the worklet.
Checked 2026-11-23 in node: clean speech passes unchanged (rms 0.0287 → 0.0286), the SNR-0 noisy
sample drops 0.064 → 0.046, 6.6× faster than real time on RCS2. If the browser can't keep up the
worklet reports underruns and the page falls back to RNNoise.

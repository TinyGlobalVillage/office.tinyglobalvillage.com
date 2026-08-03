/**
 * Next.js instrumentation hook — runs once at server startup.
 * Starts the log writer which in turn starts the PM2 broadcast stream, and the
 * Box Usage Monitor sampler.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { startLogWriter } = await import("./lib/log-writer");
    startLogWriter();

    // Production-only, same as the log writer: read.ts reads /proc, so on a Mac
    // dev box every sample would be zeros — and those zeros would be written to
    // whatever DB the dev env points at, polluting the real history.
    const { startSampler } = await import("./lib/host-metrics/sampler");
    startSampler();
  }
}

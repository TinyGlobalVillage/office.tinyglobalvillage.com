/**
 * Next.js instrumentation hook — runs once at server startup.
 * Starts the log writer which in turn starts the PM2 broadcast stream.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startLogWriter } = await import("./lib/log-writer");
    startLogWriter();
  }
}

/**
 * Mounts inside the dashboard layout to:
 *   1. Kick off the job-store polling loop on first load (so an in-flight
 *      transcription started in a previous tab session shows up immediately).
 *   2. Trigger one synchronous sync as soon as we're mounted, so the very
 *      first paint already reflects server state.
 *
 * This is split out from `DashboardToastsHost` so the hydrator can run
 * independently — the toast doesn't render anything until a job finishes,
 * but polling needs to start regardless.
 */
"use client";

import { useEffect } from "react";
import { ensurePolling, syncFromServer } from "@tgv/module-connect/transcriber";

export default function TranscriberJobsHydrator() {
  useEffect(() => {
    void syncFromServer();
    ensurePolling();
  }, []);
  return null;
}

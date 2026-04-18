/**
 * log-writer.ts
 * Subscribes to the server broadcast and appends entries to daily
 * log files split by Los Angeles (PT) time.
 *
 * Log dir:   /srv/refusion-core/logs/tgv-office/
 * File name: YYYY-MM-DD.log  (LA date)
 * Line fmt:  [HH:MM:SS PT] <text>\n
 */
import { appendFileSync, mkdirSync } from "fs";
import path from "path";
import { broadcast, BroadcastEntry } from "./server-broadcast";

const LOG_DIR = process.env.TGV_LOG_DIR ?? "/srv/refusion-core/logs/tgv-office";

// LA time helpers
function laDateStr(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2"); // MM/DD/YYYY → YYYY-MM-DD
}

function laTimeStr(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    timeZone: "America/Los_Angeles",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

let started = false;

export function startLogWriter() {
  if (started) return;
  started = true;

  mkdirSync(LOG_DIR, { recursive: true });
  broadcast.start();

  broadcast.on("line", (entry: BroadcastEntry) => {
    try {
      const date = laDateStr(entry.ts);
      const time = laTimeStr(entry.ts);
      const logPath = path.join(LOG_DIR, `${date}.log`);
      appendFileSync(logPath, `[${time} PT] ${entry.text}\n`, "utf8");
    } catch {
      // Never let a write failure crash the server
    }
  });
}

import { exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { readdirSync } from "fs";

const execAsync = promisify(exec);

type Event = {
  time: Date;
  timeLabel: string;
  actor: string;
  event: string;
  type: "pm2" | "git" | "system";
  project?: string;
};

// ── PM2 log parser ────────────────────────────────────────────────
async function getPm2Events(): Promise<Event[]> {
  try {
    const raw = await readFile("/home/admin/.pm2/pm2.log", "utf-8");
    const lines = raw.split("\n").filter(Boolean).slice(-300);
    const events: Event[] = [];

    for (const line of lines) {
      // "2026-04-11T02:33:10: PM2 log: App [name:id] online"
      const dateMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
      if (!dateMatch) continue;
      const time = new Date(dateMatch[1]);

      const appMatch = line.match(/App \[([^\]:]+)(?::\d+)?\] (.+)/);
      if (!appMatch) continue;
      const [, appName, action] = appMatch;

      let event = "";
      if (action.includes("online")) event = `${appName} started`;
      else if (action.includes("exited with code [0]")) event = `${appName} restarted`;
      else if (action.includes("exited with code")) event = `${appName} crashed (${action})`;
      else if (action.includes("starting in")) continue; // skip noise
      else event = `${appName} — ${action}`;

      events.push({ time, timeLabel: "", actor: "PM2", event, type: "pm2", project: appName });
    }
    return events;
  } catch {
    return [];
  }
}

// ── Git log parser ────────────────────────────────────────────────
async function getGitEvents(): Promise<Event[]> {
  const clientRoot = "/srv/refusion-core/client";
  const events: Event[] = [];

  let dirs: string[] = [];
  try {
    dirs = readdirSync(clientRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }

  await Promise.all(
    dirs.map(async (proj) => {
      try {
        const { stdout } = await execAsync(
          `git -C "${clientRoot}/${proj}" log --oneline -8 --format="%aI|%an|%s" 2>/dev/null || true`
        );
        for (const line of stdout.split("\n").filter(Boolean)) {
          const [iso, author, subject] = line.split("|");
          if (!iso || !subject) continue;
          const time = new Date(iso);
          if (isNaN(time.getTime())) continue;
          events.push({
            time,
            timeLabel: "",
            actor: author?.trim() || "Unknown",
            event: `${proj}: ${subject.trim()}`,
            type: "git",
            project: proj,
          });
        }
      } catch { /* skip inaccessible repos */ }
    })
  );
  return events;
}

// ── Relative time formatter ───────────────────────────────────────
function relTime(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export async function GET() {
  const [pm2, git] = await Promise.all([getPm2Events(), getGitEvents()]);

  const all = [...pm2, ...git]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 40)
    .map((e) => ({ ...e, timeLabel: relTime(e.time), time: e.time.toISOString() }));

  return Response.json(all, { headers: { "Cache-Control": "no-store" } });
}

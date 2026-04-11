import { readdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const CLIENT_ROOT = "/srv/refusion-core/client";

type Pm2Proc = {
  name: string;
  pm2_env: { status: string; restart_time: number; pm_uptime: number };
  monit: { memory: number; cpu: number };
};

async function getPm2Map(): Promise<Map<string, { status: string; restarts: number }>> {
  try {
    const { stdout } = await execAsync("pm2 jlist");
    const procs: Pm2Proc[] = JSON.parse(stdout);
    const map = new Map<string, { status: string; restarts: number }>();
    for (const p of procs) {
      map.set(p.name, {
        status: p.pm2_env.status,
        restarts: p.pm2_env.restart_time,
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

async function getLastCommit(dir: string) {
  try {
    const { stdout } = await execAsync(
      `git -C "${dir}" log -1 --format="%ar|%an|%s" 2>/dev/null || true`
    );
    const [timeAgo, author, subject] = stdout.trim().split("|");
    if (!timeAgo) return null;
    return { timeAgo: timeAgo.trim(), author: author?.trim(), subject: subject?.trim() };
  } catch {
    return null;
  }
}

export async function GET() {
  const [entries, pm2Map] = await Promise.all([
    readdir(CLIENT_ROOT, { withFileTypes: true }),
    getPm2Map(),
  ]);

  const projects = await Promise.all(
    entries
      .filter((e) => e.isDirectory())
      .map(async (e) => {
        const dir = `${CLIENT_ROOT}/${e.name}`;
        const _portFile = `${dir}/.port`;

        let port: string | null = null;
        if (existsSync(`${dir}/.port`)) {
          port = (await readFile(`${dir}/.port`, "utf-8")).trim();
        }

        const [pm2, lastCommit] = await Promise.all([
          Promise.resolve(pm2Map.get(e.name) ?? null),
          getLastCommit(dir),
        ]);

        return {
          name: e.name,
          port,
          url: `https://${e.name}`,
          pm2Status: pm2?.status ?? null,
          pm2Restarts: pm2?.restarts ?? 0,
          lastCommit,
        };
      })
  );

  return Response.json(projects);
}

import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync } from "fs";
import path from "path";

const execAsync = promisify(exec);

const CLIENT_ROOT = "/srv/refusion-core/client";

type Pm2Process = {
  pm_id: number;
  name: string;
  pid: number;
  monit: { memory: number; cpu: number };
  pm2_env: {
    status: string;
    restart_time: number;
    pm_uptime: number;
    args?: string[];
    env?: { PORT?: string; port?: string };
    versioning?: { revision?: string };
  };
};

function resolvePort(p: Pm2Process): number | null {
  // 1. PM2 env PORT
  const envPort = p.pm2_env.env?.PORT ?? p.pm2_env.env?.port;
  if (envPort) return parseInt(envPort, 10) || null;

  // 2. Args: next start -- -p 3005
  const args = p.pm2_env.args ?? [];
  const pIdx = args.indexOf("-p");
  if (pIdx !== -1 && args[pIdx + 1]) {
    const n = parseInt(args[pIdx + 1], 10);
    if (!isNaN(n)) return n;
  }

  // 3. .port file
  try {
    const portFile = path.join(CLIENT_ROOT, p.name, ".port");
    const raw = readFileSync(portFile, "utf8").trim();
    const n = parseInt(raw, 10);
    if (!isNaN(n)) return n;
  } catch { /* no .port file */ }

  return null;
}

export async function GET() {
  try {
    const { stdout } = await execAsync("pm2 jlist");
    const raw: Pm2Process[] = JSON.parse(stdout);

    const processes = raw.map((p) => ({
      id: p.pm_id,
      name: p.name,
      status: p.pm2_env.status,
      restarts: p.pm2_env.restart_time,
      uptime: p.pm2_env.pm_uptime,
      memoryMb: p.monit?.memory
        ? Math.round(p.monit.memory / 1024 / 1024)
        : null,
      cpu: p.monit?.cpu ?? null,
      port: resolvePort(p),
    }));

    return Response.json(processes);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

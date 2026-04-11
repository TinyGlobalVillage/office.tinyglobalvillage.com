import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

type Pm2Process = {
  pm_id: number;
  name: string;
  monit: { memory: number; cpu: number };
  pm2_env: {
    status: string;
    restart_time: number;
    pm_uptime: number;
    env?: { PORT?: string };
    versioning?: { revision?: string };
  };
};

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
      port: p.pm2_env.env?.PORT ?? null,
    }));

    return Response.json(processes);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

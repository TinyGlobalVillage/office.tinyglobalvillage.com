/**
 * POST /api/editor/build
 * Body: { project: string }  — project name = folder name under /srv/refusion-core/client/
 * Streams SSE: build stdout/stderr, then pm2 restart result
 */
import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { existsSync } from "fs";

const CLIENT_ROOT = "/srv/refusion-core/client";

function safe(name: string): string | null {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return null;
  const dir = path.join(CLIENT_ROOT, name);
  if (!existsSync(dir)) return null;
  return dir;
}

export async function POST(req: NextRequest) {
  const { project } = await req.json().catch(() => ({}));
  if (!project) return new Response("Missing project", { status: 400 });

  const dir = safe(project);
  if (!dir) return new Response("Invalid project", { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(ctrl) {
      const send = (data: string) => {
        ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send(`[build] Starting npm run build in ${dir}…`);

      const build = spawn("npm", ["run", "build"], {
        cwd: dir,
        env: { ...process.env, FORCE_COLOR: "0" },
      });

      build.stdout.on("data", (d) => {
        String(d).split("\n").filter(Boolean).forEach(send);
      });
      build.stderr.on("data", (d) => {
        String(d).split("\n").filter(Boolean).forEach((l) => send(`[stderr] ${l}`));
      });

      build.on("close", (code) => {
        if (code !== 0) {
          send(`[build] ✗ Build failed (exit ${code})`);
          ctrl.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ ok: false, code })}\n\n`));
          ctrl.close();
          return;
        }

        send(`[build] ✓ Build succeeded — restarting ${project}…`);

        const restart = spawn("pm2", ["restart", project], {
          env: { ...process.env },
        });

        restart.stdout.on("data", (d) => {
          String(d).split("\n").filter(Boolean).forEach(send);
        });
        restart.stderr.on("data", (d) => {
          String(d).split("\n").filter(Boolean).forEach(send);
        });
        restart.on("close", (rc) => {
          if (rc === 0) {
            send(`[pm2] ✓ ${project} restarted successfully`);
          } else {
            send(`[pm2] ✗ pm2 restart exited ${rc}`);
          }
          ctrl.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ ok: rc === 0 })}\n\n`));
          ctrl.close();
        });
      });

      return () => { build.kill(); };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

import { spawn } from "child_process";
import { NextRequest } from "next/server";

// Whitelisted commands — only these can be executed
const REGISTRY: Record<
  string,
  { bin: string; baseArgs: string[]; needsEnv?: string[] }
> = {
  diskusage: {
    bin: "bash",
    baseArgs: ["/srv/refusion-core/utils/scripts/system/diskusage"],
  },
  "pm2-harden": {
    bin: "bash",
    baseArgs: ["/srv/refusion-core/utils/scripts/pm2/harden-pm2"],
  },
  "pm2-newpm2": {
    bin: "bash",
    baseArgs: ["/srv/refusion-core/utils/scripts/pm2/newpm2"],
  },
  "pm2-editpm2": {
    bin: "bash",
    baseArgs: ["/srv/refusion-core/utils/scripts/pm2/editpm2"],
  },
  "pm2-restart": { bin: "pm2", baseArgs: ["restart"] },
  "pm2-stop": { bin: "pm2", baseArgs: ["stop"] },
  "pm2-start": { bin: "pm2", baseArgs: ["start"] },
  "pm2-delete": { bin: "pm2", baseArgs: ["delete"] },
  "pm2-logs": { bin: "pm2", baseArgs: ["logs", "--lines", "80", "--nostream"] },
  "pm2-save": { bin: "pm2", baseArgs: ["save"] },
  "start-client": {
    bin: "bash",
    baseArgs: ["/srv/refusion-core/utils/scripts/project/start-client"],
  },
  "erase-project": {
    bin: "bash",
    baseArgs: ["/srv/refusion-core/utils/scripts/project/erase-dir"],
  },
  newclientproject: {
    bin: "bash",
    baseArgs: [
      "/srv/refusion-core/utils/scripts/project/newclientproject/newclientproject",
    ],
    needsEnv: ["GITHUB_PAT", "CF_API_TOKEN"],
  },
  "newclientproject-static": {
    bin: "bash",
    baseArgs: [
      "/srv/refusion-core/utils/scripts/project/newclientproject/newclientproject-static",
    ],
    needsEnv: ["GITHUB_PAT", "CF_API_TOKEN"],
  },
  gitrepo: {
    bin: "bash",
    baseArgs: ["/srv/refusion-core/utils/scripts/git/gitrepo"],
    needsEnv: ["GITHUB_PAT"],
  },
  gitdelrepo: {
    bin: "bash",
    baseArgs: ["/srv/refusion-core/utils/scripts/git/gitdelrepo"],
    needsEnv: ["GITHUB_PAT"],
  },
};

// Only allow safe argument characters
const SAFE_ARG = /^[a-zA-Z0-9._\-\/]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.script !== "string") {
    return new Response("Bad request", { status: 400 });
  }

  const { script, args = [] } = body as { script: string; args?: string[] };
  const def = REGISTRY[script];
  if (!def) {
    return new Response(`Unknown script: ${script}`, { status: 400 });
  }

  const safeArgs = (args as string[]).map(String);
  for (const arg of safeArgs) {
    if (!SAFE_ARG.test(arg)) {
      return new Response(`Unsafe argument: ${arg}`, { status: 400 });
    }
  }

  // Build env — inherit full process env, inject extra secrets
  const env = { ...process.env } as NodeJS.ProcessEnv;
  if (def.needsEnv) {
    for (const key of def.needsEnv) {
      if (process.env[key]) env[key] = process.env[key];
    }
  }

  const fullArgs = [...def.baseArgs, ...safeArgs];

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      const send = (type: string, data: string) => {
        try {
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify({ type, data })}\n\n`)
          );
        } catch {
          // controller already closed
        }
      };

      send("info", `$ ${def.bin} ${fullArgs.join(" ")}`);

      const child = spawn(def.bin, fullArgs, {
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      child.stdout.on("data", (chunk: Buffer) =>
        send("out", chunk.toString())
      );
      child.stderr.on("data", (chunk: Buffer) =>
        send("err", chunk.toString())
      );
      child.on("close", (code: number | null) => {
        send("exit", String(code ?? 0));
        try { controller.close(); } catch { /* already closed */ }
      });
      child.on("error", (err: Error) => {
        send("err", `Process error: ${err.message}`);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

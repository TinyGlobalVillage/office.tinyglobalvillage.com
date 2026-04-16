/**
 * server-broadcast.ts
 * Module-level singleton that streams all PM2 logs and broadcasts
 * them to any subscribers (SSE clients, log writer, etc.)
 *
 * Uses globalThis so it survives Next.js hot-reloads in dev.
 */
import { EventEmitter } from "events";
import { spawn, ChildProcess } from "child_process";

export type BroadcastEntry = {
  ts: number;           // epoch ms
  text: string;         // raw log line
};

class ServerBroadcast extends EventEmitter {
  private child: ChildProcess | null = null;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  start() {
    if (this.child) return;
    this.spawnLogs();
  }

  private spawnLogs() {
    try {
      const child = spawn("pm2", ["logs", "--raw", "--timestamp", "HH:mm:ss"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.child = child;

      const onLine = (chunk: Buffer) => {
        const lines = chunk.toString().split("\n");
        for (const raw of lines) {
          const text = raw.replace(/\r/g, "").trimEnd();
          if (!text) continue;
          const entry: BroadcastEntry = { ts: Date.now(), text };
          this.emit("line", entry);
        }
      };

      child.stdout?.on("data", onLine);
      child.stderr?.on("data", onLine);

      child.on("close", () => {
        this.child = null;
        // Restart after 3s
        this.retryTimeout = setTimeout(() => this.spawnLogs(), 3000);
      });

      child.on("error", () => {
        this.child = null;
        this.retryTimeout = setTimeout(() => this.spawnLogs(), 3000);
      });
    } catch {
      this.retryTimeout = setTimeout(() => this.spawnLogs(), 5000);
    }
  }
}

// Singleton via globalThis (survives Next.js HMR)
declare global {
  // eslint-disable-next-line no-var
  var __tgvBroadcast: ServerBroadcast | undefined;
}

export const broadcast: ServerBroadcast =
  globalThis.__tgvBroadcast ??
  (globalThis.__tgvBroadcast = new ServerBroadcast());

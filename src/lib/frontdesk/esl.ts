/**
 * Minimal ESL (Event Socket Library) client for FreeSWITCH. Only implements
 * the subset Front Desk needs:
 *   - connect + auth to localhost:8021
 *   - `api` / `bgapi` command send (originate, uuid_bridge, uuid_kill)
 *   - no event subscriptions (Telnyx webhooks already carry state)
 *
 * Kept dependency-free on purpose; ESL's wire protocol is simple enough that
 * pulling in `modesl` is overkill.
 */
import net from "node:net";

export class EslNotConfigured extends Error {
  constructor() {
    super("ESL not configured — set FRONTDESK_ESL_PASSWORD.");
    this.name = "EslNotConfigured";
  }
}

type EslEnv = {
  host: string;
  port: number;
  password: string;
};

function readEslEnv(): EslEnv | null {
  const password = process.env.FRONTDESK_ESL_PASSWORD?.trim();
  if (!password) return null;
  return {
    host: process.env.FRONTDESK_ESL_HOST?.trim() || "127.0.0.1",
    port: Number(process.env.FRONTDESK_ESL_PORT ?? 8021),
    password,
  };
}

export function isEslConfigured(): boolean {
  return readEslEnv() !== null;
}

type EslResponse = {
  headers: Record<string, string>;
  body: string;
};

function parseChunks(buf: Buffer): { messages: EslResponse[]; rest: Buffer } {
  const messages: EslResponse[] = [];
  let rest = buf;
  // Split on the double CRLF that terminates each message's headers.
  while (true) {
    const idx = rest.indexOf("\n\n");
    if (idx === -1) break;
    const headerRaw = rest.subarray(0, idx).toString("utf8");
    const headers: Record<string, string> = {};
    for (const line of headerRaw.split("\n")) {
      const sep = line.indexOf(":");
      if (sep < 0) continue;
      headers[line.slice(0, sep).trim().toLowerCase()] = line.slice(sep + 1).trim();
    }
    const contentLen = Number(headers["content-length"] ?? 0);
    const afterHeaders = rest.subarray(idx + 2);
    if (afterHeaders.length < contentLen) break;
    const body = afterHeaders.subarray(0, contentLen).toString("utf8");
    messages.push({ headers, body });
    rest = afterHeaders.subarray(contentLen);
  }
  return { messages, rest };
}

export async function eslCommand(command: string): Promise<string> {
  const env = readEslEnv();
  if (!env) throw new EslNotConfigured();

  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host: env.host, port: env.port });
    let buf = Buffer.alloc(0);
    let authed = false;
    let finished = false;
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      sock.destroy();
      reject(new Error("ESL command timed out after 8s"));
    }, 8000);

    sock.on("error", (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      reject(err);
    });

    sock.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      const { messages, rest } = parseChunks(buf);
      buf = rest;
      for (const msg of messages) {
        const type = msg.headers["content-type"];
        if (!authed && type === "auth/request") {
          sock.write(`auth ${env.password}\n\n`);
          continue;
        }
        if (!authed && type === "command/reply" && msg.headers["reply-text"]?.startsWith("+OK")) {
          authed = true;
          sock.write(`api ${command}\n\n`);
          continue;
        }
        if (authed && type === "api/response") {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          sock.end();
          resolve(msg.body);
          return;
        }
        if (!authed && type === "command/reply") {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          sock.destroy();
          reject(new Error(`ESL auth failed: ${msg.headers["reply-text"] ?? "unknown"}`));
          return;
        }
      }
    });
  });
}

/**
 * Originate a call from FreeSWITCH — used when the incoming-call popup's
 * "Accept" wires the bridge over a different leg. Typical form:
 *   originate {ignore_early_media=true}user/alice &bridge(sofia/gateway/telnyx/<dst>)
 */
export async function originateBridge(params: {
  aleg: string;   // e.g. "user/alice"
  bleg: string;   // e.g. "sofia/gateway/telnyx/+15551234567"
  callerId: string;
}): Promise<string> {
  const cmd = `originate {origination_caller_id_number=${params.callerId}}${params.aleg} &bridge(${params.bleg})`;
  return eslCommand(cmd);
}

export async function hangupUuid(uuid: string): Promise<string> {
  return eslCommand(`uuid_kill ${uuid}`);
}

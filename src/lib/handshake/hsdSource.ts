// hsd-backed chain source — speaks the standard Handshake daemon HTTP API.
//
// Works unchanged against three things, which is the point:
//   · a public hsd node (the default, so the tile has data on day one)
//   · Gio's own hsd once he stands one up (change the URL, nothing else)
//   · a node behind an API key (hsd uses HTTP basic with an empty username)
//
// Two hsd surfaces are used:
//   GET  /coin/address/:addr   → the address's unspent coins (needs --index-address)
//   POST /  {method,params}    → JSON-RPC; `getnameinfo` for a name's state
//
// Nothing here can spend. hsd's spending endpoints live on the *wallet* server
// (a different port, a different daemon); this module never talks to it.

import "server-only";
import {
  RENEWAL_WINDOW_BLOCKS,
  TRANSFER_LOCKUP_BLOCKS,
  blocksToIso,
  type HnsAddressBalance,
  type HnsChainSource,
  type HnsNameInfo,
} from "./types";

const TIMEOUT_MS = 12_000;

function authHeaders(apiKey?: string): Record<string, string> {
  if (!apiKey) return {};
  // hsd's convention: basic auth, empty username, API key as the password.
  const basic = Buffer.from(`:${apiKey}`).toString("base64");
  return { Authorization: `Basic ${basic}` };
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await run(ctl.signal);
  } finally {
    clearTimeout(timer);
  }
}

export function createHsdSource(baseUrl: string, apiKey?: string): HnsChainSource {
  const base = baseUrl.replace(/\/+$/, "");

  async function rpc<T>(method: string, params: unknown[]): Promise<T> {
    const res = await withTimeout((signal) =>
      fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(apiKey) },
        body: JSON.stringify({ method, params }),
        signal,
        cache: "no-store",
      }),
    );
    if (!res.ok) throw new Error(`hsd ${method} → HTTP ${res.status}`);
    const body = (await res.json()) as { result?: T; error?: { message?: string } | null };
    if (body.error) throw new Error(body.error.message || `hsd ${method} failed`);
    return body.result as T;
  }

  async function rest<T>(path: string): Promise<T> {
    const res = await withTimeout((signal) =>
      fetch(`${base}${path}`, { headers: authHeaders(apiKey), signal, cache: "no-store" }),
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  return {
    kind: "hsd",
    label: base,

    async height() {
      const info = await rest<{ chain?: { height?: number } }>("/");
      const h = info?.chain?.height;
      if (typeof h !== "number") throw new Error("node returned no chain height");
      return h;
    },

    async balance(addresses) {
      // Sequential, not parallel: a public node is somebody else's goodwill and
      // this list is six addresses at most.
      const out: HnsAddressBalance[] = [];
      for (const address of addresses) {
        try {
          const coins = await rest<Array<{ value?: number }>>(
            `/coin/address/${encodeURIComponent(address)}`,
          );
          out.push({
            address,
            doos: coins.reduce((sum, c) => sum + (c.value ?? 0), 0),
            coins: coins.length,
          });
        } catch (e) {
          // A malformed address makes hsd 500. Surfacing that is the feature:
          // paste the address here BEFORE you paste it into a withdrawal form.
          out.push({
            address,
            doos: 0,
            coins: 0,
            error: e instanceof Error ? e.message : "unreadable",
          });
        }
      }
      return out;
    },

    async nameInfo(name, tipHeight) {
      type Raw = {
        info: null | {
          name?: string;
          state?: string;
          height?: number;
          renewal?: number;
          transfer?: number;
          data?: string;
          owner?: { hash?: string; index?: number };
          stats?: { blocksUntilExpire?: number; blocksUntilValidFinalize?: number };
        };
      };
      const raw = await rpc<Raw>("getnameinfo", [name]);
      const info = raw?.info ?? null;

      if (!info) {
        return {
          name,
          state: "UNREGISTERED",
          owned: false,
          renewalHeight: null,
          expiryHeight: null,
          blocksUntilExpiry: null,
          expiresAt: null,
          transferHeight: null,
          finalizeHeight: null,
          finalizeReady: false,
          recordHex: null,
        } satisfies HnsNameInfo;
      }

      const renewalHeight = typeof info.renewal === "number" ? info.renewal : null;
      const expiryHeight = renewalHeight === null ? null : renewalHeight + RENEWAL_WINDOW_BLOCKS;

      // Prefer hsd's own arithmetic when it offers it; fall back to ours so a
      // node built without stats still gives an honest countdown.
      const blocksUntilExpiry =
        typeof info.stats?.blocksUntilExpire === "number"
          ? info.stats.blocksUntilExpire
          : expiryHeight === null
            ? null
            : expiryHeight - tipHeight;

      // hsd reports transfer:0 for "no transfer pending", not null.
      const transferHeight = info.transfer && info.transfer > 0 ? info.transfer : null;
      const finalizeHeight =
        transferHeight === null ? null : transferHeight + TRANSFER_LOCKUP_BLOCKS;

      return {
        name: info.name ?? name,
        state: info.state ?? "UNKNOWN",
        owned: (info.state ?? "") === "CLOSED" && Boolean(info.owner?.hash),
        renewalHeight,
        expiryHeight,
        blocksUntilExpiry,
        expiresAt: blocksUntilExpiry === null ? null : blocksToIso(blocksUntilExpiry),
        transferHeight,
        finalizeHeight,
        finalizeReady: finalizeHeight !== null && tipHeight >= finalizeHeight,
        recordHex: info.data ? info.data : null,
      } satisfies HnsNameInfo;
    },
  };
}

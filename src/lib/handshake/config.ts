// Office-side config for the Villagers → Handshake tile.
//
// Holds ADDRESSES and NAMES — public identifiers, all of them. It holds no
// seed phrase, no xpub-derived spending path, no key material of any kind,
// and there is nowhere in this codebase that could use one if it did.
//
// Lives beside the other Office-owned runtime configs (data/keycloak,
// data/mesh-vpn) rather than in Postgres: it is operator config, not tenant
// data, and it should survive a database being down.

import "server-only";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** A coin the tile watches. Deposit-only — see `withdrawalsEnabled`. */
export type HandshakeCoin = {
  /** Ticker, uppercase. Also the ADDM row's identity. */
  symbol: string;
  name: string;
  /** Decimal places for display (HNS 6, BTC 8). */
  decimals: number;
  /** Receive addresses you control. The first is the one shown with the QR. */
  addresses: string[];
  /**
   * "hsd" = balance is read live from the chain source.
   * "none" = Office shows the deposit address but cannot read a balance —
   * honest, and better than inventing a number for a chain we can't see.
   */
  source: "hsd" | "none";
  note?: string;
};

export type HandshakeConfig = {
  /**
   * Structurally false. Office ships no signer, so there is no code path a
   * `true` here could reach. It is written down anyway so that anyone who
   * flips it discovers they must also build a signer — and stops to think
   * about whether Office should ever hold a key. (It should not.)
   */
  withdrawalsEnabled: false;
  /** hsd REST/RPC base URL. Swap for your own node; nothing else changes. */
  hsdUrl: string;
  /** Optional hsd API key. Public nodes need none. */
  hsdApiKey?: string;
  coins: HandshakeCoin[];
  /** TLDs to watch. Bare labels — no leading or trailing dot. */
  names: string[];
};

export const HANDSHAKE_CONFIG_PATH =
  process.env.HANDSHAKE_CONFIG_PATH ?? join(process.cwd(), "data/handshake/handshake.json");

/** A public, fully-synced hsd node — so the tile has data before Gio runs his own. */
export const DEFAULT_HSD_URL = "https://api.handshakeapi.com/hsd";

export const SEED_CONFIG: HandshakeConfig = {
  withdrawalsEnabled: false,
  hsdUrl: DEFAULT_HSD_URL,
  coins: [
    {
      symbol: "HNS",
      name: "Handshake",
      decimals: 6,
      addresses: [],
      source: "hsd",
      note: "Paste the receive address from your wallet. Office reads it; it never spends it.",
    },
    {
      symbol: "BTC",
      name: "Bitcoin",
      decimals: 8,
      addresses: [],
      source: "none",
      note: "Deposit address only — no Bitcoin chain source is wired.",
    },
  ],
  // The six TLDs held at Namebase as of 2026-09-01, pending migration to a
  // self-custodied wallet before the sunset.namebase.io close on 2026-10-01.
  names: [
    "folkbazaar",
    "nevloproject",
    "refusalism",
    "refusionist",
    "talismanic",
    "tinyglobalvillage",
  ],
};

function normalizeName(raw: string): string {
  return raw.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
}

/** Coerce anything read off disk (or posted by a client) into a valid config. */
export function normalizeConfig(input: unknown): HandshakeConfig {
  const raw = (input ?? {}) as Partial<HandshakeConfig>;
  const coins = Array.isArray(raw.coins) ? raw.coins : SEED_CONFIG.coins;

  return {
    // Never trust the payload on this one — the whole safety story rests on it.
    withdrawalsEnabled: false,
    hsdUrl: typeof raw.hsdUrl === "string" && raw.hsdUrl.trim() ? raw.hsdUrl.trim() : DEFAULT_HSD_URL,
    hsdApiKey: typeof raw.hsdApiKey === "string" && raw.hsdApiKey ? raw.hsdApiKey : undefined,
    coins: coins
      .filter((c): c is HandshakeCoin => Boolean(c && typeof c.symbol === "string"))
      .map((c) => ({
        symbol: c.symbol.trim().toUpperCase(),
        name: typeof c.name === "string" && c.name.trim() ? c.name.trim() : c.symbol,
        decimals: Number.isFinite(c.decimals) ? Math.max(0, Math.min(18, Number(c.decimals))) : 8,
        addresses: Array.isArray(c.addresses)
          ? [...new Set(c.addresses.map((a) => String(a).trim()).filter(Boolean))]
          : [],
        source: c.source === "hsd" ? "hsd" : "none",
        note: typeof c.note === "string" && c.note.trim() ? c.note.trim() : undefined,
      })),
    names: [
      ...new Set(
        (Array.isArray(raw.names) ? raw.names : SEED_CONFIG.names)
          .map((n) => normalizeName(String(n)))
          .filter(Boolean),
      ),
    ].sort(),
  };
}

export function readHandshakeConfig(): HandshakeConfig {
  try {
    return normalizeConfig(JSON.parse(readFileSync(HANDSHAKE_CONFIG_PATH, "utf8")));
  } catch {
    // Missing or corrupt file → the seed. The tile is readable on first open
    // with no setup step, and a bad write can never lock the operator out.
    return normalizeConfig(SEED_CONFIG);
  }
}

export function writeHandshakeConfig(next: HandshakeConfig): HandshakeConfig {
  const clean = normalizeConfig(next);
  mkdirSync(dirname(HANDSHAKE_CONFIG_PATH), { recursive: true });
  writeFileSync(HANDSHAKE_CONFIG_PATH, `${JSON.stringify(clean, null, 2)}\n`, "utf8");
  return clean;
}

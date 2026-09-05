// Villagers → Handshake tile backend. READ-ONLY against the chain.
//
// GET  → config + live chain readings (tip height, per-coin balances, per-name
//        state/expiry/transfer) + a QR data-URL for each coin's first address.
// PUT  → save the operator config (addresses, watched names, node URL).
//
// There is no POST that moves anything, because Office holds no keys. The one
// write this file performs is to a JSON config file on the Office box.
import { type NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import {
  normalizeConfig,
  readHandshakeConfig,
  writeHandshakeConfig,
  type HandshakeConfig,
} from "@/lib/handshake/config";
import { createHsdSource } from "@/lib/handshake/hsdSource";
import { doosToHns, type HnsAddressBalance, type HnsNameInfo } from "@/lib/handshake/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CoinReading = {
  symbol: string;
  name: string;
  decimals: number;
  source: "hsd" | "none";
  note?: string;
  addresses: HnsAddressBalance[];
  /** Total across every address, in whole coins. null when unreadable. */
  total: number | null;
  /** data:image/png;base64 QR of the first address, for phone-side deposits. */
  qr: string | null;
};

async function qrFor(text: string): Promise<string | null> {
  if (!text) return null;
  try {
    return await QRCode.toDataURL(text, { margin: 1, width: 220, errorCorrectionLevel: "M" });
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const config = readHandshakeConfig();
  const source = createHsdSource(config.hsdUrl, config.hsdApiKey);

  // One failure must not blank the whole tile: the deposit addresses are the
  // part Gio needs today, and they don't depend on the node answering.
  let height: number | null = null;
  let chainError: string | null = null;
  try {
    height = await source.height();
  } catch (e) {
    chainError = e instanceof Error ? e.message : "chain source unreachable";
  }

  const coins: CoinReading[] = [];
  for (const coin of config.coins) {
    const live = coin.source === "hsd" && height !== null;
    const addresses: HnsAddressBalance[] = live
      ? await source.balance(coin.addresses)
      : coin.addresses.map((address) => ({ address, doos: 0, coins: 0 }));
    const readable = live && addresses.every((a) => !a.error);
    coins.push({
      symbol: coin.symbol,
      name: coin.name,
      decimals: coin.decimals,
      source: coin.source,
      note: coin.note,
      addresses,
      total: readable ? doosToHns(addresses.reduce((s, a) => s + a.doos, 0)) : null,
      qr: await qrFor(coin.addresses[0] ?? ""),
    });
  }

  const names: Array<HnsNameInfo | { name: string; error: string }> = [];
  if (height !== null) {
    for (const name of config.names) {
      try {
        names.push(await source.nameInfo(name, height));
      } catch (e) {
        names.push({ name, error: e instanceof Error ? e.message : "lookup failed" });
      }
    }
  }

  return NextResponse.json({
    config: { ...config, hsdApiKey: config.hsdApiKey ? "set" : undefined },
    height,
    chainError,
    coins,
    names,
    readAt: new Date().toISOString(),
  });
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Preserve a stored API key when the client echoes back the "set" sentinel
  // rather than the secret itself (the GET never hands the real one out).
  const current = readHandshakeConfig();
  const incoming = body as Partial<HandshakeConfig>;
  const merged = normalizeConfig({
    ...incoming,
    hsdApiKey:
      typeof incoming.hsdApiKey === "string" && incoming.hsdApiKey !== "set"
        ? incoming.hsdApiKey
        : current.hsdApiKey,
  });

  const saved = writeHandshakeConfig(merged);
  logHardeningAction({
    action: "handshake.config.save",
    target: "villagers/handshake",
    user: gate.username,
    success: true,
    details: { names: saved.names.length, coins: saved.coins.map((c) => c.symbol) },
  });

  return NextResponse.json({ ok: true, config: { ...saved, hsdApiKey: saved.hsdApiKey ? "set" : undefined } });
}

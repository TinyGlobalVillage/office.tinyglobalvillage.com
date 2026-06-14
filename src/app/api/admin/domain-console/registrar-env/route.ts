// Admin endpoint for the Domain Console registrar-environment switch (Horizon
// test vs Live). Writes the platform-wide runtime config file that every DC host
// reads in getContext, so one toggle governs the whole platform without a restart.
//
// The file shape mirrors @tgv/module-domain-console server/registrar-config.ts
// (the canonical READER). Office writes it directly (its own config-file
// convention) — the reader validates defensively and falls back to Horizon, so a
// bad write can never silently send the platform live.
import { type NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

const CONFIG_PATH = "/srv/refusion-core/data/domain-console/registrar-env.json";
type Env = "horizon" | "live";
type Config = { env: Env; updatedAt?: string; updatedBy?: string };

function readConfig(): Config {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as Partial<Config>;
    if (raw?.env === "live" || raw?.env === "horizon") {
      return { env: raw.env, updatedAt: raw.updatedAt, updatedBy: raw.updatedBy };
    }
  } catch {
    /* missing/unreadable → safe default */
  }
  return { env: "horizon" };
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json(readConfig());
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  let body: { env?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body → 400 below */
  }
  const env: Env | null = body.env === "live" || body.env === "horizon" ? body.env : null;
  if (!env) {
    return NextResponse.json({ error: "env must be 'horizon' or 'live'" }, { status: 400 });
  }

  const prev = readConfig();
  const next: Config = { env, updatedAt: new Date().toISOString(), updatedBy: gate.username };
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
  } catch (e) {
    logHardeningAction({
      action: "domain-console.registrar-env.set",
      target: env,
      user: gate.username,
      success: false,
      details: { error: e instanceof Error ? e.message : String(e) },
    });
    return NextResponse.json({ error: "Could not write the config file." }, { status: 500 });
  }

  logHardeningAction({
    action: "domain-console.registrar-env.set",
    target: env,
    user: gate.username,
    success: true,
    details: { from: prev.env, to: env },
  });
  return NextResponse.json(next);
}

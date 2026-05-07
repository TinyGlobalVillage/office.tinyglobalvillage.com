import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

const CONFIG_PATH = "/srv/refusion-core/logs/tgv-office/automations-config.json";

interface Automation {
  id: string;
  title: string;
  category: string;
  enabled: boolean;
  schedule?: string;
  threshold?: number;
  thresholdUsd?: number;
  leadDays?: number;
  recipients: string[];
  readMeId?: string;
  trigger?: string;
  lastRun?: string | null;
  lastFired?: string | null;
}

interface ConfigFile {
  version: number;
  automations: Automation[];
}

async function readConfig(): Promise<ConfigFile> {
  const raw = await fs.readFile(CONFIG_PATH, "utf8");
  return JSON.parse(raw);
}

async function writeConfig(cfg: ConfigFile): Promise<void> {
  const tmp = `${CONFIG_PATH}.tmp.${process.pid}`;
  await fs.writeFile(tmp, JSON.stringify(cfg, null, 2), "utf8");
  await fs.rename(tmp, CONFIG_PATH);
}

export async function GET() {
  try {
    const cfg = await readConfig();
    return NextResponse.json(cfg);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as { id: string; patch: Partial<Automation> };
  const cfg = await readConfig();
  const idx = cfg.automations.findIndex((a) => a.id === body.id);
  if (idx === -1) {
    return NextResponse.json({ error: `Automation ${body.id} not found` }, { status: 404 });
  }
  cfg.automations[idx] = { ...cfg.automations[idx], ...body.patch };
  await writeConfig(cfg);
  return NextResponse.json({ ok: true, automation: cfg.automations[idx] });
}

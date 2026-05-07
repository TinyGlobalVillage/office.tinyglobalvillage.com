// GET /api/backups/history
// Returns the full manifest history (one entry per backup run, all tiers).
// Used by the BackupsControlModal history table.

import { NextResponse } from "next/server";
import { promises as fs } from "fs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MANIFEST_PATH = "/srv/refusion-core/clients/office.tinyglobalvillage.com/data/backups/manifest.json";
const RESTORE_TEST_PATH = "/srv/refusion-core/clients/office.tinyglobalvillage.com/data/backups/restore-test-history.json";

async function readJsonl(p: string): Promise<unknown[]> {
  try {
    const text = await fs.readFile(p, "utf8");
    return text.split("\n").filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter((x) => x !== null);
  } catch { return []; }
}

export async function GET() {
  const manifest = await readJsonl(MANIFEST_PATH);
  const restoreTest = await readJsonl(RESTORE_TEST_PATH);

  // Sort newest first
  const sortByTimestamp = (a: { timestamp?: string }, b: { timestamp?: string }) =>
    (b.timestamp ?? "").localeCompare(a.timestamp ?? "");

  return NextResponse.json({
    runs: (manifest as Array<{ timestamp?: string }>).sort(sortByTimestamp),
    restoreTests: (restoreTest as Array<{ timestamp?: string }>).sort(sortByTimestamp),
  });
}

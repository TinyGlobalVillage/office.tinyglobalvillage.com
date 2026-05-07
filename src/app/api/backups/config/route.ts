// PATCH /api/backups/config
// Body: { retention?: {tier1?, tier2?, tier4?}, idleAlert?: {...} }
// Updates data/backups/config.json with the supplied fields (deep-merged into
// the existing config). Backup scripts re-read this file at the start of
// each run, so changes take effect on the next scheduled or run-now invocation.

import { NextResponse } from "next/server";
import { promises as fs } from "fs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CONFIG_PATH = "/srv/refusion-core/clients/office.tinyglobalvillage.com/data/backups/config.json";

type DeepObj = { [key: string]: unknown };

function deepMerge(base: DeepObj, patch: DeepObj): DeepObj {
  const out: DeepObj = { ...base };
  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    const bv = out[k];
    if (pv && typeof pv === "object" && !Array.isArray(pv) &&
        bv && typeof bv === "object" && !Array.isArray(bv)) {
      out[k] = deepMerge(bv as DeepObj, pv as DeepObj);
    } else {
      out[k] = pv;
    }
  }
  return out;
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  // Allow only retention + idleAlert mutations from UI
  const allowed: DeepObj = {};
  if (body.retention) allowed.retention = body.retention;
  if (body.idleAlert) allowed.idleAlert = body.idleAlert;
  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const current = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8")) as DeepObj;
  const next = deepMerge(current, allowed);
  await fs.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
  return NextResponse.json({ config: next });
}

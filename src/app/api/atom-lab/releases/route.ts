/**
 * Publishing an atom — the step that takes a spec out of Office.
 *
 * A saved spec is a draft: it lives in Office's data/atom-lab/ and nobody else
 * can see it. Publishing writes it to tgv_db, and every tenant picks it up on
 * its next render, without a build and without a deploy. That is a lot of reach
 * for one button, so this route is ADMIN-ONLY and audited, and every publish is
 * kept as a numbered release that `revert` can point back at.
 *
 * GET  ?key=<key>   → { releases }        (all atoms when key is omitted)
 * POST { action: "publish",   key, spec, note? } → { version }
 * POST { action: "revert",    key, version }     → { ok }
 * POST { action: "unpublish", key }              → { ok }   (back to the baked spec)
 *
 * The table lives at sql/atom-specs.sql; the queries at
 * @tgv/module-component-library/atoms/store.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { pgPool } from "@/lib/pg-pool";
import { isValidAtomKey } from "@/lib/atom-lab/store";
import {
  listReleases,
  publishSpec,
  setLive,
  unpublish,
} from "@tgv/module-component-library/atoms/store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (key && !isValidAtomKey(key)) {
    return NextResponse.json({ error: "invalid key" }, { status: 400 });
  }
  try {
    return NextResponse.json({ releases: await listReleases(pgPool, key || undefined) });
  } catch (err) {
    // A missing table is the common case here — the DDL is applied by hand.
    return NextResponse.json({ releases: [], error: String(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const user = gate.username;

  let body: { action?: string; key?: string; spec?: unknown; note?: string; version?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const key = (body.key ?? "").trim();
  if (!isValidAtomKey(key)) return NextResponse.json({ error: "invalid key" }, { status: 400 });

  const audit = (action: string, success: boolean, details: Record<string, unknown>) =>
    logHardeningAction({ action: `atom.${action}`, target: key, user, success, details });

  try {
    switch (body.action) {
      case "publish": {
        const note = typeof body.note === "string" ? body.note.slice(0, 200) : null;
        const { version } = await publishSpec(pgPool, { key, spec: body.spec, author: user, note });
        audit("publish", true, { version, note });
        return NextResponse.json({ version });
      }
      case "revert": {
        const version = Number(body.version);
        if (!Number.isInteger(version) || version < 1) {
          return NextResponse.json({ error: "invalid version" }, { status: 400 });
        }
        const ok = await setLive(pgPool, key, version);
        audit("revert", ok, { version });
        return ok
          ? NextResponse.json({ ok })
          : NextResponse.json({ error: "no such release" }, { status: 404 });
      }
      case "unpublish": {
        await unpublish(pgPool, key);
        audit("unpublish", true, {});
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (err) {
    audit(body.action ?? "unknown", false, { error: String(err) });
    return NextResponse.json({ error: String(err) }, { status: 503 });
  }
}

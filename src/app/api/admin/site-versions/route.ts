/**
 * Client Versions — the operator's read of every site's publish history, and
 * the one button that puts an old version back.
 *
 * The history itself is written by a trigger on `page_models` /
 * `content_overrides` (sql/site-releases.sql), not by this route and not by
 * any app: publishing from tinyglobalvillage.com, from refusionist's mounted
 * editor kit, or from the migration engine all land in the same ledger without
 * knowing it exists. This route only reads it — and restores from it.
 *
 * GET                                → { sites }     every site with history
 * GET ?site=guardians                → { releases }  that site's versions
 * GET ?site=&kind=&ref=&version=     → { release }   one version, with payload
 * POST { action: "restore", site, kind, ref, version } → { ok, version }
 * POST { action: "note",    site, kind, ref, version, note } → { ok }
 *
 * Admin-only and audited, like the atom publish route it is modelled on: a
 * restore repaints a live public site with no build and no deploy.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { pgPool } from "@/lib/pg-pool";
import {
  listSites,
  listReleases,
  getRelease,
  setNote,
  restore,
  type ReleaseKind,
} from "@tgv/module-page-editor/kit/server/releases";

export const runtime = "nodejs";

/** Free-text site keys and refs come off the wire; keep them boring. */
const SITE_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const REF_RE = /^[a-z0-9-]{2,8}\/[a-zA-Z0-9/_.:-]{1,200}$/;

function isKind(v: unknown): v is ReleaseKind {
  return v === "page" || v === "chrome";
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const q = req.nextUrl.searchParams;
  const site = (q.get("site") ?? "").trim();

  try {
    if (!site) return NextResponse.json({ sites: await listSites(pgPool) });
    if (!SITE_RE.test(site)) {
      return NextResponse.json({ error: "invalid site" }, { status: 400 });
    }

    const kind = q.get("kind");
    const ref = q.get("ref");
    const version = Number(q.get("version"));

    // A version pins one release — that is the preview, so it carries the payload.
    if (isKind(kind) && ref && Number.isInteger(version) && version > 0) {
      if (!REF_RE.test(ref)) return NextResponse.json({ error: "invalid ref" }, { status: 400 });
      const release = await getRelease(pgPool, { site, kind, ref, version });
      return release
        ? NextResponse.json({ release })
        : NextResponse.json({ error: "no such release" }, { status: 404 });
    }

    if (ref && !REF_RE.test(ref)) {
      return NextResponse.json({ error: "invalid ref" }, { status: 400 });
    }
    return NextResponse.json({
      releases: await listReleases(pgPool, { site, ref: ref ?? undefined }),
    });
  } catch (err) {
    // The DDL is applied by hand, so "no such table" is the expected first
    // answer on a database that has not had sql/site-releases.sql run on it.
    return NextResponse.json({ sites: [], releases: [], error: String(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const user = gate.username;

  let body: {
    action?: string;
    site?: string;
    kind?: string;
    ref?: string;
    version?: number;
    note?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const site = (body.site ?? "").trim();
  const ref = (body.ref ?? "").trim();
  const kind = body.kind;
  const version = Number(body.version);

  if (!SITE_RE.test(site)) return NextResponse.json({ error: "invalid site" }, { status: 400 });
  if (!isKind(kind)) return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  if (!REF_RE.test(ref)) return NextResponse.json({ error: "invalid ref" }, { status: 400 });
  if (!Number.isInteger(version) || version < 1) {
    return NextResponse.json({ error: "invalid version" }, { status: 400 });
  }

  const audit = (action: string, success: boolean, details: Record<string, unknown>) =>
    logHardeningAction({
      action: `site.${action}`,
      target: `${site} ${kind} ${ref}`,
      user,
      success,
      details,
    });

  try {
    switch (body.action) {
      case "restore": {
        const result = await restore(pgPool, { site, kind, ref, version, actor: user });
        audit("restore", result.ok, result.ok ? { version } : { version, reason: result.reason });
        if (result.ok) return NextResponse.json({ ok: true, version: result.version });
        return NextResponse.json(
          { error: result.reason },
          { status: result.reason === "not_found" ? 404 : 409 },
        );
      }
      case "note": {
        const note =
          typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 200) : null;
        await setNote(pgPool, { site, kind, ref, version, note });
        audit("note", true, { version, note });
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

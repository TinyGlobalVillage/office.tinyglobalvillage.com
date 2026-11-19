// /api/hardening/media-folder — read + mutate the /media/ (CDN) access policy, and
// apply it to the live nginx. The GUI half of audit 2026-11-07 #29 (HCM for the
// /media/ allow-list). Admin-only; every mutation is audit-logged.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import {
  snapshot,
  addFolder,
  removeFolder,
  setMode,
  applyPolicy,
  isValidFolderName,
} from "@/lib/system/nginx-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LISTS = ["privateFolders", "publicCabinets", "publicRoots"] as const;
type ListKey = (typeof LISTS)[number];

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ ok: true, snapshot: snapshot() });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const action = String(body.action || "");
  const by = auth.username;

  try {
    if (action === "add-folder" || action === "remove-folder") {
      const list = String(body.list || "") as ListKey;
      const name = String(body.name || "");
      if (!LISTS.includes(list)) return NextResponse.json({ ok: false, error: "bad list" }, { status: 400 });
      if (!isValidFolderName(name)) return NextResponse.json({ ok: false, error: "invalid folder name" }, { status: 400 });
      if (action === "add-folder") addFolder(list, name);
      else removeFolder(list, name);
      logHardeningAction({ action: `media-folder.${action}`, target: `${list}/${name}`, user: by, success: true });
      return NextResponse.json({ ok: true, action, by, snapshot: snapshot() });
    }

    if (action === "set-mode") {
      const mode = body.mode === "allowlist" ? "allowlist" : "denylist";
      setMode(mode);
      logHardeningAction({ action: "media-folder.set-mode", target: mode, user: by, success: true });
      return NextResponse.json({ ok: true, action, by, snapshot: snapshot() });
    }

    if (action === "apply") {
      const res = await applyPolicy();
      logHardeningAction({
        action: "media-folder.apply",
        target: snapshot().mode,
        user: by,
        success: res.ok,
        details: res.detail,
      });
      return NextResponse.json({ ok: res.ok, action, by, detail: res.detail, snapshot: snapshot() }, { status: res.ok ? 200 : 500 });
    }

    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (err) {
    const detail = (err as Error).message || "error";
    logHardeningAction({ action: `media-folder.${action || "unknown"}`, user: by, success: false, details: detail });
    return NextResponse.json({ ok: false, error: detail }, { status: 500 });
  }
}

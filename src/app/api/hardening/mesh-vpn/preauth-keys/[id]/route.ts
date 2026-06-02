// DELETE /api/hardening/mesh-vpn/preauth-keys/[id]
//
// Headscale identifies a preauth key by its `user` + `key` pair (it has no
// stable global id distinct from the secret itself). The route param [id]
// is purely a routing placeholder — we read the actual `user` and `key`
// from the request body OR query string. This avoids putting the key
// secret into the URL path / server access logs.
//
// Accepted shapes:
//   - DELETE …/preauth-keys/abc with JSON body { user, key }
//   - DELETE …/preauth-keys/abc?user=alice&key=… (less preferred — leaks
//     to access logs — but supported for parity with the existing modal
//     UX which only has the key id in hand).
//
// Either way, BOTH `user` and `key` are validated against strict regexes
// before being passed to execFile.

import { type NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";

const execFileP = promisify(execFile);

const USER_RE = /^[a-zA-Z0-9._-]{1,64}$/;
// Headscale preauth keys are 48-char hex (24 bytes). Tolerate a wider range
// in case the format changes — but lock to a safe alphabet that can't
// possibly be interpreted as flags.
const KEY_RE = /^[a-zA-Z0-9]{16,128}$/;

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  // Routing param — used only for audit log target, not for the shell call.
  const { id: routeId } = await ctx.params;

  let user = "";
  let key = "";

  // Try JSON body first.
  try {
    const body = (await req.json()) as { user?: unknown; key?: unknown };
    if (typeof body.user === "string") user = body.user;
    if (typeof body.key === "string") key = body.key;
  } catch {
    // Body was empty or non-JSON — fall through to query params.
  }

  if (!user || !key) {
    const { searchParams } = new URL(req.url);
    user = user || searchParams.get("user") || "";
    key = key || searchParams.get("key") || "";
  }

  if (!USER_RE.test(user)) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }
  if (!KEY_RE.test(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const auditTarget = routeId || key.slice(0, 8);

  try {
    await execFileP(
      "headscale",
      ["preauthkeys", "expire", "-u", user, "-k", key],
      { timeout: 10_000 },
    );
    logHardeningAction({
      action: "mesh-vpn.preauth-key.expire",
      target: auditTarget,
      user: auth.username,
      success: true,
      details: { user, keyPrefix: key.slice(0, 8) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as { code?: number; signal?: string };
    logHardeningAction({
      action: "mesh-vpn.preauth-key.expire",
      target: auditTarget,
      user: auth.username,
      success: false,
      details: {
        user,
        keyPrefix: key.slice(0, 8),
        exitCode: err.code ?? null,
        signal: err.signal ?? null,
      },
    });
    return NextResponse.json(
      { error: "Failed to expire pre-auth key" },
      { status: 500 },
    );
  }
}

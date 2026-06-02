// POST /api/hardening/mesh-vpn/preauth-keys
//
// Body: { user: string, expiration: string }
//
// Generates a Headscale pre-auth key bound to <user> with TTL <expiration>.
// The returned key is one-time — the caller MUST surface it to the operator
// immediately (modal copy-to-clipboard pattern) because it cannot be
// retrieved again afterward (Headscale doesn't expose the secret in `list`).
//
// Inputs are validated strictly:
//   - `user` MUST exist in /etc/headscale/config.yaml's resolved users list
//     (we read it via `headscale users list -o json`, which is the same
//     source headscale itself uses; reading the YAML directly would miss
//     users created via the CLI after deploy).
//   - `expiration` MUST match Go's duration grammar accepted by headscale —
//     e.g. "1h", "24h", "7d" (note: headscale custom-supports "d"). We
//     restrict to the safe subset [0-9]+[smhd].

import { type NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";

const execFileP = promisify(execFile);

const USER_RE = /^[a-zA-Z0-9._-]{1,64}$/;
const DURATION_RE = /^[1-9][0-9]{0,4}(s|m|h|d)$/;

async function listValidUsernames(): Promise<string[]> {
  try {
    const { stdout } = await execFileP(
      "headscale",
      ["users", "list", "-o", "json"],
      { timeout: 5_000 },
    );
    const parsed = JSON.parse(stdout) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(u => (u as { name?: string }).name ?? "")
      .filter((s): s is string => Boolean(s));
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let body: { user?: unknown; expiration?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const user = typeof body.user === "string" ? body.user : "";
  const expiration = typeof body.expiration === "string" ? body.expiration : "";

  if (!USER_RE.test(user)) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }
  if (!DURATION_RE.test(expiration)) {
    return NextResponse.json(
      { error: "Invalid expiration (e.g. '1h', '24h', '7d')" },
      { status: 400 },
    );
  }

  const validUsers = await listValidUsernames();
  if (!validUsers.includes(user)) {
    return NextResponse.json(
      { error: "User not registered with headscale" },
      { status: 400 },
    );
  }

  try {
    // -o json so we get the structured response (key, expiration, …) rather
    // than a human-formatted table.
    const { stdout } = await execFileP(
      "headscale",
      ["preauthkeys", "create", "-u", user, "-e", expiration, "-o", "json"],
      { timeout: 10_000 },
    );
    const parsed = JSON.parse(stdout) as {
      key?: string;
      id?: string;
      expiration?: string;
      created_at?: string;
      reusable?: boolean;
      ephemeral?: boolean;
    };

    if (!parsed.key) {
      logHardeningAction({
        action: "mesh-vpn.preauth-key.create",
        target: user,
        user: auth.username,
        success: false,
        details: "no key field in headscale output",
      });
      return NextResponse.json(
        { error: "Failed to create pre-auth key" },
        { status: 500 },
      );
    }

    logHardeningAction({
      action: "mesh-vpn.preauth-key.create",
      target: user,
      user: auth.username,
      success: true,
      details: {
        expiration,
        keyId: parsed.id ?? null,
        keyExpiresAt: parsed.expiration ?? null,
      },
    });

    return NextResponse.json({
      key: parsed.key,
      id: parsed.id ?? null,
      user,
      createdAt: parsed.created_at ?? null,
      expiresAt: parsed.expiration ?? null,
      reusable: Boolean(parsed.reusable),
      ephemeral: Boolean(parsed.ephemeral),
    });
  } catch (e) {
    const err = e as { code?: number; signal?: string };
    logHardeningAction({
      action: "mesh-vpn.preauth-key.create",
      target: user,
      user: auth.username,
      success: false,
      details: { exitCode: err.code ?? null, signal: err.signal ?? null },
    });
    return NextResponse.json(
      { error: "Failed to create pre-auth key" },
      { status: 500 },
    );
  }
}

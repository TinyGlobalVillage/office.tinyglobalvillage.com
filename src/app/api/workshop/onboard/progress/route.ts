// POST → step reports from workshop-bootstrap.sh running on the NEW Mac. No Office
//        session there — auth is the one-time token issued at onboard start (sha256 +
//        constant-time compare). Two steps carry privileged side effects, both
//        idempotent + audited: ssh-key(ok) installs the Mac's pubkey into admin's
//        authorized_keys; reverse-access(ok) writes the mac-<account> ssh alias and
//        verifies RCS can actually reach the laptop. done(ok) stamps the registry.
// GET  → token-authed helper reads for the script (?want=webport).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { logHardeningAction } from "@/lib/audit-log";
import {
  ACCOUNT_RE, STEPS, type StepId,
  verifyToken, recordStep, readAccount, patchAccount, installPubkey, installMacAlias,
} from "@/lib/workshop-onboard";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string; account?: string; step?: string; status?: string; detail?: string;
    pubkey?: string; meshIp?: string; macUser?: string;
  };
  const account = (body.account || "").trim();
  const step = (body.step || "") as StepId;
  const status = body.status === "ok" ? "ok" : body.status === "run" ? "run" : "fail";
  if (!ACCOUNT_RE.test(account) || !STEPS.includes(step)) {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }
  if (!verifyToken(account, body.token || "")) {
    return NextResponse.json({ ok: false, error: "invalid token" }, { status: 403 });
  }

  let detail = (body.detail || "").slice(0, 300);

  if (step === "ssh-key" && status === "ok" && body.pubkey) {
    const installed = installPubkey(account, String(body.pubkey));
    logHardeningAction({
      action: "workshop.onboard.pubkey",
      target: account, user: `onboard:${account}`, success: installed,
    });
    if (!installed) {
      recordStep(account, step, { status: "fail", detail: "pubkey rejected (ed25519 only)" });
      return NextResponse.json({ ok: false, error: "pubkey rejected" }, { status: 400 });
    }
  }

  if (step === "reverse-access" && status === "ok" && body.meshIp && body.macUser) {
    const res = await installMacAlias(account, String(body.meshIp), String(body.macUser));
    logHardeningAction({
      action: "workshop.onboard.mac-alias",
      target: `${account} → ${body.meshIp}`, user: `onboard:${account}`, success: res.ok,
    });
    if (!res.ok) {
      recordStep(account, step, { status: "fail", detail: res.error });
      return NextResponse.json({ ok: false, error: res.error }, { status: 502 });
    }
    detail = detail || `mac-${account} verified reachable`;
  }

  if (step === "done" && status === "ok") {
    patchAccount(account, { bootstrappedAt: new Date().toISOString() });
    logHardeningAction({ action: "workshop.onboard.done", target: account, user: `onboard:${account}`, success: true });
  }

  recordStep(account, step, { status, detail });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const account = (req.nextUrl.searchParams.get("account") || "").trim();
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!ACCOUNT_RE.test(account) || !verifyToken(account, token)) {
    return NextResponse.json({ ok: false, error: "invalid token" }, { status: 403 });
  }
  if (req.nextUrl.searchParams.get("want") === "webport") {
    return NextResponse.json({ ok: true, webport: readAccount(account)?.webport ?? null });
  }
  return NextResponse.json({ ok: true });
}

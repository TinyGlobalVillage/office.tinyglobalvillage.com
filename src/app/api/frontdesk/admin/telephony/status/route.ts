import { type NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireAdmin } from "@/lib/api-admin";
import { readTelephonyConfig } from "@/lib/frontdesk/telephony-config";

const execFileP = promisify(execFile);

// GET /api/frontdesk/admin/telephony/status
//
// Composite snapshot of the telephony-specific state. The HardeningControlModal
// uses this to render the "stack at a glance" section without making N
// separate calls. RCS-wide system tools (fail2ban, ufw) live at their own
// /api/admin/system/* endpoints — those are imported in parallel by the
// modal but kept separate so future hardening modals can reuse them.
//
// Telephony-specific aspects gathered here:
//   - dialplan auth gate present on user 1001 (read users/1001.xml)
//   - consent IVR WAV exists (recordings dir prompt)
//   - Telnyx billing webhook endpoint configured (env var present?)
//   - GPG recordings keyring present
//   - sip-attack-watch state file last fired
//   - runtime config values
//
// Note: this endpoint never shells out to fail2ban-client or ufw — those
// live in their own RCS-wide endpoints. We compose data from local files
// only here, keeping the modal layout stable even if a system tool is
// temporarily slow.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  // Dialplan auth gate — does user 1001 set sip_authorized=true?
  let dialplanAuthGate = false;
  try {
    const xml = fs.readFileSync(
      "/srv/refusion-core/clients/office.tinyglobalvillage.com/telephony/users/1001.xml",
      "utf8",
    );
    dialplanAuthGate = /name="sip_authorized"\s+value="true"/.test(xml);
  } catch { /* missing or unreadable — treat as off */ }

  // Consent IVR WAV present?
  const consentIvrWavExists = fs.existsSync(
    "/srv/refusion-core/clients/office.tinyglobalvillage.com/telephony/data/prompts/consent-recording.wav",
  );

  // GPG recordings keyring present?
  const gpgKeyringExists = fs.existsSync("/srv/refusion-core/secrets/recordings/pubring.kbx");

  // Telnyx billing alert endpoint configured? Reuses the account-wide
  // TELNYX_PUBLIC_KEY (no separate per-webhook secret) — so "configured"
  // means the public key is present in env.
  const telnyxBillingConfigured = !!process.env.TELNYX_PUBLIC_KEY;

  // sip-attack-watch state.
  let attackWatchState: { lastByteOffset: number; lastFileSize: number; lastAlertedAt: string | null } | null = null;
  try {
    const raw = fs.readFileSync(
      "/srv/refusion-core/clients/office.tinyglobalvillage.com/data/frontdesk/sip-attack-watch-state.json",
      "utf8",
    );
    attackWatchState = JSON.parse(raw);
  } catch { /* never run yet */ }

  // Telnyx gateway state via fs_cli — best-effort; modal renders stale
  // value if this hangs.
  let gatewayRegistered = false;
  let gatewayContact: string | null = null;
  try {
    const eslPass = fs
      .readFileSync(
        "/srv/refusion-core/telephony/install/etc/freeswitch/vars_local.xml",
        "utf8",
      )
      .match(/data="esl_password=([^"]+)"/)?.[1];
    if (eslPass) {
      const { stdout } = await execFileP(
        "sudo",
        [
          "-n",
          "/srv/refusion-core/telephony/install/bin/fs_cli",
          "-P",
          "8021",
          "-p",
          eslPass,
          "-x",
          "sofia status gateway telnyx-tgv-office",
        ],
        { timeout: 5_000 },
      );
      gatewayRegistered = /State\s+REGED/.test(stdout);
      gatewayContact = (stdout.match(/Contact\s+(\S+)/) || [])[1] ?? null;
    }
  } catch { /* fs_cli unavailable, FS down, or sofia stopped */ }

  return NextResponse.json({
    dialplanAuthGate,
    consentIvrWavExists,
    gpgKeyringExists,
    telnyxBillingConfigured,
    gatewayRegistered,
    gatewayContact,
    attackWatchState,
    config: readTelephonyConfig(),
  });
}

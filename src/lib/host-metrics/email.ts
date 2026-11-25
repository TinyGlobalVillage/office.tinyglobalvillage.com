/**
 * Box health — email for CRITICAL alerts (Gio 2026-11-21: "and these alerts will go to my email?").
 * Front Desk gets every alert (alerts.ts); email only the critical ones and their recovery, so a
 * degraded RAID mirror or a failing disk reaches someone who isn't looking at Office.
 * Recipients + switch: host-metrics-config.json (emailCritical, emailRecipients), set in the modal.
 */
import "server-only";
import { logHardeningAction } from "../audit-log";
import { sendMail } from "../email/sendMail";

const OFFICE_URL = process.env.OFFICE_PUBLIC_URL || "https://office.tinyglobalvillage.com";
const PANEL = `${OFFICE_URL}/dashboard/utils?view=box-usage`;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Mail clients drop CSS variables and stylesheets, so the email carries inline hex.
const MAIL = {
  critical: "#ff5c5c", // colour-literal: email inline style, no CSS vars in mail clients
  ok: "#4ade80", // colour-literal: email inline style, no CSS vars in mail clients
  bg: "#0b0b10", // colour-literal: email inline style, no CSS vars in mail clients
  text: "#e8e8ef", // colour-literal: email inline style, no CSS vars in mail clients
  title: "#fff", // colour-literal: email inline style, no CSS vars in mail clients
};

export async function emailHealthAlert(opts: {
  to: string[];
  host: string;
  check: string;
  kind: "raise" | "recover";
  title: string;
  detail: string;
}): Promise<void> {
  if (!opts.to.length) return;
  const accent = opts.kind === "recover" ? MAIL.ok : MAIL.critical;
  const subject = opts.kind === "recover" ? `RESOLVED: ${opts.title}` : `CRITICAL: ${opts.title}`;
  const lines = [opts.detail, `Box health: ${PANEL}`];
  const html = `<!doctype html><html><body style="margin:0;background:${MAIL.bg};font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:${MAIL.text}">
<div style="max-width:560px;margin:0 auto;padding:28px 24px">
<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${accent};font-weight:700">Tiny Global Village · Box health · ${esc(opts.host)}</div>
<h1 style="font-size:20px;margin:10px 0 18px;color:${MAIL.title}">${esc(opts.title)}</h1>
<div style="border-left:3px solid ${accent};padding-left:14px;font-size:14px">${lines
    .map((l) => `<p style="margin:0 0 12px;line-height:1.5">${esc(l).replace(/(https:\/\/[^\s]+)/g, `<a href="$1" style="color:${accent}">$1</a>`)}</p>`)
    .join("")}</div>
</div></body></html>`;
  try {
    await sendMail({ to: opts.to, subject, text: lines.join("\n\n"), html });
    logHardeningAction({ action: `host-metrics.health.${opts.check}.email.${opts.kind}`, target: opts.to.join(","), user: "rcs", success: true, details: { subject } });
  } catch (err) {
    logHardeningAction({ action: `host-metrics.health.${opts.check}.email.${opts.kind}`, target: opts.to.join(","), user: "rcs", success: false, details: { error: err instanceof Error ? err.message : String(err) } });
  }
}

/**
 * renderTgvEmail — the canonical TGV outbound-email shell.
 *
 * The dark-neon "Village" card from the onboarding welcome email
 * (clients/tinyglobalvillage.com/src/lib/onboarding/buildWelcomeVillagerHtml.ts),
 * factored into ONE reusable wrapper so every email TGV sends looks the same.
 * Pure string builder — zero imports, no `server-only`/`next` — so it's usable
 * from Next API routes (`@/lib/tgv-email`) AND from standalone RCS cron scripts
 * (import by absolute path).
 *
 * Palette + logo are the canonical TGV email brand (amber eyebrow, pink/magenta
 * accents, teal links, near-black card).
 */

export const TGV_EMAIL_BRAND = {
  name: "Tiny Global Village",
  logo: "https://tinyglobalvillage.com/brand/tgv-logo-email.png",
  bg: "#04080b",
  card: "#0a0f14",
  text: "#fff6e0",
  faint: "rgba(255,246,224,.55)",
  pink: "#ff4ecb",
  magenta: "#e34cff",
  amber: "#ffc53d",
  aqua: "#00e4fd",
  teal: "#2dd4bf",
};
const FONT = "Inter,Segoe UI,Helvetica,Arial,sans-serif";

export function escapeEmailHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type TgvEmailOpts = {
  /** Big headline (may contain safe inline HTML, e.g. a colored <span>). */
  heading: string;
  /** Main body — HTML block(s). Caller is responsible for safe content. */
  bodyHtml: string;
  /** Amber eyebrow above the heading. Defaults to the brand name. */
  eyebrow?: string;
  /** Optional magenta pill CTA. */
  cta?: { label: string; url: string };
  /** Optional highlighted address/link box (amber card) under the body. */
  callout?: { label: string; value: string; href?: string };
  /** Footer tagline (after the © line). */
  footNote?: string;
  /** The current year for the © line (pass in from a caller that has a clock). */
  year?: number;
};

export function renderTgvEmail(opts: TgvEmailOpts): string {
  const b = TGV_EMAIL_BRAND;
  const eyebrow = (opts.eyebrow ?? "TINY GLOBAL VILLAGE").toUpperCase();
  const year = opts.year ?? 2026;
  const foot = opts.footNote ?? "a village that cares";

  const calloutRow = opts.callout
    ? `<tr>
            <td align="center" style="padding:20px 36px 4px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:rgba(255,197,61,.06);border:1px solid rgba(255,197,61,.28);border-radius:12px;">
                <tr><td style="padding:14px 18px;font-family:${FONT};">
                  <div style="font-size:10.5px;font-weight:800;letter-spacing:.18em;color:${b.amber};">${escapeEmailHtml(opts.callout.label).toUpperCase()}</div>
                  ${opts.callout.href
                    ? `<a href="${opts.callout.href}" target="_blank" style="font-size:16px;font-weight:700;color:${b.teal};text-decoration:none;word-break:break-all;">${escapeEmailHtml(opts.callout.value)}</a>`
                    : `<div style="font-size:16px;font-weight:700;color:${b.teal};word-break:break-all;">${escapeEmailHtml(opts.callout.value)}</div>`}
                </td></tr>
              </table>
            </td>
          </tr>`
    : "";

  const ctaRow = opts.cta
    ? `<tr>
            <td align="center" style="padding:18px 24px 6px;">
              <a href="${opts.cta.url}" target="_blank" style="display:inline-block;background:${b.magenta};color:#12001a;font-weight:700;font-family:${FONT};text-decoration:none;padding:12px 22px;border-radius:999px;">${escapeEmailHtml(opts.cta.label)}</a>
            </td>
          </tr>`
    : "";

  return `<!doctype html>
<html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background:${b.bg};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${b.bg};padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:560px;max-width:92%;background:${b.card};border:1px solid rgba(255,255,255,.12);border-radius:16px;overflow:hidden;">
          <tr><td align="center" style="padding:28px 24px 8px;">
            <img src="${b.logo}" width="56" height="56" alt="${b.name}" style="display:block;border:0;outline:none;text-decoration:none;border-radius:12px;filter:drop-shadow(0 0 6px ${b.amber});" />
          </td></tr>
          <tr><td align="center" style="padding:10px 24px 0;font-family:${FONT};">
            <div style="font-size:11px;font-weight:800;letter-spacing:.22em;color:${b.amber};">${eyebrow}</div>
          </td></tr>
          <tr><td align="center" style="padding:10px 24px 12px;font-family:${FONT};color:${b.text};">
            <h1 style="margin:0;font-size:26px;line-height:1.3;">${opts.heading}</h1>
          </td></tr>
          <tr><td style="padding:4px 36px 8px;font-family:${FONT};color:${b.text};font-size:14.5px;line-height:1.65;">
            ${opts.bodyHtml}
          </td></tr>
          ${calloutRow}
          ${ctaRow}
          <tr><td align="center" style="padding:10px 36px 24px;font-family:${FONT};color:${b.faint};font-size:12px;line-height:1.6;">
            © ${year} Tiny Global Village · ${foot}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

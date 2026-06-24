// Office host context for @tgv/module-consent emails (access_grant flow).
// The TARGET (tenant owner) approves on their dashboard (appUrl); the REQUESTER (Office admin)
// enters the emailed code back in Office (requesterAppUrl).
import type { MailContext } from "@tgv/module-consent/server";

export const OFFICE_CONSENT_MAIL: MailContext = {
  appUrl: "https://tinyglobalvillage.com",
  brandName: "Tiny Global Village",
  requesterAppUrl: "https://office.tinyglobalvillage.com/dashboard/villagers",
};

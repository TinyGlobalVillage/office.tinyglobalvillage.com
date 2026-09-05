"use client";

// SystemEmailCampaigns — Office's ONE configuration of the shared
// @tgv/module-email-campaigns panel.
//
// It exists because Office reaches this surface from two places: its own
// /dashboard/email-campaigns page and the Modules grid tile. They were two
// separate JSX mounts, and they drifted — the Modules one never gained
// `systemScope`, so the Publish caret (which tenants a campaign is published
// to) and the domain funnel guide were invisible to anyone who arrived that
// way. Gio, 2026-09-01: "the public carrot is not visible on my end on office
// email campaign editor... that DDM should always be available." One component,
// two chromes: the props can no longer disagree.
//
// The domain funnel guide used to mount here as `categoryGuide`. Gio 2026-09-01:
// "Why is the funnel guide on Modules email campaigns, it belongs on its own
// modal on module storefront on office as product funnels" — so it moved to the
// Product Funnels desk, and this panel went back to being only the email
// workbench. What remains of the link is `?campaign=<key>`: the guide's rows are
// still buttons, and they still land on the campaign they send.

import { useState } from "react";
import { EmailCampaignsPanel } from "@tgv/module-email-campaigns";

export default function SystemEmailCampaigns() {
  // Read once, on the client, from the URL the Product Funnels guide links to.
  // A useState initializer (not useSearchParams) deliberately: this file mounts
  // under two different pages, and one of them would then need a Suspense
  // boundary it does not have. The value only ever feeds the panel's load
  // effect, so the server's `undefined` renders identically.
  const [initialKey] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return new URLSearchParams(window.location.search).get("campaign") ?? undefined;
  });

  return (
    // manageMergeFields: the merge-fields gear (Gio 2026-08-31) — to be re-used
    // on the coming forms/newsletters module; one shared registry.
    // systemScope: arms the Publish button's dropdown half AND the per-category
    // audience gear — which TENANTS a campaign is published to.
    <EmailCampaignsPanel
      apiBase="/api/email-campaigns"
      scopeLabel="System"
      assetOrigin="https://tinyglobalvillage.com"
      manageMergeFields
      systemScope
      initialKey={initialKey}
    />
  );
}

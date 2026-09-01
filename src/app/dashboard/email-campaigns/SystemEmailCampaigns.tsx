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

import { EmailCampaignsPanel } from "@tgv/module-email-campaigns";
import TransferFunnelGuide from "@tgv/module-domain-console/components/TransferFunnelGuide";

export default function SystemEmailCampaigns() {
  return (
    // manageMergeFields: the merge-fields gear (Gio 2026-08-31) — to be re-used
    // on the coming forms/newsletters module; one shared registry.
    // systemScope: arms the Publish button's dropdown half AND the per-category
    // audience gear — which TENANTS a campaign is published to.
    // categoryGuide: the domain funnel, drawn from the one table that also
    // drives the sends, so the picture and the wiring cannot drift.
    <EmailCampaignsPanel
      apiBase="/api/email-campaigns"
      scopeLabel="System"
      assetOrigin="https://tinyglobalvillage.com"
      manageMergeFields
      systemScope
      categoryGuide={(cat, openCampaign) =>
        cat === "domains" ? <TransferFunnelGuide onOpenCampaign={openCampaign} /> : null
      }
    />
  );
}

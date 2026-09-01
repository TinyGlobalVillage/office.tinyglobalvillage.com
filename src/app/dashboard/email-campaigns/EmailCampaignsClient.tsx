"use client";

// EmailCampaignsClient — office chrome around the canonical @tgv/module-email-campaigns
// editor. System scope (TGV-wide templates); the member Support tab mounts the SAME panel
// against its own tenant-scoped API.

import styled from "styled-components";
import TopNav from "../../components/TopNav";
import { EmailCampaignsPanel } from "@tgv/module-email-campaigns";
import TransferFunnelGuide from "@tgv/module-domain-console/components/TransferFunnelGuide";

const ACCENT = "#ff4ecb";

const PageMain = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 0 0.25rem 4rem;
  max-width: 80rem;
  margin: 0 auto;
  width: 100%;

  @media (min-width: 768px) {
    padding: 0 1rem 4rem;
  }
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin: 1.25rem 0 0.5rem;
`;

const PageTitle = styled.h1`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: ${ACCENT};
  text-shadow: 0 0 10px rgba(255, 78, 203, 0.4);

  [data-theme="light"] & {
    text-shadow: none;
  }
`;

const PageSubtitle = styled.p`
  margin: 0 0 1.25rem;
  font-size: 0.8125rem;
  color: var(--t-textFaint);
  line-height: 1.45;
`;

export default function EmailCampaignsClient() {
  return (
    <>
      <TopNav />
      <PageMain>
        <HeaderRow>
          <PageTitle>Email Campaigns</PageTitle>
        </HeaderRow>
        <PageSubtitle>
          The TGV-wide outbound-email templates — pick a category, edit the branded email, preview
          it live, and send yourself a test. Unedited templates fall back to the code builder. Members
          edit their own site&apos;s copies from their dashboard Support tab.
        </PageSubtitle>
        {/* manageMergeFields: the merge-fields gear (Gio 2026-08-31) — to be
            re-used on the coming forms/newsletters module; one shared registry.
            systemScope: arms the Publish button's dropdown half — which TENANTS
            a campaign is published to. categoryGuide: the domain funnel, drawn
            from the one table that also drives the sends, so the picture and
            the wiring cannot drift (Gio 2026-09-01). */}
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
      </PageMain>
    </>
  );
}

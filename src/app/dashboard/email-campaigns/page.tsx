// email-campaigns/page.tsx — SERVER component. Admin gate for the Email Campaigns desk
// (edits the SYSTEM-scoped, TGV-wide outbound-email templates). Same inline-notice pattern
// as payroll/page.tsx (renders inside the dashboard iframe page-modal).

import { getBridgedMember } from "@/lib/member-auth/bridge";
import EmailCampaignsClient from "./EmailCampaignsClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EmailCampaignsPage() {
  const member = await getBridgedMember();
  if (!member || member.role !== "admin") {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f59e0b" }}>Admin only</div>
        <div style={{ fontSize: "0.85rem", maxWidth: "28rem", opacity: 0.75 }}>
          Email Campaigns edits the TGV-wide outbound-email templates. It&apos;s restricted to Office
          administrators.
        </div>
      </div>
    );
  }
  return <EmailCampaignsClient />;
}

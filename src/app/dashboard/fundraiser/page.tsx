// fundraiser/page.tsx — SERVER component. Staff gate for the Fundraiser desk (Gio 2026-11-22: "on
// office make sure it's only visible to staff"). Staff = on the Office roster as an admin or an
// employee; a signed-in member who isn't gets the notice, not the desk. The same test guards
// /api/admin/fundraiser (requireStaff) and hides the tile (useIsStaff). Same inline-notice pattern as
// villagers/page.tsx — the page renders inside the dashboard's iframe page-modal.

import { getBridgedMember } from "@/lib/member-auth/bridge";
import { isStaffRole } from "@/lib/api-staff";
import FundraiserClient from "./FundraiserClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function FundraiserDeskPage() {
  const member = await getBridgedMember();
  if (!member || !isStaffRole(member.role)) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "2rem", textAlign: "center" }}>
        <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>Staff only</div>
        <div style={{ fontSize: "0.85rem", maxWidth: "28rem", opacity: 0.75 }}>
          The Fundraiser desk shows every villager&apos;s fundraiser. It&apos;s open to TGV staff only.
        </div>
      </div>
    );
  }
  return <FundraiserClient />;
}

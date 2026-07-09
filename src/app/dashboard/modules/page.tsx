// modules/page.tsx — SERVER component. Admin gate for the Modules operator surface.
//
// Modules is the tile family for editing PLATFORM module surfaces (first child:
// Module-Dashboard, the dashboard-harness look-and-feel studio). What ships from here
// is absorbed by every member dashboard, so the route is restricted to Office admins —
// same boundary rationale as Villagers (the grid shows tiles to all staff; the route +
// the tgv.com studio's own superadmin gate are the real walls).
//
// Renders inside the dashboard's iframe page-modal → inline "Admin only" notice, not a
// redirect (a redirect would reload /dashboard inside the modal frame).

import { getBridgedMember } from "@/lib/member-auth/bridge";
import ModulesClient from "./ModulesClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ModulesPage() {
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
          Modules edits platform-wide surfaces (the dashboard harness every member sees).
          It&apos;s restricted to Office operators.
        </div>
      </div>
    );
  }
  return <ModulesClient />;
}

// villagers/page.tsx — SERVER component. Admin gate for the Villagers operator surface.
//
// Villagers manages member MONEY (wallets, retainer relocation, cash-out payouts), so the route is
// restricted to Office admins. The dashboard tile grid shows every tile to all staff (Deploy,
// Database, Utils, …), so the real boundary is here at the route + on each API route (requireAdmin).
// getBridgedMember() resolves the REAL member session → roster role (server context, next/headers
// cookies()); a non-admin (or a member who isn't on the Office staff roster) gets a clean refusal
// rather than the console. The proxy has already proven a 2FA member session before we run.
//
// The page renders inside the dashboard's iframe page-modal, so we show an inline "Admin only"
// notice instead of redirecting (a redirect would just reload /dashboard inside the modal frame).

import { getBridgedMember } from "@/lib/member-auth/bridge";
import VillagersClient from "./VillagersClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VillagersPage() {
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
          The Villagers console manages member wallets and cash-out payouts. It&apos;s restricted to
          Office operators.
        </div>
      </div>
    );
  }
  return <VillagersClient />;
}

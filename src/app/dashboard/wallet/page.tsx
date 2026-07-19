// wallet/page.tsx — SERVER component. Admin gate for the TGV business wallet (the same gate
// the /api/wallet proxy applies, so the UI never renders a panel whose every fetch would 401).
// Same inline-notice pattern as payroll/page.tsx.

import { getBridgedMember } from "@/lib/member-auth/bridge";
import WalletClient from "./WalletClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function WalletPage() {
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
          This is the TGV business wallet — company balances and payouts. It&apos;s restricted to
          Office administrators.
        </div>
      </div>
    );
  }
  return <WalletClient />;
}

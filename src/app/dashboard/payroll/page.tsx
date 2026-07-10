// payroll/page.tsx — SERVER component. Admin gate for the Payroll desk
// (HANDOFF-office-payroll.md: operated by the TGV superadmins, role-gated via the
// office admin role — never hardcoded accounts). Same inline-notice pattern as
// modules/page.tsx (renders inside the dashboard iframe page-modal).

import { getBridgedMember } from "@/lib/member-auth/bridge";
import PayrollClient from "./PayrollClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PayrollPage() {
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
          Payroll edits staff time records and rates. It&apos;s restricted to Office
          administrators.
        </div>
      </div>
    );
  }
  return <PayrollClient />;
}

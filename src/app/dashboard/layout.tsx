import ClientShell from "../components/ClientShell";
import { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ClientShell>
      {/* px-9 = 36px clearance on each side so content never sits under the 28px drawer tab pills */}
      <div style={{ paddingLeft: 0, paddingRight: "2.25rem" }}>{children}</div>
    </ClientShell>
  );
}

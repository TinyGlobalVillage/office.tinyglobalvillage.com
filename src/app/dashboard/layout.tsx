import ClientShell from "../components/ClientShell";
import { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ClientShell>
      {/* px-9 = 36px clearance on each side so content never sits under the 28px drawer tab pills */}
      <div className="px-9">{children}</div>
    </ClientShell>
  );
}

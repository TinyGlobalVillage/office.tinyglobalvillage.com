import ClientShell from "../components/ClientShell";
import DashboardToastsHost from "../components/DashboardToastsHost";
import TranscriberJobsHydrator from "../components/TranscriberJobsHydrator";
import { DialogHost } from "../components/dialogService";
import { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ClientShell>
      {/* px-9 = 36px clearance on each side so content never sits under the 28px drawer tab pills */}
      <div style={{ paddingLeft: 0, paddingRight: "2.25rem" }}>{children}</div>
      {/* Server-backed transcription jobs: hydrate on mount so an in-flight
          job from a previous tab session shows up immediately, then run
          polling in the background. */}
      <TranscriberJobsHydrator />
      {/* Bottom-right transcription toast — lives here so it pops anywhere
          in /dashboard, not just on /dashboard/utils. */}
      <DashboardToastsHost />
      {/* Styled confirm/notice dialogs (askConfirm/showNotice) — global host
          replacing native window.confirm/alert everywhere under /dashboard. */}
      <DialogHost />
    </ClientShell>
  );
}

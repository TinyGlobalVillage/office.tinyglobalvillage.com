"use client";

import { ReactNode, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TerminalProvider } from "./TerminalProvider";
import { PreviewProvider } from "./PreviewDrawer";
import CliTerminal from "./CliTerminal";
import PreviewDrawer from "./PreviewDrawer";
import LegendDrawer from "./LegendDrawer";
import PresenceHeartbeat from "./PresenceHeartbeat";
import PingNotifier from "./PingNotifier";
import AlertsDrawer from "./AlertsDrawer";
import ChatDrawer from "./ChatDrawer";
import InboxDrawer from "./InboxDrawer";
import SessionsDrawer from "./SessionsDrawer";
import DashboardPopoutBeacon from "./DashboardPopoutBeacon";

function ShellInner({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const embedded = searchParams?.get("embedded") === "1";
  const popout = searchParams?.get("popout") === "1";

  if (embedded) {
    // Embedded mode: stripped-down shell for iframe-mounted dashboard modals.
    // Skip drawers, terminal, preview — the host window owns those.
    return (
      <TerminalProvider>
        <PreviewProvider>
          {children}
        </PreviewProvider>
      </TerminalProvider>
    );
  }

  if (popout) {
    // Pop-out mode: chromeless standalone window, heartbeat to the main window
    // via BroadcastChannel so the origin modal shows a Blackout placeholder.
    return (
      <TerminalProvider>
        <PreviewProvider>
          <DashboardPopoutBeacon />
          {children}
        </PreviewProvider>
      </TerminalProvider>
    );
  }

  return (
    <TerminalProvider>
      <PreviewProvider>
        <PresenceHeartbeat />
        <PingNotifier />
        <AlertsDrawer />
        <ChatDrawer />
        <InboxDrawer />
        <SessionsDrawer />
        <LegendDrawer />
        {children}
        <CliTerminal />
        <PreviewDrawer />
      </PreviewProvider>
    </TerminalProvider>
  );
}

export default function ClientShell({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <TerminalProvider>
          <PreviewProvider>{children}</PreviewProvider>
        </TerminalProvider>
      }
    >
      <ShellInner>{children}</ShellInner>
    </Suspense>
  );
}

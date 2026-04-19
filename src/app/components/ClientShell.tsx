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

function ShellInner({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const embedded = searchParams?.get("embedded") === "1";

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

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
import GlobalModals from "./GlobalModals";
import { IncomingCallToast } from "./call";
import type { RingChannel } from "./call";

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

  const handleJoinFromRing = (mode: "active" | "observer") => (channel: RingChannel) => {
    // Drawers listen on `tgv-drawer-open` + `tgv-call-accept` to swap to the
    // accepted channel. The call stack's drawers subscribe to the latter and
    // enter the appropriate surface (full for sessions, strip for dm/group).
    window.dispatchEvent(new CustomEvent("tgv-call-accept", {
      detail: { channel, mode },
    }));
    // Also pop open the relevant drawer.
    const drawerId = channel.type === "session" ? "sessions" : "chat";
    window.dispatchEvent(new CustomEvent("tgv-drawer-open", { detail: drawerId }));
  };

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
        <GlobalModals />
        <IncomingCallToast
          onJoinActive={handleJoinFromRing("active")}
          onJoinObserver={handleJoinFromRing("observer")}
        />
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

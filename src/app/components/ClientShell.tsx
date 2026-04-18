"use client";

import { ReactNode } from "react";
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

export default function ClientShell({ children }: { children: ReactNode }) {
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

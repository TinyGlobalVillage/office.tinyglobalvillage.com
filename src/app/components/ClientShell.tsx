"use client";

import { ReactNode } from "react";
import { TerminalProvider } from "./TerminalProvider";
import { PreviewProvider } from "./PreviewDrawer";
import CliTerminal from "./CliTerminal";
import PreviewDrawer from "./PreviewDrawer";
import LegendDrawer from "./LegendDrawer";
import PresenceHeartbeat from "./PresenceHeartbeat";
import OfficeDrawer from "./OfficeDrawer";
import PingNotifier from "./PingNotifier";
import ChatDrawer from "./ChatDrawer";
import SessionsDrawer from "./SessionsDrawer";

export default function ClientShell({ children }: { children: ReactNode }) {
  return (
    <TerminalProvider>
      <PreviewProvider>
        <PresenceHeartbeat />
        <PingNotifier />
        <ChatDrawer />
        <OfficeDrawer />
        <SessionsDrawer />
        <LegendDrawer />
        {children}
        <CliTerminal />
        <PreviewDrawer />
      </PreviewProvider>
    </TerminalProvider>
  );
}

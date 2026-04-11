"use client";

import { ReactNode } from "react";
import { TerminalProvider } from "./TerminalProvider";
import { PreviewProvider } from "./PreviewDrawer";
import CliTerminal from "./CliTerminal";
import PreviewDrawer from "./PreviewDrawer";

export default function ClientShell({ children }: { children: ReactNode }) {
  return (
    <TerminalProvider>
      <PreviewProvider>
        {children}
        <CliTerminal />
        <PreviewDrawer />
      </PreviewProvider>
    </TerminalProvider>
  );
}

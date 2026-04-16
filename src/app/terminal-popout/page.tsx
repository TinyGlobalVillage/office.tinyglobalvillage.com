"use client";

import { TerminalProvider } from "@/app/components/TerminalProvider";
import CliTerminal from "@/app/components/CliTerminal";

export default function TerminalPopoutPage() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "rgba(4,5,8,1)",
      }}
    >
      <TerminalProvider>
        <CliTerminal standalone />
      </TerminalProvider>
    </div>
  );
}

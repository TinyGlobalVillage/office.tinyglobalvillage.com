"use client";

import { useEffect } from "react";
import { TerminalProvider } from "@/app/components/TerminalProvider";
import CliTerminal from "@/app/components/CliTerminal";

const BC_NAME = "tgv-editor-terminal-popout";
const POPOUT_HEARTBEAT_MS = 1200;

export default function TerminalPopoutPage() {
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(BC_NAME);
    bc.postMessage({ type: "popout-open" });
    bc.onmessage = (e) => {
      const t = e.data?.type;
      if (t === "ping") bc.postMessage({ type: "popout-open" });
      else if (t === "close-request") window.close();
    };
    const beat = setInterval(
      () => bc.postMessage({ type: "popout-open" }),
      POPOUT_HEARTBEAT_MS
    );
    const onUnload = () => bc.postMessage({ type: "popout-close" });
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearInterval(beat);
      bc.postMessage({ type: "popout-close" });
      window.removeEventListener("beforeunload", onUnload);
      bc.close();
    };
  }, []);

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

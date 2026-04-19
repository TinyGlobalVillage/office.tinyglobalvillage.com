"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const HEARTBEAT_MS = 1200;

export default function DashboardPopoutBeacon() {
  const pathname = usePathname() ?? "";

  useEffect(() => {
    const pageKey = pathname.replace(/^\/dashboard\/?/, "").split("/")[0] || "root";
    const channel = new BroadcastChannel(`tgv-dash-${pageKey}-popout`);

    const beat = () => channel.postMessage({ type: "popout-open", ts: Date.now() });
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);

    const onMessage = (ev: MessageEvent) => {
      if (ev.data?.type === "popout-close-request") {
        try { window.close(); } catch { /* noop */ }
      }
    };
    channel.addEventListener("message", onMessage);

    const onUnload = () => {
      try { channel.postMessage({ type: "popout-close", ts: Date.now() }); } catch { /* noop */ }
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      clearInterval(id);
      channel.removeEventListener("message", onMessage);
      window.removeEventListener("beforeunload", onUnload);
      try { channel.postMessage({ type: "popout-close", ts: Date.now() }); } catch { /* noop */ }
      channel.close();
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [pathname]);

  return null;
}

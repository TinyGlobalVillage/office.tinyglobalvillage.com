"use client";

import { useEffect } from "react";

const INTERVAL_MS = 30_000;

export default function PresenceHeartbeat() {
  useEffect(() => {
    // Ping immediately on mount, then every 30s
    const ping = () => fetch("/api/presence/heartbeat", { method: "POST" }).catch(() => {});
    ping();
    const id = setInterval(ping, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}

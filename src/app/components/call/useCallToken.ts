"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CallTokenError = {
  status: number;
  code: "forbidden" | "not-found" | "full" | "banned" | "unauthorized" | "server" | "unknown";
  message: string;
};

export type UseCallTokenResult = {
  token: string | null;
  url: string | null;
  error: CallTokenError | null;
  loading: boolean;
  refresh: () => void;
};

function classifyError(status: number, body: { error?: string; code?: string }): CallTokenError {
  const msg = body?.error ?? `Error ${status}`;
  const codeHint = body?.code ?? "";
  if (status === 401) return { status, code: "unauthorized", message: msg };
  if (status === 404) return { status, code: "not-found", message: msg };
  if (status === 403) {
    if (codeHint === "banned" || /ban/i.test(msg)) return { status, code: "banned", message: msg };
    if (codeHint === "full" || /full|cap/i.test(msg)) return { status, code: "full", message: msg };
    return { status, code: "forbidden", message: msg };
  }
  if (status >= 500) return { status, code: "server", message: msg };
  return { status, code: "unknown", message: msg };
}

export function useCallToken(roomName: string | null): UseCallTokenResult {
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<CallTokenError | null>(null);
  const [loading, setLoading] = useState(false);
  const tick = useRef(0);

  const fetchToken = useCallback(async () => {
    if (!roomName) {
      setToken(null);
      setUrl(null);
      setError(null);
      return;
    }
    const currentTick = ++tick.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomName }),
      });
      if (currentTick !== tick.current) return;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(classifyError(res.status, body));
        setToken(null);
        setUrl(null);
        return;
      }
      const data = await res.json();
      setToken(data.token ?? null);
      setUrl(data.url ?? null);
    } catch (e) {
      if (currentTick !== tick.current) return;
      setError({
        status: 0,
        code: "unknown",
        message: e instanceof Error ? e.message : "Connection failed",
      });
    } finally {
      if (currentTick === tick.current) setLoading(false);
    }
  }, [roomName]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  return { token, url, error, loading, refresh: fetchToken };
}

export default useCallToken;

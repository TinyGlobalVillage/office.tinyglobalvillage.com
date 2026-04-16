"use client";

import { useState, useRef, useEffect } from "react";

type Props = {
  account: string;       // "gio" | "marmar"
  email: string;         // display email
  onVerified: () => void;
  onCancel: () => void;
};

export default function AccessGate({ account, email, onVerified, onCancel }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    if (!pin.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/email/verify-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, pin }),
      });
      const data = await res.json();
      if (data.ok) {
        onVerified();
      } else {
        setError(data.error === "wrong_pin" ? "Incorrect PIN." : "Access denied.");
        setPin("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-12">
      <div
        className="w-full max-w-sm rounded-2xl p-8 flex flex-col gap-6"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(0,191,255,0.15)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Lock icon */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: "rgba(0,191,255,0.1)", border: "1px solid rgba(0,191,255,0.2)" }}
          >
            🔒
          </div>
          <div className="text-center">
            <div className="text-white font-semibold text-sm">Personal Inbox</div>
            <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              {email}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>
            Enter PIN
          </label>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            maxLength={20}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="••••••••"
            className="w-full rounded-lg px-3 py-2.5 text-sm font-mono outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${error ? "rgba(255,80,80,0.5)" : "rgba(255,255,255,0.12)"}`,
              color: "#fff",
              letterSpacing: "0.2em",
            }}
          />
          {error && (
            <div className="text-[11px]" style={{ color: "rgba(255,80,80,0.8)" }}>
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || !pin.trim()}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            style={{
              background: "rgba(0,191,255,0.15)",
              border: "1px solid rgba(0,191,255,0.35)",
              color: "#00bfff",
            }}
          >
            {loading ? "Verifying…" : "Unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}

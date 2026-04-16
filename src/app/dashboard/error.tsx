"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard] caught error:", error);
  }, [error]);

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(7,9,13,1)" }}>
      <div className="text-center px-8 max-w-sm">
        <div className="text-3xl mb-4">⚠</div>
        <div className="text-sm font-semibold mb-2" style={{ color: "rgba(255,78,203,0.8)" }}>
          Something went wrong
        </div>
        <div className="text-[11px] mb-6 font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
          {error.message || "An unexpected error occurred."}
        </div>
        <button
          onClick={reset}
          className="px-5 py-2 rounded-lg text-xs font-bold transition-all"
          style={{
            background: "rgba(255,78,203,0.12)",
            border: "1px solid rgba(255,78,203,0.35)",
            color: "#ff4ecb",
          }}
        >
          ↺ Try again
        </button>
      </div>
    </div>
  );
}

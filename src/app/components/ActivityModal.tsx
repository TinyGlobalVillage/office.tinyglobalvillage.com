"use client";

import { useState, useEffect, useRef } from "react";
import LogsModal, { type TabMode } from "./LogsModal";

type ActivityEvent = {
  timeLabel: string;
  actor: string;
  event: string;
  type: "pm2" | "git" | "system";
};

const TYPE_COLOR: Record<string, string> = {
  pm2:    "#f7b700",
  git:    "#ff4ecb",
  system: "#4ade80",
};

const PAGE_OPTIONS = [5, 10, 25, 50] as const;

export default function ActivityModal({ onClose }: { onClose: () => void }) {
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [perPage, setPerPage] = useState<number>(25);
  const [customPerPage, setCustomPerPage] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [page, setPage] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [logsTab, setLogsTab] = useState<TabMode | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/activity")
      .then((r) => r.json())
      .then((d) => { setActivity(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (fullscreen) { setFullscreen(false); return; }
        onClose();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose, fullscreen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const effectivePerPage = showCustom && parseInt(customPerPage) > 0
    ? parseInt(customPerPage) : perPage;

  const totalPages = Math.max(1, Math.ceil(activity.length / effectivePerPage));
  const pageItems = activity.slice(page * effectivePerPage, (page + 1) * effectivePerPage);

  const modalStyle: React.CSSProperties = fullscreen
    ? { top: 0, left: 0, right: 0, bottom: 0, borderRadius: 0 }
    : { top: 60, left: "4%", right: "4%", bottom: "4%", borderRadius: 20 };

  return (
    <>
      {/* LogsModal opens on top when a log tab is active */}
      {logsTab && <LogsModal onClose={() => setLogsTab(null)} initialTab={logsTab} />}

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[65]"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed z-[66] flex flex-col overflow-hidden"
        style={{
          ...modalStyle,
          background: "rgba(6,8,12,0.99)",
          border: "1px solid rgba(0,191,255,0.18)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.85)",
          transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-5 py-3 flex-shrink-0 flex-wrap gap-y-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <h2 className="text-sm font-bold mr-1" style={{ color: "#00bfff" }}>Recent Activity</h2>

          {/* Log tabs */}
          {(["logs", "archive"] as TabMode[]).map((t) => (
            <button
              key={t}
              onClick={() => setLogsTab(t)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: "rgba(255,78,203,0.08)",
                border: "1px solid rgba(255,78,203,0.25)",
                color: "#ff4ecb",
              }}
            >
              {t === "logs" ? "📋 Logs" : "🗜 Archive"}
            </button>
          ))}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Per-page dropdown */}
          <div ref={dropRef} className="relative">
            <button
              onClick={() => setShowDropdown((p) => !p)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
              style={{
                background: "rgba(255,78,203,0.12)",
                border: "1px solid rgba(255,78,203,0.35)",
                color: "#ff4ecb",
              }}
            >
              {showCustom && parseInt(customPerPage) > 0 ? customPerPage : effectivePerPage} / pg
              <svg width="8" height="5" viewBox="0 0 10 6" fill="currentColor"><path d="M0 0l5 6 5-6z"/></svg>
            </button>

            {showDropdown && (
              <div
                className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-10"
                style={{ background: "rgba(8,11,18,0.98)", border: "1px solid rgba(255,78,203,0.3)", boxShadow: "0 8px 32px rgba(0,0,0,0.7)", minWidth: 90 }}
              >
                {PAGE_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => { setPerPage(n); setShowCustom(false); setPage(0); setShowDropdown(false); }}
                    className="w-full text-left px-4 py-2 text-[11px] transition-colors"
                    style={{ color: effectivePerPage === n && !showCustom ? "#ff4ecb" : "rgba(255,255,255,0.55)", background: "transparent" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,78,203,0.08)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => { setShowCustom(true); setShowDropdown(false); }}
                  className="w-full text-left px-4 py-2 text-[11px] transition-colors"
                  style={{ color: showCustom ? "#ff4ecb" : "rgba(255,255,255,0.55)", borderTop: "1px solid rgba(255,255,255,0.06)", background: "transparent" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,78,203,0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  Custom…
                </button>
              </div>
            )}
          </div>

          {showCustom && (
            <input
              type="number"
              value={customPerPage}
              onChange={(e) => { setCustomPerPage(e.target.value); setPage(0); }}
              placeholder="n"
              className="w-14 bg-transparent outline-none text-[11px] text-center rounded-lg px-2 py-1"
              style={{ border: "1px solid rgba(255,78,203,0.35)", color: "#ff4ecb" }}
              autoFocus
            />
          )}

          {/* Pagination arrows */}
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all disabled:opacity-25"
            style={{ background: "rgba(255,78,203,0.1)", border: "1px solid rgba(255,78,203,0.3)", color: "#ff4ecb" }}
          >←</button>
          <span className="text-[10px] text-white/30 tabular-nums w-10 text-center">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all disabled:opacity-25"
            style={{ background: "rgba(255,78,203,0.1)", border: "1px solid rgba(255,78,203,0.3)", color: "#ff4ecb" }}
          >→</button>

          {/* Window controls */}
          <button
            onClick={() => setFullscreen((p) => !p)}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs hover:bg-white/10 transition-all"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >{fullscreen ? "⊡" : "⊞"}</button>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs hover:bg-white/10 transition-all"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >✕</button>
        </div>

        {/* Activity list */}
        <div className="flex-1 overflow-y-auto px-5 py-3" style={{ scrollbarWidth: "thin" }}>
          {loading ? (
            <div className="flex items-center justify-center h-32 text-white/25 text-sm">Loading…</div>
          ) : pageItems.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-white/25 text-sm">No activity yet.</div>
          ) : (
            <div className="flex flex-col divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              {pageItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <span className="text-[10px] font-mono text-white/25 w-12 shrink-0 text-right">{item.timeLabel}</span>
                  <span
                    className="text-[10px] font-bold shrink-0 uppercase tracking-wide w-10"
                    style={{ color: TYPE_COLOR[item.type] ?? "#fff" }}
                  >{item.type}</span>
                  <span className="text-xs text-white/60 truncate">{item.event}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

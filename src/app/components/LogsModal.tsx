"use client";

import { useState, useEffect, useCallback } from "react";

type LiveDate = { date: string; bytes: number; archived: false };
type ArchiveDate = { date: string; bytes: number; archived: true; decompressed: boolean };
type AnyDate = LiveDate | ArchiveDate;

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export type TabMode = "logs" | "archive";

function LogViewer({
  date,
  isArchive,
  decompressed,
  onDecompressRequest,
  onCloseArchive,
}: {
  date: string;
  isArchive: boolean;
  decompressed: boolean;
  onDecompressRequest: (date: string) => Promise<void>;
  onCloseArchive: (date: string) => Promise<void>;
}) {
  const [lines, setLines] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [decompressing, setDecompressing] = useState(false);
  const [isDecompressed, setIsDecompressed] = useState(decompressed);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const qs = isArchive && isDecompressed
        ? `date=${date}&page=${p}&tmp=1`
        : `date=${date}&page=${p}`;
      const res = await fetch(`/api/logs?${qs}`);
      if (res.ok) {
        const d = await res.json();
        setLines(d.lines ?? []);
        setTotal(d.total ?? 0);
        setTotalPages(d.totalPages ?? 1);
        setPage(d.page ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, [date, isArchive, isDecompressed]);

  useEffect(() => { load(1); }, [load]);

  const handleDecompress = async () => {
    setDecompressing(true);
    await onDecompressRequest(date);
    setIsDecompressed(true);
    setDecompressing(false);
  };

  const handleClose = async () => {
    await onCloseArchive(date);
    setIsDecompressed(false);
    setLines([]);
  };

  if (isArchive && !isDecompressed) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <span className="text-3xl">🗜</span>
        <p className="text-sm text-white/50">This log is compressed</p>
        <button
          onClick={handleDecompress}
          disabled={decompressing}
          className="px-5 py-2 rounded-xl text-xs font-bold transition-all"
          style={{
            background: "rgba(0,191,255,0.15)",
            border: "1px solid rgba(0,191,255,0.4)",
            color: "#00bfff",
          }}
        >
          {decompressing ? "Decompressing…" : "🗃 Decompress to View"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-white/40">
          {total.toLocaleString()} lines · page {page}/{totalPages}
        </span>
        {loading && <span className="text-[10px] text-yellow-400/70 animate-pulse">Loading…</span>}
        {isArchive && isDecompressed && (
          <button
            onClick={handleClose}
            title="Delete decompressed preview"
            className="ml-auto text-[10px] font-bold px-3 py-1 rounded-lg transition-all"
            style={{
              background: "rgba(255,107,107,0.1)",
              border: "1px solid rgba(255,107,107,0.3)",
              color: "#ff6b6b",
            }}
          >
            ✕ Close Preview
          </button>
        )}
        {totalPages > 1 && (
          <div className="flex items-center gap-1 ml-auto">
            <button
              disabled={page >= totalPages}
              onClick={() => load(page + 1)}
              className="text-[10px] px-2 py-1 rounded disabled:opacity-30 text-white/40 hover:text-cyan-400 border border-white/08"
            >
              ← Older
            </button>
            <button
              disabled={page <= 1}
              onClick={() => load(page - 1)}
              className="text-[10px] px-2 py-1 rounded disabled:opacity-30 text-white/40 hover:text-cyan-400 border border-white/08"
            >
              Newer →
            </button>
          </div>
        )}
      </div>

      {/* Lines */}
      <div
        className="flex-1 overflow-y-auto font-mono text-[11px] leading-[1.55] rounded-xl px-4 py-3"
        style={{ background: "rgba(0,0,0,0.5)", minHeight: 0, scrollbarWidth: "thin" }}
      >
        {lines.length === 0 && !loading && (
          <span className="text-white/25">No log entries for this date.</span>
        )}
        {lines.map((line, i) => {
          const isErr = line.includes("error") || line.includes("Error") || line.includes("✗");
          return (
            <div key={i} style={{ color: isErr ? "#ff6b6b" : "rgba(200,220,220,0.7)" }}>
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LogsModal({ onClose, initialTab = "logs" }: { onClose: () => void; initialTab?: TabMode }) {
  const [tab, setTab] = useState<TabMode>(initialTab);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const [liveDates, setLiveDates] = useState<LiveDate[]>([]);
  const [archiveDates, setArchiveDates] = useState<ArchiveDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<AnyDate | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveResult, setArchiveResult] = useState<string | null>(null);
  const [livePage, setLivePage] = useState(0);
  const DATES_PER_PAGE = 30;

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch("/api/logs");
      if (res.ok) {
        const d = await res.json();
        setLiveDates(d.dates ?? []);
        setArchiveDates(d.archives ?? []);
      }
    } catch { /* skip */ }
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  // Auto-select newest date
  useEffect(() => {
    const all = [...liveDates, ...archiveDates].sort((a, b) => b.date.localeCompare(a.date));
    if (all.length && !selectedDate) setSelectedDate(all[0]);
  }, [liveDates, archiveDates, selectedDate]);

  const handleArchive = async () => {
    setArchiving(true);
    setArchiveResult(null);
    try {
      const res = await fetch("/api/logs/archive", { method: "POST" });
      const d = await res.json();
      const n = d.archived?.length ?? 0;
      setArchiveResult(n === 0 ? "No logs ready to archive (< 30 days old)." : `Archived ${n} log${n !== 1 ? "s" : ""}.`);
      await loadMeta();
    } finally {
      setArchiving(false);
    }
  };

  const handleDecompress = async (date: string) => {
    await fetch(`/api/logs/archive?decompress=${date}`, { method: "POST" });
    await loadMeta();
    // Update archive date state to show decompressed
    setArchiveDates((prev) =>
      prev.map((d) => d.date === date ? { ...d, decompressed: true } : d)
    );
  };

  const handleCloseArchive = async (date: string) => {
    await fetch(`/api/logs/archive?date=${date}`, { method: "DELETE" });
    setArchiveDates((prev) =>
      prev.map((d) => d.date === date ? { ...d, decompressed: false } : d)
    );
  };

  // Paginated live dates (30 per page, newest first)
  const pagedLive = liveDates.slice(livePage * DATES_PER_PAGE, (livePage + 1) * DATES_PER_PAGE);
  const livePageTotal = Math.ceil(liveDates.length / DATES_PER_PAGE);

  const sidebarDates: AnyDate[] = tab === "logs" ? pagedLive : archiveDates;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed z-50 flex flex-col"
        style={{
          top: 72,
          left: "3%",
          right: "3%",
          bottom: "3%",
          background: "rgba(6,8,12,0.98)",
          border: "1px solid rgba(255,78,203,0.2)",
          borderRadius: 20,
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-4 px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <h2 className="text-base font-bold" style={{ color: "#ff4ecb" }}>
            Activity Logs
          </h2>

          {/* Tabs */}
          <div className="flex items-center gap-1">
            {(["logs", "archive"] as TabMode[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                style={{
                  background: tab === t ? "rgba(255,78,203,0.15)" : "transparent",
                  border: `1px solid ${tab === t ? "rgba(255,78,203,0.4)" : "rgba(255,255,255,0.08)"}`,
                  color: tab === t ? "#ff4ecb" : "rgba(255,255,255,0.35)",
                }}
              >
                {t === "logs" ? "📋 Logs" : "🗜 Archive"}
              </button>
            ))}
          </div>

          {/* Archive action */}
          {tab === "archive" && (
            <div className="flex items-center gap-3 ml-2">
              <button
                onClick={handleArchive}
                disabled={archiving}
                title="Compress logs older than 30 days"
                className="text-xs font-bold px-3 py-1 rounded-lg transition-all disabled:opacity-40"
                style={{
                  background: "rgba(247,183,0,0.12)",
                  border: "1px solid rgba(247,183,0,0.35)",
                  color: "#f7b700",
                }}
              >
                {archiving ? "Archiving…" : "⚡ Archive Old Logs"}
              </button>
              {archiveResult && (
                <span className="text-[10px] text-white/40">{archiveResult}</span>
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-3">
            <span className="text-[10px] text-white/25">
              {tab === "logs"
                ? `${liveDates.length} day${liveDates.length !== 1 ? "s" : ""} · LA time`
                : `${archiveDates.length} archive${archiveDates.length !== 1 ? "s" : ""}`}
            </span>
            <button
              onClick={onClose}
              title="Close"
              className="text-white/30 hover:text-white/70 transition-colors text-sm font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar: date list */}
          <div
            className="flex flex-col w-52 flex-shrink-0 overflow-y-auto py-2"
            style={{ borderRight: "1px solid rgba(255,255,255,0.06)", scrollbarWidth: "thin" }}
          >
            {sidebarDates.length === 0 ? (
              <p className="text-[10px] text-white/25 px-4 py-3">
                {tab === "logs" ? "No logs yet." : "No archives. Run 'Archive Old Logs' after 30 days."}
              </p>
            ) : (
              sidebarDates.map((d) => {
                const isSelected = selectedDate?.date === d.date;
                return (
                  <button
                    key={d.date}
                    onClick={() => setSelectedDate(d)}
                    className="flex flex-col px-4 py-2.5 text-left transition-all"
                    style={{
                      background: isSelected ? "rgba(255,78,203,0.12)" : "transparent",
                      borderLeft: `2px solid ${isSelected ? "#ff4ecb" : "transparent"}`,
                    }}
                  >
                    <span
                      className="text-xs font-mono font-bold"
                      style={{ color: isSelected ? "#ff4ecb" : "rgba(255,255,255,0.5)" }}
                    >
                      {d.date}
                    </span>
                    <span className="text-[9px] text-white/25 mt-0.5">
                      {d.archived
                        ? `🗜 ${fmtBytes(d.bytes)}${d.decompressed ? " · open" : ""}`
                        : fmtBytes(d.bytes)}
                    </span>
                  </button>
                );
              })
            )}

            {/* Pagination for live dates */}
            {tab === "logs" && livePageTotal > 1 && (
              <div className="flex items-center gap-1 px-3 py-2 mt-auto border-t border-white/05">
                <button
                  disabled={livePage <= 0}
                  onClick={() => setLivePage((p) => p - 1)}
                  className="text-[9px] text-white/30 hover:text-white disabled:opacity-30 px-1"
                >
                  ↑ Newer
                </button>
                <span className="text-[9px] text-white/20 flex-1 text-center">
                  {livePage + 1}/{livePageTotal}
                </span>
                <button
                  disabled={livePage >= livePageTotal - 1}
                  onClick={() => setLivePage((p) => p + 1)}
                  className="text-[9px] text-white/30 hover:text-white disabled:opacity-30 px-1"
                >
                  Older ↓
                </button>
              </div>
            )}
          </div>

          {/* Log viewer */}
          <div className="flex-1 overflow-hidden px-6 py-4">
            {selectedDate ? (
              <div className="h-full flex flex-col gap-3">
                <div className="flex items-center gap-3 flex-shrink-0">
                  <h3 className="text-sm font-bold text-white/70">
                    {selectedDate.date}
                  </h3>
                  {selectedDate.archived && (
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={{ background: "rgba(247,183,0,0.12)", border: "1px solid rgba(247,183,0,0.3)", color: "#f7b700" }}
                    >
                      Archived
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <LogViewer
                    key={selectedDate.date}
                    date={selectedDate.date}
                    isArchive={selectedDate.archived}
                    decompressed={selectedDate.archived ? selectedDate.decompressed : false}
                    onDecompressRequest={handleDecompress}
                    onCloseArchive={handleCloseArchive}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-white/25">
                <span className="text-4xl">📋</span>
                <p className="text-sm">Select a date to view logs</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

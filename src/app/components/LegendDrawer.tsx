"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

type LegendItem = { glyph: string; label: string; desc: string };
type PageLegend = { title: string; items: LegendItem[] };

const LEGENDS: Record<string, PageLegend> = {
  "/dashboard": {
    title: "Dashboard",
    items: [
      { glyph: "●", label: "Online",    desc: "Service is running normally" },
      { glyph: "○", label: "Offline",   desc: "User is not currently active" },
      { glyph: "↺", label: "Restarts",  desc: "Number of times the process has restarted" },
      { glyph: "▲", label: "Deploy",    desc: "Trigger a deployment or build" },
      { glyph: "MB", label: "Memory",   desc: "RAM consumed by the process in megabytes" },
      { glyph: "%",  label: "CPU",      desc: "CPU usage percentage at last sample" },
    ],
  },
  "/dashboard/processes": {
    title: "Processes",
    items: [
      { glyph: "●",    label: "Green dot",     desc: "Process is online and running" },
      { glyph: "●",    label: "Gray dot",      desc: "Process is stopped" },
      { glyph: "●",    label: "Red dot",       desc: "Process has errored or crashed" },
      { glyph: "#N",   label: "PM2 ID",        desc: "Unique PM2 process identifier" },
      { glyph: ":PORT", label: "Port",         desc: "Network port this service listens on" },
      { glyph: "↺ N",  label: "Restart count", desc: "How many times PM2 has restarted this process" },
      { glyph: "MB",   label: "Memory",        desc: "RAM used by this process" },
      { glyph: "% CPU", label: "CPU",          desc: "CPU usage at last 1s sample" },
      { glyph: "up Xh", label: "Uptime",       desc: "How long since the process last started" },
    ],
  },
  "/dashboard/deploy": {
    title: "Deploy",
    items: [
      { glyph: "▲", label: "Deploy",  desc: "Run build & restart the selected project" },
      { glyph: "↺", label: "Rebuild", desc: "Force a clean rebuild from source" },
      { glyph: "⬡", label: "Project", desc: "A Next.js client project managed by PM2" },
      { glyph: "●", label: "Online",  desc: "Project is live and serving traffic" },
      { glyph: "○", label: "Stopped", desc: "Project is not serving traffic" },
    ],
  },
  "/dashboard/database": {
    title: "Database",
    items: [
      { glyph: "⊞",    label: "Table",       desc: "A PostgreSQL database table" },
      { glyph: "→",    label: "Foreign key", desc: "A relation to another table" },
      { glyph: "PK",   label: "Primary key", desc: "Unique row identifier" },
      { glyph: "NULL", label: "Nullable",    desc: "Column allows null values" },
      { glyph: "▶",    label: "Run query",   desc: "Execute the SQL in the editor" },
      { glyph: "#",    label: "Row count",   desc: "Number of rows returned or in table" },
    ],
  },
  "/dashboard/utils": {
    title: "Utils",
    items: [
      { glyph: "▶",  label: "Run",      desc: "Execute this utility script" },
      { glyph: ">_", label: "Terminal", desc: "Open the live terminal drawer" },
      { glyph: "⊘",  label: "Kill",     desc: "Abort the currently running command" },
      { glyph: "●",  label: "Running",  desc: "A command is actively executing" },
      { glyph: "✓",  label: "Exit 0",   desc: "Command completed successfully" },
      { glyph: "✗",  label: "Exit N",   desc: "Command failed with non-zero exit code" },
    ],
  },
  "/dashboard/editor": {
    title: "Editor",
    items: [
      { glyph: "▸", label: "Folder",   desc: "Click to expand / collapse directory" },
      { glyph: "·", label: "File",     desc: "Click to open file in editor" },
      { glyph: "●", label: "Unsaved",  desc: "Yellow dot on tab = unsaved changes" },
      { glyph: "✓", label: "Saved",    desc: "Auto-save fires 1.2s after last keystroke" },
      { glyph: "▶", label: "Deploy",   desc: "Rebuild & restart this project via PM2" },
      { glyph: "×", label: "Close tab", desc: "Close the editor tab (file stays on disk)" },
    ],
  },
  "/dashboard/storage": {
    title: "Storage",
    items: [
      { glyph: "📁",    label: "Bucket",    desc: "A project-scoped folder in the CDN" },
      { glyph: "⬆",    label: "Upload",    desc: "Drag-drop or click to upload files" },
      { glyph: "🔗",   label: "Copy URL",  desc: "Copies the permanent public CDN link" },
      { glyph: "⧉",    label: "Open",      desc: "Open the file in a new browser tab" },
      { glyph: "✕",    label: "Delete",    desc: "Permanently remove the file from CDN" },
      { glyph: "/media/", label: "Path prefix", desc: "All CDN files are served under /media/" },
    ],
  },
};

function getLegend(pathname: string): PageLegend | null {
  if (LEGENDS[pathname]) return LEGENDS[pathname];
  const match = Object.keys(LEGENDS)
    .filter((k) => pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match ? LEGENDS[match] : null;
}

const TAB_STORAGE_KEY = "tgv-drawer-tab-legend-y";
const DRAWER_EVENT = "tgv-right-drawer";

function getDefaultTabY() {
  if (typeof window === "undefined") return 400;
  return Math.round(window.innerHeight * 0.5);
}

export default function LegendDrawer() {
  const [open, setOpen] = useState(false);
  const [tabY, setTabY] = useState<number>(400);
  const pathname = usePathname();
  const legend = getLegend(pathname ?? "");

  const startTabY = useRef(0);
  const startTabPos = useRef(0);
  const didDrag = useRef(false);

  // Init tab Y
  useEffect(() => {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    setTabY(saved ? parseInt(saved, 10) : getDefaultTabY());
  }, []);

  // Listen for another drawer opening → close self
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail !== "legend") setOpen(false);
    };
    window.addEventListener(DRAWER_EVENT, handler);
    return () => window.removeEventListener(DRAWER_EVENT, handler);
  }, []);

  // Keyboard close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onTabMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startTabY.current = e.clientY;
    startTabPos.current = tabY;
    didDrag.current = false;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startTabY.current;
      if (Math.abs(delta) > 4) didDrag.current = true;
      if (didDrag.current) {
        const next = Math.max(40, Math.min(window.innerHeight - 100, startTabPos.current + delta));
        setTabY(next);
        localStorage.setItem(TAB_STORAGE_KEY, String(next));
      }
    };
    const onUp = () => {
      if (!didDrag.current) {
        setOpen((p) => {
          const next = !p;
          if (next) window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: "legend" }));
          return next;
        });
      }
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.body.style.cursor = "ns-resize";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [tabY]);

  if (!legend) return null;

  return (
    <>
      {/* ── Draggable side tab (right edge) ───────────────────────────────── */}
      <button
        onMouseDown={onTabMouseDown}
        title="Page legend"
        className="fixed right-0 z-[41] flex flex-col items-center justify-center gap-1 select-none"
        style={{
          top: tabY,
          transform: "translateY(-50%)",
          width: 28,
          paddingTop: 14,
          paddingBottom: 14,
          background: open ? "rgba(0,191,255,0.2)" : "rgba(0,191,255,0.08)",
          border: "1px solid rgba(0,191,255,0.35)",
          borderRight: "none",
          borderRadius: "10px 0 0 10px",
          color: "#00bfff",
          boxShadow: "-2px 0 10px rgba(0,191,255,0.12)",
          backdropFilter: "blur(8px)",
          transition: "background 0.2s",
          writingMode: "vertical-rl",
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          cursor: "grab",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,191,255,0.2)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = open ? "rgba(0,191,255,0.2)" : "rgba(0,191,255,0.08)"; }}
      >
        {open ? "✕" : "?"}&nbsp;Legend
      </button>

      {/* ── Backdrop ──────────────────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-[30]" onClick={() => setOpen(false)} />
      )}

      {/* ── Drawer (slides in from RIGHT) ─────────────────────────────────── */}
      <div
        className="fixed top-0 right-0 h-full z-[40] flex flex-col overflow-hidden"
        style={{
          width: 300,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
          background: "rgba(8,10,14,0.98)",
          borderLeft: "1px solid rgba(0,191,255,0.15)",
          boxShadow: open ? "-8px 0 40px rgba(0,0,0,0.6)" : "none",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/30 mb-0.5">Page Legend</p>
            <h2 className="text-sm font-bold" style={{ color: "#00bfff" }}>{legend.title}</h2>
          </div>
          <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/70 transition-colors text-xs">✕</button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {legend.items.map((item) => (
            <div key={item.glyph + item.label} className="flex gap-3 items-start">
              <span className="font-mono text-sm font-bold flex-shrink-0 w-10 text-right" style={{ color: "#00bfff", lineHeight: "1.4" }}>
                {item.glyph}
              </span>
              <div>
                <p className="text-xs font-bold text-white/80 leading-tight">{item.label}</p>
                <p className="text-[11px] text-white/40 leading-snug mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <p className="text-[9px] text-white/20 tracking-wider uppercase">Legend updates per page</p>
        </div>
      </div>
    </>
  );
}

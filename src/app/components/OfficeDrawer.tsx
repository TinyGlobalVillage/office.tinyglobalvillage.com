"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import AnnouncementsPanel from "./AnnouncementsPanel";
import EmailErrorBoundary from "./email/EmailErrorBoundary";

const EmailClient = dynamic(() => import("./email/EmailClient"), { ssr: false });

type Tab = "announcements" | "email";

const MIN_W = 420;
const MAX_W = 1400;
const DEFAULT_W = 680;
const TAB_STORAGE_KEY = "tgv-drawer-tab-mail-y";
const DRAWER_EVENT = "tgv-right-drawer";

function getDefaultTabY() {
  if (typeof window === "undefined") return 300;
  return Math.round(window.innerHeight * 0.5) - 50; // center - 50px
}

export default function OfficeDrawer() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("announcements");
  const [width, setWidth] = useState(DEFAULT_W);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [tabY, setTabY] = useState<number>(300);
  const drawerRef = useRef<HTMLDivElement>(null);
  const resizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  // Init tab Y + session prefs
  useEffect(() => {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    setTabY(saved ? parseInt(saved, 10) : getDefaultTabY());

    const savedZ = sessionStorage.getItem("office-drawer-zoom");
    if (savedZ) setZoom(parseFloat(savedZ));
    const savedW = sessionStorage.getItem("office-drawer-width");
    if (savedW) setWidth(parseInt(savedW, 10));
  }, []);

  // Listen for another drawer opening → close self
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail !== "mail") setOpen(false);
    };
    window.addEventListener(DRAWER_EVENT, handler);
    return () => window.removeEventListener(DRAWER_EVENT, handler);
  }, []);

  // Keyboard close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreen) { setFullscreen(false); return; }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, fullscreen]);

  // ── Draggable tab pill ───────────────────────────────────────────────────────
  const startTabY = useRef(0);
  const startTabPos = useRef(0);
  const didDrag = useRef(false);

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
        // It was a click — toggle
        setOpen((p) => {
          const next = !p;
          if (next) window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: "mail" }));
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

  // ── Resize drawer width (drag left edge) ────────────────────────────────────
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    resizing.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      // dragging right edge: moving right = wider, moving left = narrower
      const delta = ev.clientX - startX.current;
      const newW = Math.min(MAX_W, Math.max(MIN_W, startW.current + delta));
      setWidth(newW);
      sessionStorage.setItem("office-drawer-width", String(newW));
    };
    const onUp = () => {
      resizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [width]);

  // ── Zoom ─────────────────────────────────────────────────────────────────────
  const ZOOM_STEPS = [0.8, 0.9, 1.0, 1.1, 1.25];
  const zoomIn  = () => { const n = ZOOM_STEPS.find((z) => z > zoom) ?? zoom; setZoom(n); sessionStorage.setItem("office-drawer-zoom", String(n)); };
  const zoomOut = () => { const n = [...ZOOM_STEPS].reverse().find((z) => z < zoom) ?? zoom; setZoom(n); sessionStorage.setItem("office-drawer-zoom", String(n)); };
  const zoomReset = () => { setZoom(1); sessionStorage.setItem("office-drawer-zoom", "1"); };

  // ── Popout ───────────────────────────────────────────────────────────────────
  const popout = () => {
    const w = window.screen.width * 0.8;
    const h = window.screen.height * 0.85;
    const left = (window.screen.width - w) / 2;
    const top  = (window.screen.height - h) / 2;
    const url  = tab === "email" ? "/dashboard/email?popout=1" : "/dashboard/announcements?popout=1";
    window.open(url, "tgv-office-drawer", `width=${w},height=${h},left=${left},top=${top}`);
  };

  return (
    <>
      {/* ── Draggable side tab (LEFT edge) ──────────────────────────────────── */}
      <button
        onMouseDown={onTabMouseDown}
        title={open ? "Close drawer" : "Open mail & announcements"}
        className="fixed left-0 z-[61] flex flex-col items-center justify-center gap-2 select-none"
        style={{
          top: tabY,
          transform: "translateY(-50%)",
          width: 28,
          paddingTop: 12,
          paddingBottom: 12,
          background: open ? "rgba(255,78,203,0.25)" : "rgba(255,78,203,0.12)",
          border: "1px solid rgba(255,78,203,0.45)",
          borderLeft: "none",
          borderRadius: "0 10px 10px 0",
          color: "#ff4ecb",
          boxShadow: "2px 0 12px rgba(255,78,203,0.18)",
          backdropFilter: "blur(8px)",
          transition: "background 0.2s",
          cursor: "grab",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,78,203,0.3)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = open ? "rgba(255,78,203,0.25)" : "rgba(255,78,203,0.12)"; }}
      >
        {/* Icon — natural horizontal orientation, perpendicular to edge */}
        <span className="flex items-center justify-center">
          {open ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="13" height="11" viewBox="0 0 13 11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <rect x="0.65" y="0.65" width="11.7" height="9.7" rx="1.4"/>
              <path d="M0.65 2.8L6.5 6.2l5.85-3.4"/>
            </svg>
          )}
        </span>
        {/* Label — vertical, parallel to edge */}
        <span style={{ writingMode: "vertical-rl", fontSize: 9, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" }}>
          Alerts
        </span>
      </button>

      {/* ── Backdrop ────────────────────────────────────────────────────────── */}
      {open && !fullscreen && (
        <div
          className="fixed inset-0 z-[55]"
          style={{ backdropFilter: "blur(1px)" }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Drawer (slides in from LEFT) ────────────────────────────────────── */}
      <div
        ref={drawerRef}
        className="fixed top-0 left-0 h-full z-[60] flex flex-col overflow-hidden"
        style={{
          width: fullscreen ? "100vw" : width,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: resizing.current ? "none" : "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
          background: "rgba(7,9,13,0.99)",
          borderRight: fullscreen ? "none" : "1px solid rgba(0,191,255,0.18)",
          boxShadow: open && !fullscreen ? "12px 0 60px rgba(0,0,0,0.7)" : "none",
        }}
      >
        {/* ── Window chrome ──────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 py-2 flex-shrink-0 gap-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", minHeight: 44 }}
        >
          {/* Toggle pill */}
          <div
            className="flex items-center rounded-full p-0.5 flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {(["announcements", "email"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full transition-all"
                style={{
                  background: tab === t ? (t === "email" ? "rgba(0,191,255,0.2)" : "rgba(247,183,0,0.2)") : "transparent",
                  color: tab === t ? (t === "email" ? "#00bfff" : "#f7b700") : "rgba(255,255,255,0.3)",
                  border: tab === t ? `1px solid ${t === "email" ? "rgba(0,191,255,0.4)" : "rgba(247,183,0,0.4)"}` : "1px solid transparent",
                }}
              >
                {t === "email" ? "✉ Inbox" : "📢 Alerts"}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={zoomOut} title="Zoom out" disabled={zoom <= ZOOM_STEPS[0]}
              className="w-7 h-7 rounded-md flex items-center justify-center text-xs transition-all disabled:opacity-30"
              style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)" }}>−</button>
            <button onClick={zoomReset} title={`Zoom: ${Math.round(zoom * 100)}% (click to reset)`}
              className="text-[9px] font-mono px-1.5 h-7 rounded-md transition-all"
              style={{ color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.05)", minWidth: 36 }}>
              {Math.round(zoom * 100)}%</button>
            <button onClick={zoomIn} title="Zoom in" disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              className="w-7 h-7 rounded-md flex items-center justify-center text-xs transition-all disabled:opacity-30"
              style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)" }}>+</button>

            <div className="w-px h-4 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

            <button onClick={popout} title="Open in new window"
              className="w-7 h-7 rounded-md flex items-center justify-center text-xs transition-all hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.4)" }}>⧉</button>
            <button onClick={() => setFullscreen((p) => !p)} title={fullscreen ? "Exit full screen (Esc)" : "Full screen"}
              className="w-7 h-7 rounded-md flex items-center justify-center text-xs transition-all hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.4)" }}>{fullscreen ? "⊡" : "⊞"}</button>
            <button onClick={() => { setOpen(false); setFullscreen(false); }} title="Close (Esc)"
              className="w-7 h-7 rounded-md flex items-center justify-center text-xs transition-all hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.4)" }}>✕</button>
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden" style={{ fontSize: `${zoom}rem` }}>
          {tab === "announcements" && (
            <div className="h-full overflow-y-auto p-4">
              <AnnouncementsPanel />
              <div className="text-center py-16 text-white/20 text-sm select-none">
                All caught up — no pending announcements.
              </div>
            </div>
          )}
          {tab === "email" && (
            <EmailErrorBoundary>
              <EmailClient zoom={zoom} />
            </EmailErrorBoundary>
          )}
        </div>

        {/* ── Right-edge drag handle (resize) ────────────────────────────────── */}
        {!fullscreen && (
          <div
            onMouseDown={onResizeStart}
            className="absolute top-0 right-0 h-full w-1.5 cursor-ew-resize z-10 group"
            style={{ background: "transparent" }}
            title="Drag to resize"
          >
            <div
              className="absolute inset-y-0 right-0 w-px group-hover:w-1 transition-all"
              style={{ background: "rgba(0,191,255,0.15)" }}
            />
          </div>
        )}
      </div>
    </>
  );
}

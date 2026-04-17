"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import TopNav from "../components/TopNav";
import DashCard from "../components/DashCard";
import UsersCard from "../components/UsersCard";
import ActivityModal from "../components/ActivityModal";
import AnnouncementsPanel from "../components/AnnouncementsPanel";
import ClaudeIcon from "../components/claude/ClaudeIcon";
import ClaudeMenuModal from "../components/claude/ClaudeMenuModal";
import SandboxIcon from "../components/sandbox/SandboxIcon";
import SandboxModal from "../components/sandbox/SandboxModal";
import LibraryIcon from "../components/LibraryIcon";
import LibraryModal from "../components/LibraryModal";
import SuggestionBoxModal from "../components/suggestion/SuggestionBoxModal";
import Link from "next/link";

type DashTile = {
  key: string;
  title: string;
  subtitle: string;
  glow: "cyan" | "pink" | "gold" | "orange" | "violet";
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
};

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

const GLOW_RGB: Record<string, string> = {
  cyan:   "0,191,255",
  pink:   "255,78,203",
  gold:   "247,183,0",
  orange: "217,119,87",
  violet: "167,139,250",
};

const GLOW_HEX: Record<string, string> = {
  cyan:   "#00bfff",
  pink:   "#ff4ecb",
  gold:   "#f7b700",
  orange: "#d97757",
  violet: "#a78bfa",
};

const TILE_LIMIT = 10; // GPG only kicks in when filtered tiles exceed this

export default function Home() {
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityOpen, setActivityOpen] = useState(false);
  const [claudeOpen, setClaudeOpen] = useState(false);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);

  // SBDM state for dash
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState("");
  const [asc, setAsc] = useState(true);
  const sbdmRef = useRef<HTMLDivElement | null>(null);

  // GPG state for dash
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch("/api/activity")
      .then((r) => r.json())
      .then(setActivity)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (sbdmRef.current && !sbdmRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => { setPage(0); }, [filter]);

  const tiles: DashTile[] = useMemo(() => [
    { key: "Processes", title: "Processes", subtitle: "PM2",        glow: "cyan",   icon: <span className="text-2xl">⚡</span>, href: "/dashboard/processes" },
    { key: "Deploy",    title: "Deploy",    subtitle: "Projects",   glow: "pink",   icon: <span className="text-2xl">🚀</span>, href: "/dashboard/deploy" },
    { key: "Database",  title: "Database",  subtitle: "PostgreSQL", glow: "gold",   icon: <span className="text-2xl">🗄️</span>, href: "/dashboard/database" },
    { key: "Storage",   title: "Storage",   subtitle: "Files",      glow: "pink",   icon: <span className="text-2xl">📦</span>, href: "/dashboard/storage" },
    { key: "Editor",    title: "Editor",    subtitle: "Code",       glow: "gold",   icon: <span className="text-2xl">✎</span>,  href: "/dashboard/editor" },
    { key: "Utils",     title: "Utils",     subtitle: "Tooling",    glow: "cyan",   icon: <span className="text-2xl">🔧</span>, href: "/dashboard/utils" },
    { key: "Claude",    title: "Claude",    subtitle: "AI Assistant", glow: "orange", icon: <ClaudeIcon size={28} color="#d97757" />, onClick: () => setClaudeOpen(true) },
    { key: "Sandbox",   title: "Sandbox",   subtitle: "Component Lab", glow: "pink", icon: <SandboxIcon size={28} color="#ff4ecb" />, onClick: () => setSandboxOpen(true) },
    { key: "Library",   title: "Library",   subtitle: "Catalog",    glow: "violet", icon: <LibraryIcon size={28} color="#a78bfa" />, onClick: () => setLibraryOpen(true) },
    { key: "Suggest", title: "Suggest", subtitle: "Feature ideas", glow: "pink", icon: <span className="text-2xl">💡</span>, onClick: () => setSuggestionOpen(true) },
  ], []);

  const filteredTiles = useMemo(
    () => tiles.filter((t) => t.title.toLowerCase().includes(filter.toLowerCase())),
    [tiles, filter]
  );

  const panelList = useMemo(() => {
    return tiles
      .filter((t) => t.title.toLowerCase().includes(inner.toLowerCase()))
      .slice()
      .sort((a, b) => asc ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title));
  }, [tiles, inner, asc]);

  const paginationActive = filteredTiles.length > TILE_LIMIT;
  const totalPages = paginationActive ? Math.ceil(filteredTiles.length / TILE_LIMIT) : 1;
  const safePage = Math.min(page, totalPages - 1);
  const pageTiles = paginationActive
    ? filteredTiles.slice(safePage * TILE_LIMIT, (safePage + 1) * TILE_LIMIT)
    : filteredTiles;

  return (
    <>
      {activityOpen && <ActivityModal onClose={() => setActivityOpen(false)} />}
      {claudeOpen && <ClaudeMenuModal onClose={() => setClaudeOpen(false)} />}
      {sandboxOpen && <SandboxModal onClose={() => setSandboxOpen(false)} />}
      {libraryOpen && <LibraryModal onClose={() => setLibraryOpen(false)} />}
      {suggestionOpen && <SuggestionBoxModal onClose={() => setSuggestionOpen(false)} />}
      <TopNav />
      <main className="flex flex-col min-h-screen pt-28 pb-16 px-4 max-w-7xl mx-auto w-full">

        {/* Hero */}
        <section className="mb-6">
          <div className="mb-2" style={{ height: "1.25rem" }} />
          <h1
            className="text-4xl md:text-5xl font-bold leading-tight mb-3"
            style={{ color: "#ff4ecb", textShadow: "0 0 8px #ff66cc, 0 0 20px #ff4ecb" }}
          >
            TGV Office
          </h1>
          <p className="text-white/50 text-base max-w-lg">
            Internal operations hub. Manage processes, deploys, and infrastructure
            for all TGV &amp; Refusionist projects.
          </p>
        </section>

        {/* Dash — SBDM */}
        <section ref={sbdmRef} className="relative mb-3">
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,78,203,0.22)",
            }}
          >
            <span className="text-pink-400/70 text-sm">🔍</span>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter dash…"
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/30"
            />
            <button
              onClick={() => setOpen((v) => !v)}
              className="text-pink-400 text-xs px-2 py-1 rounded-md hover:bg-pink-500/10 transition-colors"
              aria-label="Open tile list"
            >
              ▾
            </button>
          </div>

          {open && (
            <div
              className="absolute left-0 right-0 mt-2 rounded-xl z-30 overflow-hidden"
              style={{
                background: "rgba(10,8,20,0.96)",
                border: "1px solid rgba(255,78,203,0.28)",
                boxShadow: "0 12px 32px rgba(0,0,0,0.6), 0 0 24px rgba(255,78,203,0.12)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div className="flex items-center gap-2 p-2 border-b border-white/5">
                <input
                  value={inner}
                  onChange={(e) => setInner(e.target.value)}
                  placeholder="Search…"
                  autoFocus
                  className="flex-1 bg-white/5 rounded-md px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/30"
                />
                <button
                  onClick={() => setAsc((v) => !v)}
                  className="px-2 py-1.5 rounded-md text-[10px] font-bold tracking-wider"
                  style={{
                    background: "rgba(0,191,255,0.08)",
                    border: "1px solid rgba(0,191,255,0.3)",
                    color: "#00bfff",
                  }}
                >
                  {asc ? "Z-A" : "A-Z"}
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {panelList.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-white/30 text-center">No matches</div>
                ) : panelList.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => { setFilter(t.title); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-white/70 hover:bg-white/5 transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: GLOW_HEX[t.glow] }} />
                    <span className="truncate">{t.title}</span>
                    <span className="ml-auto text-[10px] text-white/30">{t.subtitle}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Dash — tile grid (responsive 1 → 2 → 3 → 5 cols) */}
        <section className="grid grid-cols-1 min-[600px]:grid-cols-2 min-[900px]:grid-cols-3 min-[1200px]:grid-cols-5 gap-3 mb-3">
          {pageTiles.length === 0 ? (
            <div className="col-span-full text-center text-xs text-white/30 py-8">No tiles match "{filter}"</div>
          ) : pageTiles.map((tile) => {
            const accent = GLOW_HEX[tile.glow];
            const glowRgb = GLOW_RGB[tile.glow];
            const isSuggest = tile.key === "Suggest";
            const tileInner = (
              <div
                className="flex flex-col items-center justify-center gap-2 rounded-2xl py-5 px-3 transition-all h-full"
                style={{
                  background: isSuggest ? "transparent" : `rgba(${glowRgb},0.06)`,
                  border: isSuggest ? `2px dashed rgba(${glowRgb},0.35)` : `1px solid rgba(${glowRgb},0.18)`,
                  boxShadow: `0 0 0 0 rgba(${glowRgb},0)`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 18px rgba(${glowRgb},0.18)`; (e.currentTarget as HTMLElement).style.background = `rgba(${glowRgb},0.10)`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 0 rgba(${glowRgb},0)`; (e.currentTarget as HTMLElement).style.background = `rgba(${glowRgb},0.06)`; }}
              >
                {tile.icon}
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accent }}>{tile.title}</span>
                <span className="text-[10px] text-white/35">{tile.subtitle}</span>
              </div>
            );
            if (tile.href) {
              return <Link key={tile.key} href={tile.href} className="no-underline group">{tileInner}</Link>;
            }
            return (
              <button
                key={tile.key}
                onClick={tile.onClick}
                className="no-underline group text-left"
                style={{ padding: 0, background: "none", border: "none" }}
              >
                {tileInner}
              </button>
            );
          })}
        </section>

        {/* Dash — GPG paginator */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mb-6">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all disabled:opacity-30"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.6)",
              }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.borderColor = "rgba(0,191,255,0.5)"; e.currentTarget.style.color = "#00bfff"; }}}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            >
              ‹
            </button>
            <span className="text-xs font-mono text-white/60 tabular-nums">
              {safePage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage === totalPages - 1}
              className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all disabled:opacity-30"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.6)",
              }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.borderColor = "rgba(0,191,255,0.5)"; e.currentTarget.style.color = "#00bfff"; }}}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            >
              ›
            </button>
          </div>
        )}

        {/* Announcements — renders only when there are pending items */}
        <AnnouncementsPanel className="mb-4" />

        {/* Bottom: team + activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <UsersCard className="lg:col-span-1" />

          {/* Activity card — click to open modal */}
          <button
            onClick={() => setActivityOpen(true)}
            className="lg:col-span-2 text-left w-full"
          >
            <DashCard title="Recent Activity" subtitle="Click to expand · PM2 + git" glow="cyan" className="h-full">
              <div className="flex flex-col divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                {activity.length === 0 ? (
                  <div className="py-3 text-xs text-white/25">Loading activity…</div>
                ) : (
                  activity.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5">
                      <span className="text-[10px] font-mono text-white/25 w-12 shrink-0 text-right">{item.timeLabel}</span>
                      <span
                        className="text-[10px] font-bold shrink-0 uppercase tracking-wide w-8"
                        style={{ color: TYPE_COLOR[item.type] ?? "#fff" }}
                      >{item.type}</span>
                      <span className="text-xs text-white/55 truncate">{item.event}</span>
                    </div>
                  ))
                )}
              </div>
              {activity.length > 5 && (
                <p className="text-[10px] text-white/25 mt-2">+{activity.length - 5} more · click to view all</p>
              )}
            </DashCard>
          </button>
        </div>
      </main>
    </>
  );
}

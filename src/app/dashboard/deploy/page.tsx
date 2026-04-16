"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import TopNav from "../../components/TopNav";
import { usePreview } from "../../components/PreviewDrawer";

type Project = {
  name: string;
  port: string | null;
  url: string;
  pm2Status: string | null;
  pm2Restarts: number;
  lastCommit: { timeAgo: string; author: string; subject: string } | null;
};

const STATUS_COLOR: Record<string, string> = {
  online:  "#4ade80",
  stopped: "#6b7280",
  errored: "#ff6b6b",
};

const PAGE_SIZE = 9;

export default function DeployPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const { openPreview } = usePreview();

  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState("");
  const [asc, setAsc] = useState(true);
  const sbdmRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) setProjects(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const filteredProjects = useMemo(
    () => projects.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase())),
    [projects, filter]
  );

  const panelList = useMemo(() => {
    const list = projects
      .filter((p) => p.name.toLowerCase().includes(inner.toLowerCase()))
      .slice()
      .sort((a, b) => asc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    return list;
  }, [projects, inner, asc]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageProjects = filteredProjects.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <>
      <TopNav />
      <main className="flex flex-col min-h-screen pt-28 pb-16 px-4 max-w-6xl mx-auto w-full gap-6">

        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1
              className="text-3xl font-bold mb-1"
              style={{ color: "#ff4ecb", textShadow: "0 0 8px #ff66cc, 0 0 20px #ff4ecb" }}
            >
              Deploy
            </h1>
            <p className="text-sm text-white/40">
              {projects.length} projects — click any tile to preview the live deployment
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/editor"
              className="px-4 py-2 rounded-xl text-xs font-bold border transition-colors"
              style={{
                borderColor: "rgba(247,183,0,0.35)",
                color: "#f7b700",
                background: "rgba(247,183,0,0.08)",
              }}
            >
              ✎ Editor
            </Link>
            <button
              onClick={load}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-pink-500/30 text-pink-400 hover:bg-pink-500/10 transition-colors"
            >
              ↺ Refresh
            </button>
          </div>
        </div>

        {/* SBDM */}
        <div ref={sbdmRef} className="relative">
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
              placeholder="Filter projects…"
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/30"
            />
            <button
              onClick={() => setOpen((v) => !v)}
              className="text-pink-400 text-xs px-2 py-1 rounded-md hover:bg-pink-500/10 transition-colors"
              aria-label="Open project list"
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
                ) : panelList.map((p) => {
                  const dot = p.pm2Status ? (STATUS_COLOR[p.pm2Status] ?? "#6b7280") : "#6b7280";
                  return (
                    <button
                      key={p.name}
                      onClick={() => { setFilter(p.name); setOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-white/70 hover:bg-white/5 transition-colors"
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : pageProjects.length === 0 ? (
          <div className="text-center text-xs text-white/30 py-12">No projects match "{filter}"</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pageProjects.map((proj) => (
              <ProjectTile
                key={proj.name}
                project={proj}
                onClick={() => openPreview(proj.name)}
              />
            ))}
          </div>
        )}

        {/* GPG pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all disabled:opacity-30"
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
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all disabled:opacity-30"
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
      </main>
    </>
  );
}

function ProjectTile({ project: p, onClick }: { project: Project; onClick: () => void }) {
  const statusColor = p.pm2Status ? (STATUS_COLOR[p.pm2Status] ?? "#6b7280") : "#6b7280";
  const isOnline = p.pm2Status === "online";

  return (
    <button
      onClick={onClick}
      className="text-left rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200 group"
      style={{
        background: "linear-gradient(44deg, hsla(190,100%,12%,0.45), rgba(0,0,0,0.8))",
        border: `1px solid ${isOnline ? "rgba(255,78,203,0.18)" : "rgba(255,255,255,0.07)"}`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
        (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px rgba(255,78,203,0.2)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.boxShadow = "";
      }}
    >
      {/* Top row: status dot + name */}
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-sm font-bold leading-tight break-all"
          style={{ color: isOnline ? "#fff" : "rgba(255,255,255,0.4)" }}
        >
          {p.name}
        </span>
        <span
          className="w-2 h-2 rounded-full shrink-0 mt-1"
          style={{
            background: statusColor,
            boxShadow: isOnline ? `0 0 6px ${statusColor}` : "none",
            animation: isOnline ? "pulse-green 2.5s ease-in-out infinite" : "none",
          }}
        />
      </div>

      {/* Port + status */}
      <div className="flex items-center gap-2 text-xs">
        {p.port && (
          <span className="font-mono" style={{ color: "#00bfff" }}>:{p.port}</span>
        )}
        {p.pm2Status && (
          <span style={{ color: statusColor }}>{p.pm2Status}</span>
        )}
        {p.pm2Restarts > 0 && (
          <span className="text-yellow-500/60">↺ {p.pm2Restarts}</span>
        )}
      </div>

      {/* Last commit */}
      {p.lastCommit ? (
        <div className="text-xs text-white/35 leading-relaxed">
          <span className="text-white/50">{p.lastCommit.timeAgo}</span>
          {" · "}
          <span className="truncate">{p.lastCommit.subject}</span>
        </div>
      ) : (
        <div className="text-xs text-white/20">No commits</div>
      )}

      {/* Bottom actions */}
      <div className="mt-auto flex items-center justify-between">
        <div
          className="text-xs font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: "#ff4ecb" }}
        >
          🌐 Open Preview →
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link
            href={`/dashboard/editor?project=${encodeURIComponent(p.name)}`}
            onClick={(e) => e.stopPropagation()}
            title={`Open ${p.name} in editor`}
            className="text-[10px] font-bold px-2 py-1 rounded-lg"
            style={{
              background: "rgba(247,183,0,0.1)",
              border: "1px solid rgba(247,183,0,0.3)",
              color: "#f7b700",
            }}
          >
            ✎ Editor
          </Link>
          <Link
            href={`/dashboard/storage?project=${encodeURIComponent(p.name)}`}
            onClick={(e) => e.stopPropagation()}
            title={`Upload files to ${p.name} CDN bucket`}
            className="text-[10px] font-bold px-2 py-1 rounded-lg"
            style={{
              background: "rgba(0,191,255,0.1)",
              border: "1px solid rgba(0,191,255,0.3)",
              color: "#00bfff",
            }}
          >
            📁 Upload
          </Link>
        </div>
      </div>
    </button>
  );
}

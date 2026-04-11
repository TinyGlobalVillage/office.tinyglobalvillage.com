"use client";

import { useState, useEffect, useCallback } from "react";
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

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) setProjects(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(projects.length / PAGE_SIZE);
  const pageProjects = projects.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
          <button
            onClick={load}
            className="px-4 py-2 rounded-xl text-xs font-bold border border-pink-500/30 text-pink-400 hover:bg-pink-500/10 transition-colors"
          >
            ↺ Refresh
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-white/10 text-white/50 disabled:opacity-30 hover:border-pink-500/40 hover:text-pink-400 transition-all"
            >
              ← Prev
            </button>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className="w-7 h-7 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: i === page ? "rgba(255,78,203,0.2)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${i === page ? "rgba(255,78,203,0.5)" : "rgba(255,255,255,0.08)"}`,
                    color: i === page ? "#ff4ecb" : "rgba(255,255,255,0.4)",
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-white/10 text-white/50 disabled:opacity-30 hover:border-pink-500/40 hover:text-pink-400 transition-all"
            >
              Next →
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

      {/* Preview hint */}
      <div
        className="mt-auto text-xs font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "#ff4ecb" }}
      >
        🌐 Open Preview →
      </div>
    </button>
  );
}

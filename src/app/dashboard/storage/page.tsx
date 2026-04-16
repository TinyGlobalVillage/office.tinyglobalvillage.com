"use client";

import { useState, useEffect, useCallback, useRef, DragEvent, Suspense, KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import TopNav from "../../components/TopNav";

const CDN_BASE = "https://office.tinyglobalvillage.com/media";

type CdnFile = {
  name: string;
  url: string;
  size: number;
  type: string;
  project: string;
  modifiedAt: number;
};

type ProjectMeta = { name: string; count: number };

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short", day: "numeric", year: "numeric",
  });
}

function isImage(type: string) {
  return type.startsWith("image/");
}

function isVideo(type: string) {
  return type.startsWith("video/");
}

function fileIcon(type: string) {
  if (isImage(type)) return "🖼";
  if (isVideo(type)) return "🎬";
  if (type.startsWith("audio/")) return "🎵";
  if (type === "application/pdf") return "📄";
  if (type.startsWith("font/")) return "🔤";
  return "📁";
}

// ── Upload zone ───────────────────────────────────────────────────────────────
function UploadZone({
  project,
  onUploaded,
}: {
  project: string;
  onUploaded: (f: CdnFile) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      setUploading(list.map((f) => f.name));

      for (const file of list) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("project", project);
        try {
          const res = await fetch("/api/cdn/upload", { method: "POST", body: fd });
          if (res.ok) {
            const data: CdnFile = await res.json();
            onUploaded(data);
            setLastUrl(data.url);
          }
        } catch { /* skip */ }
      }
      setUploading([]);
    },
    [project, onUploaded]
  );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  const copy = () => {
    if (!lastUrl) return;
    navigator.clipboard.writeText(lastUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className="relative flex flex-col items-center justify-center gap-3 rounded-2xl cursor-pointer transition-all duration-200"
        style={{
          minHeight: 160,
          border: `2px dashed ${dragging ? "#ff4ecb" : "rgba(255,78,203,0.25)"}`,
          background: dragging ? "rgba(255,78,203,0.07)" : "rgba(255,255,255,0.02)",
        }}
      >
        <span className="text-3xl">{uploading.length ? "⏳" : "☁️"}</span>
        {uploading.length ? (
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-bold text-white/60">Uploading…</p>
            {uploading.map((n) => (
              <p key={n} className="text-xs text-white/30 font-mono truncate max-w-xs">{n}</p>
            ))}
          </div>
        ) : (
          <>
            <p className="text-sm font-bold text-white/60">Drop files here or click to browse</p>
            <p className="text-xs text-white/30">Images, videos, PDFs, fonts — up to 100 MB each</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {/* Last uploaded URL */}
      {lastUrl && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)" }}
        >
          <span className="text-green-400 text-xs font-bold shrink-0">✓ Uploaded</span>
          <span className="font-mono text-xs text-white/50 truncate flex-1">{lastUrl}</span>
          <button
            onClick={copy}
            className="shrink-0 text-xs font-bold px-3 py-1 rounded-lg transition-all"
            style={{
              background: copied ? "rgba(74,222,128,0.25)" : "rgba(255,255,255,0.07)",
              border: "1px solid rgba(74,222,128,0.4)",
              color: copied ? "#4ade80" : "#d4d4d4",
            }}
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── File card ─────────────────────────────────────────────────────────────────
function FileCard({ file, onDelete }: { file: CdnFile; onDelete: () => void }) {
  const [copied, setCopied] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(file.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const del = async () => {
    setDeleting(true);
    await fetch(`/api/cdn/files?project=${file.project}&name=${encodeURIComponent(file.name)}`, {
      method: "DELETE",
    });
    onDelete();
  };

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden transition-all duration-150 group"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Preview */}
      <div
        className="relative flex items-center justify-center"
        style={{ height: 120, background: "rgba(0,0,0,0.3)" }}
      >
        {isImage(file.type) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.url}
            alt={file.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : isVideo(file.type) ? (
          <video src={file.url} className="w-full h-full object-cover" muted />
        ) : (
          <span className="text-4xl">{fileIcon(file.type)}</span>
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2 flex flex-col gap-1">
        <p
          className="text-xs font-mono text-white/70 truncate"
          title={file.name}
        >
          {file.name}
        </p>
        <p className="text-[10px] text-white/30">
          {fmtBytes(file.size)} · {fmtDate(file.modifiedAt)}
        </p>
      </div>

      {/* Actions */}
      <div className="px-3 pb-3 flex gap-1.5">
        <button
          onClick={copy}
          title="Copy CDN link"
          className="flex-1 text-[10px] font-bold py-1 rounded-lg transition-all"
          style={{
            background: copied ? "rgba(74,222,128,0.15)" : "rgba(0,191,255,0.1)",
            border: `1px solid ${copied ? "rgba(74,222,128,0.4)" : "rgba(0,191,255,0.3)"}`,
            color: copied ? "#4ade80" : "#00bfff",
          }}
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in new tab"
          className="text-[10px] font-bold px-2 py-1 rounded-lg"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}
        >
          ↗
        </a>
        {confirmDel ? (
          <button
            onClick={del}
            disabled={deleting}
            title="Confirm delete"
            className="text-[10px] font-bold px-2 py-1 rounded-lg"
            style={{ background: "rgba(255,107,107,0.2)", border: "1px solid rgba(255,107,107,0.5)", color: "#ff6b6b" }}
          >
            {deleting ? "…" : "Sure?"}
          </button>
        ) : (
          <button
            onClick={() => setConfirmDel(true)}
            title="Delete file"
            className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all hover:text-red-400"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.25)" }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ── Project dropdown ──────────────────────────────────────────────────────────
function ProjectDropdown({
  projects,
  cdnCounts,
  value,
  onChange,
}: {
  projects: string[];
  cdnCounts: ProjectMeta[];
  value: string;
  onChange: (p: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const filtered = projects.filter((p) =>
    p.toLowerCase().includes(search.toLowerCase())
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus search input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
      setTimeout(() => activeRef.current?.scrollIntoView({ block: "nearest" }), 60);
    }
  }, [open]);

  // ESC closes
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { setOpen(false); setSearch(""); }
    if (e.key === "Enter" && filtered.length === 1) {
      onChange(filtered[0]);
      setOpen(false);
      setSearch("");
    }
  };

  const select = (p: string) => {
    onChange(p);
    setOpen(false);
    setSearch("");
  };

  const count = (p: string) => cdnCounts.find((m) => m.name === p)?.count;

  return (
    <div ref={containerRef} className="relative" style={{ width: 280 }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((x) => !x)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl transition-all text-left"
        style={{
          background: open ? "rgba(0,191,255,0.12)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${open ? "rgba(0,191,255,0.45)" : "rgba(255,255,255,0.1)"}`,
          color: "#00bfff",
          boxShadow: open ? "0 0 0 3px rgba(0,191,255,0.08)" : "none",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] text-white/30 shrink-0 font-bold uppercase tracking-wider">Bucket</span>
          <span className="text-sm font-bold font-mono truncate">{value}</span>
          {count(value) !== undefined && (
            <span className="text-[10px] text-white/30 shrink-0">{count(value)} files</span>
          )}
        </div>
        <span
          className="shrink-0 text-[10px] transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", color: "rgba(0,191,255,0.6)" }}
        >
          ▼
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute left-0 right-0 z-50 flex flex-col overflow-hidden"
          style={{
            top: "calc(100% + 6px)",
            background: "rgba(8,10,16,0.99)",
            border: "1px solid rgba(0,191,255,0.25)",
            borderRadius: 14,
            boxShadow: "0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,191,255,0.06)",
            maxHeight: 320,
          }}
        >
          {/* Search input */}
          <div
            className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span className="text-white/30 text-xs">⌕</span>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search projects…"
              className="flex-1 bg-transparent outline-none text-xs font-mono placeholder:text-white/20"
              style={{ color: "#e4e4e4" }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-white/25 hover:text-white/60 transition-colors text-xs"
              >
                ×
              </button>
            )}
          </div>

          {/* Project list */}
          <div className="overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-xs text-white/25 text-center">No projects match</p>
            ) : (
              filtered.map((p) => {
                const isActive = p === value;
                const n = count(p);
                return (
                  <button
                    key={p}
                    ref={isActive ? activeRef : undefined}
                    onClick={() => select(p)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{
                      background: isActive ? "rgba(0,191,255,0.1)" : "transparent",
                      borderLeft: `2px solid ${isActive ? "#00bfff" : "transparent"}`,
                      color: isActive ? "#00bfff" : "rgba(255,255,255,0.55)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <span className="text-sm font-mono font-bold truncate">{p}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {n !== undefined && (
                        <span className="text-[10px] text-white/30">{n} files</span>
                      )}
                      {isActive && <span className="text-[10px]">✓</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StoragePage() {
  return (
    <Suspense fallback={null}>
      <StoragePageInner />
    </Suspense>
  );
}

function StoragePageInner() {
  const searchParams = useSearchParams();
  const [cdnProjects, setCdnProjects] = useState<ProjectMeta[]>([]);
  const [deployedProjectNames, setDeployedProjectNames] = useState<string[]>([]);
  const [activeProject, setActiveProject] = useState(searchParams.get("project") ?? "office");
  const [files, setFiles] = useState<CdnFile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  // Load CDN bucket list + deployed project list in parallel
  useEffect(() => {
    fetch("/api/cdn/files")
      .then((r) => r.json())
      .then((d: { projects: ProjectMeta[] }) => setCdnProjects(d.projects ?? []))
      .catch(() => {});
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d: { name: string }[]) => setDeployedProjectNames(d.map((p) => p.name)))
      .catch(() => {});
  }, []);

  // Load files for active project
  const loadFiles = useCallback(async (proj: string, p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cdn/files?project=${proj}&page=${p}`);
      if (res.ok) {
        const d = await res.json();
        setFiles(d.files ?? []);
        setTotal(d.total ?? 0);
        setPage(d.page ?? 1);
        setTotalPages(d.totalPages ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles(activeProject, 1);
  }, [activeProject, loadFiles]);

  const handleUploaded = (f: CdnFile) => {
    setFiles((prev) => [f, ...prev]);
    setTotal((t) => t + 1);
    // Update CDN project count
    setCdnProjects((prev) => {
      const idx = prev.findIndex((p) => p.name === f.project);
      if (idx === -1) return [...prev, { name: f.project, count: 1 }];
      const next = [...prev];
      next[idx] = { ...next[idx], count: next[idx].count + 1 };
      return next;
    });
  };

  const handleDelete = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setTotal((t) => Math.max(0, t - 1));
  };

  const filteredFiles = filter
    ? files.filter((f) => f.name.toLowerCase().includes(filter.toLowerCase()))
    : files;

  // All known projects = "office" + all deployed + any CDN-only buckets
  const allProjects = Array.from(
    new Set(["office", ...deployedProjectNames, ...cdnProjects.map((p) => p.name)])
  );

  // For display counts
  const projects = cdnProjects;

  return (
    <>
      <TopNav />
      <main className="flex flex-col min-h-screen pt-28 pb-16 px-4 max-w-7xl mx-auto w-full gap-6">

        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1
              className="text-3xl font-bold mb-1"
              style={{ color: "#00bfff", textShadow: "0 0 8px #00bfff, 0 0 20px #00bfff" }}
            >
              Storage
            </h1>
            <p className="text-xs text-white/40">
              Files are served at{" "}
              <span className="font-mono text-white/50">{CDN_BASE}/&#123;project&#125;/&#123;file&#125;</span>
              {" "}— publicly accessible, immutable cache
            </p>
          </div>
        </div>

        {/* Project selector */}
        <ProjectDropdown
          projects={allProjects}
          cdnCounts={projects}
          value={activeProject}
          onChange={(p) => { setActiveProject(p); setPage(1); }}
        />

        {/* Upload zone */}
        <UploadZone project={activeProject} onUploaded={handleUploaded} />

        {/* Filter + count */}
        {total > 0 && (
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Filter files…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-mono outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#d4d4d4",
              }}
            />
            <span className="text-xs text-white/30">
              {filteredFiles.length} of {total} file{total !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* File grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : filteredFiles.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span className="text-4xl mb-3">☁️</span>
            <p className="text-sm text-white/40 font-bold">No files yet</p>
            <p className="text-xs text-white/25 mt-1">Drop files above to upload to the <span className="font-mono">{activeProject}</span> bucket</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredFiles.map((f) => (
              <FileCard key={f.name} file={f} onDelete={() => handleDelete(f.name)} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => loadFiles(activeProject, page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-white/10 text-white/40 disabled:opacity-30 hover:border-cyan-500/40 hover:text-cyan-400 transition-all"
            >
              ← Prev
            </button>
            <span className="text-xs text-white/30">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => loadFiles(activeProject, page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-white/10 text-white/40 disabled:opacity-30 hover:border-cyan-500/40 hover:text-cyan-400 transition-all"
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </>
  );
}

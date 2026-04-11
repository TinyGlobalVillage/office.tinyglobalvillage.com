"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

// ── Context ──────────────────────────────────────────────────────
type PreviewCtx = {
  isOpen: boolean;
  domain: string | null;
  openPreview: (domain: string) => void;
  closePreview: () => void;
  togglePreview: () => void;
};

const Ctx = createContext<PreviewCtx | null>(null);

export function usePreview() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePreview must be inside PreviewProvider");
  return ctx;
}

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [domain, setDomain] = useState<string | null>(null);

  const openPreview = useCallback((d: string) => {
    setDomain(d);
    setIsOpen(true);
  }, []);

  return (
    <Ctx.Provider
      value={{
        isOpen,
        domain,
        openPreview,
        closePreview: () => setIsOpen(false),
        togglePreview: () => setIsOpen((p) => !p),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

// ── Drawer component ─────────────────────────────────────────────
type Project = { name: string; port: string | null; url: string };

export default function PreviewDrawer() {
  const { isOpen, domain, openPreview, closePreview } = usePreview();
  const [projects, setProjects] = useState<Project[]>([]);
  const [iframeKey, setIframeKey] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: Project[]) => {
        setProjects(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const currentUrl = domain ? `https://${domain}` : null;

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) closePreview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closePreview]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={closePreview}
        />
      )}

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: "clamp(320px, 65vw, 1100px)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          background: "rgba(8, 8, 12, 0.98)",
          borderLeft: "1px solid rgba(255,78,203,0.2)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          {/* Close */}
          <button
            onClick={closePreview}
            className="text-white/40 hover:text-white transition-colors text-sm mr-1"
          >
            ✕
          </button>

          {/* Project selector */}
          <select
            value={domain ?? ""}
            onChange={(e) => openPreview(e.target.value)}
            className="flex-1 text-xs font-mono px-3 py-1.5 rounded-lg border outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              borderColor: "rgba(255,78,203,0.3)",
              color: "#ededed",
            }}
            disabled={loading}
          >
            <option value="">— select project —</option>
            {projects.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
                {p.port ? ` :${p.port}` : ""}
              </option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={() => setIframeKey((k) => k + 1)}
            title="Reload preview"
            className="text-white/40 hover:text-cyan-400 transition-colors text-sm"
          >
            ↺
          </button>

          {/* Open in new tab */}
          {currentUrl && (
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new tab"
              className="text-white/40 hover:text-pink-400 transition-colors text-sm"
            >
              ↗
            </a>
          )}
        </div>

        {/* URL bar */}
        {currentUrl && (
          <div
            className="flex items-center px-4 py-1.5 flex-shrink-0 text-xs font-mono"
            style={{
              background: "rgba(255,255,255,0.03)",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            <span style={{ color: "#4ade80" }}>🔒</span>&nbsp;{currentUrl}
          </div>
        )}

        {/* iframe / empty state */}
        <div className="flex-1 relative bg-black">
          {currentUrl ? (
            <iframe
              key={iframeKey}
              src={currentUrl}
              className="w-full h-full border-0"
              title={`Preview: ${domain}`}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-white/30">
              <span className="text-5xl">🌐</span>
              <p className="text-sm">Select a project to preview</p>
              {!loading && (
                <div className="flex flex-col items-center gap-2 mt-2">
                  {projects.slice(0, 6).map((p) => (
                    <button
                      key={p.name}
                      onClick={() => openPreview(p.name)}
                      className="text-xs hover:text-pink-400 transition-colors"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

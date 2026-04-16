"use client";

import { useEffect, useState, useCallback } from "react";

type DepUpdate = {
  package: string;
  current: string;
  latest: string;
  type: string;
};

type ProjectUpdates = {
  name: string;
  dir: string;
  updates: DepUpdate[];
};

type Announcement = {
  id: string;
  created_at: string;
  title: string;
  type: "dep-update";
  status: "pending" | "dismissed";
  dismissed_by?: string;
  dismissed_at?: string;
  data: {
    projects: ProjectUpdates[];
    total_updates: number;
  };
};

export default function AnnouncementsPanel({
  className = "",
}: {
  className?: string;
}) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const pending = items.filter((a) => a.status === "pending");

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements");
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, [poll]);

  const dismiss = async (id: string) => {
    setDismissing(id);
    try {
      const res = await fetch("/api/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, status: "dismissed" as const } : a
          )
        );
      }
    } finally {
      setDismissing(null);
    }
  };

  // Don't render anything when loaded and empty
  if (!loading && pending.length === 0) return null;

  return (
    <div className={`card-tgv glow-gold p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">📦</span>
          <h3
            className="text-sm font-bold uppercase tracking-widest"
            style={{ color: "#f7b700" }}
          >
            Pending Updates
          </h3>
        </div>
        {!loading && (
          <span className="text-xs text-white/30">
            {pending.length} announcement{pending.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading ? (
        <div
          className="h-10 rounded-lg animate-pulse"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {pending.map((ann) => (
            <div
              key={ann.id}
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{
                background: "rgba(247,183,0,0.05)",
                border: "1px solid rgba(247,183,0,0.2)",
              }}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold text-white leading-snug">
                    {ann.title}
                  </p>
                  <p className="text-[10px] text-white/30 font-mono">
                    {new Date(ann.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <button
                  onClick={() => dismiss(ann.id)}
                  disabled={dismissing === ann.id}
                  className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg shrink-0 transition-all disabled:opacity-40 hover:brightness-125"
                  style={{
                    background: "rgba(247,183,0,0.12)",
                    border: "1px solid rgba(247,183,0,0.35)",
                    color: "#f7b700",
                  }}
                >
                  {dismissing === ann.id ? "…" : "Dismiss"}
                </button>
              </div>

              {/* Per-project update pills */}
              {ann.type === "dep-update" &&
                ann.data?.projects?.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {ann.data.projects.map((proj) => (
                      <div key={proj.name}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                          {proj.name}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {proj.updates.map((u) => {
                            const isMajor = u.type === "major";
                            return (
                              <span
                                key={u.package}
                                title={`${u.package}: ${u.current} → ${u.latest}`}
                                className="text-[10px] font-mono px-2 py-0.5 rounded-md"
                                style={{
                                  background: isMajor
                                    ? "rgba(255,78,203,0.1)"
                                    : "rgba(0,191,255,0.08)",
                                  border: `1px solid ${
                                    isMajor
                                      ? "rgba(255,78,203,0.3)"
                                      : "rgba(0,191,255,0.2)"
                                  }`,
                                  color: isMajor ? "#ff4ecb" : "#00bfff",
                                }}
                              >
                                {u.package}{" "}
                                <span style={{ color: "rgba(255,255,255,0.35)" }}>
                                  {u.current} →
                                </span>{" "}
                                {u.latest}
                                {isMajor && (
                                  <span
                                    className="ml-1 text-[9px] font-bold"
                                    style={{ color: "#ff4ecb" }}
                                  >
                                    MAJOR
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

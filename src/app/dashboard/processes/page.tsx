"use client";

import { useState, useEffect, useCallback } from "react";
import TopNav from "../../components/TopNav";
import { useTerminal } from "../../components/TerminalProvider";
import { usePreview } from "../../components/PreviewDrawer";

type Proc = {
  id: number;
  name: string;
  status: "online" | "stopped" | "errored" | string;
  restarts: number;
  uptime: number | null;
  memoryMb: number | null;
  cpu: number | null;
  port: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  online: "#4ade80",
  stopped: "#6b7280",
  errored: "#ff6b6b",
};

function formatUptime(ms: number | null) {
  if (!ms) return "—";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d`;
}

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<Proc[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const { runCommand, isRunning } = useTerminal();
  const { openPreview } = usePreview();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/pm2");
      if (res.ok) {
        const data = await res.json();
        setProcesses(data);
        setLastRefresh(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <>
      <TopNav />
      <main className="flex flex-col min-h-screen pt-28 pb-32 px-4 max-w-6xl mx-auto w-full gap-5">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1
              className="text-3xl font-bold mb-1"
              style={{
                color: "#00bfff",
                textShadow: "0 0 8px #00bfff, 0 0 20px #00bfff",
              }}
            >
              Processes
            </h1>
            <p className="text-xs text-white/40">
              PM2 — auto-refreshes every 10s
              {lastRefresh && (
                <span className="ml-2 text-white/25">
                  last: {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={refresh}
              title="Manually refresh PM2 process list"
              className="px-4 py-2 rounded-xl text-xs font-bold border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
            >
              ↺ Refresh
            </button>
            <button
              onClick={() => runCommand("pm2-save", [])}
              disabled={isRunning}
              title="Save PM2 process list so it survives reboots"
              className="px-4 py-2 rounded-xl text-xs font-bold border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-colors disabled:opacity-40"
            >
              💾 Save List
            </button>
          </div>
        </div>

        {/* Summary bar */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                {
                  label: "Online",
                  count: processes.filter((p) => p.status === "online").length,
                  color: "#4ade80",
                },
                {
                  label: "Stopped",
                  count: processes.filter((p) => p.status === "stopped").length,
                  color: "#6b7280",
                },
                {
                  label: "Errored",
                  count: processes.filter((p) => p.status === "errored").length,
                  color: "#ff6b6b",
                },
              ] as const
            ).map(({ label, count, color }) => (
              <div
                key={label}
                className="rounded-xl px-4 py-3 flex items-center justify-between"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${color}22`,
                }}
              >
                <span className="text-xs text-white/40">{label}</span>
                <span className="text-lg font-bold" style={{ color }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Process list */}
        <div className="flex flex-col gap-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl animate-pulse"
                style={{ background: "rgba(255,255,255,0.04)" }}
              />
            ))
          ) : (
            processes.map((proc) => (
              <ProcessRow
                key={proc.id}
                proc={proc}
                onAction={(action) => {
                  if (action === "preview" && proc.port) {
                    openPreview(proc.name);
                  } else if (action === "restart") {
                    runCommand("pm2-restart", ["--update-env", proc.name]);
                  } else if (action === "stop") {
                    runCommand("pm2-stop", [proc.name]);
                  } else if (action === "logs") {
                    runCommand("pm2-logs", [proc.name]);
                  }
                }}
              />
            ))
          )}
        </div>
      </main>
    </>
  );
}

function ProcessRow({
  proc,
  onAction,
}: {
  proc: Proc;
  onAction: (action: string) => void;
}) {
  const { isRunning } = useTerminal();
  const statusColor = STATUS_COLOR[proc.status] ?? "#6b7280";
  const isWebProject = proc.port !== null;

  return (
    <div
      className="flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-150"
      style={{
        background: "linear-gradient(44deg, hsla(190,100%,12%,0.35), rgba(0,0,0,0.7))",
        border: `1px solid ${statusColor}18`,
      }}
    >
      {/* Status dot */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{
          background: statusColor,
          boxShadow: proc.status === "online" ? `0 0 6px ${statusColor}` : "none",
        }}
      />

      {/* Name + id */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-white truncate">{proc.name}</span>
          <span className="text-xs text-white/30 font-mono">#{proc.id}</span>
          {proc.port && (
            <span className="text-xs font-mono" style={{ color: "#00bfff" }}>
              :{proc.port}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs" style={{ color: statusColor }}>
            {proc.status}
          </span>
          <span className="text-xs text-white/30">
            up {formatUptime(proc.uptime)}
          </span>
          {proc.restarts > 0 && (
            <span className="text-xs text-yellow-500/70">
              ↺ {proc.restarts}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-6 text-xs font-mono text-white/40">
        {proc.memoryMb !== null && (
          <span>{proc.memoryMb} MB</span>
        )}
        {proc.cpu !== null && (
          <span>{proc.cpu}% CPU</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isWebProject && (
          <ActionBtn
            label="Preview"
            title={`Open ${proc.name} in preview pane`}
            color="#ff4ecb"
            onClick={() => onAction("preview")}
            disabled={false}
          />
        )}
        <ActionBtn
          label="Logs"
          title={`View last 80 lines of ${proc.name} logs`}
          color="#00bfff"
          onClick={() => onAction("logs")}
          disabled={isRunning}
        />
        {proc.status === "online" ? (
          <ActionBtn
            label="Restart"
            title={`Restart ${proc.name} (with --update-env)`}
            color="#f7b700"
            onClick={() => onAction("restart")}
            disabled={isRunning}
          />
        ) : (
          <ActionBtn
            label="Start"
            title={`Start ${proc.name}`}
            color="#4ade80"
            onClick={() => onAction("restart")}
            disabled={isRunning}
          />
        )}
        {proc.status === "online" && (
          <ActionBtn
            label="Stop"
            title={`Stop ${proc.name}`}
            color="#ff6b6b"
            onClick={() => onAction("stop")}
            disabled={isRunning}
          />
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  label,
  title,
  color,
  onClick,
  disabled,
}: {
  label: string;
  title?: string;
  color: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        background: `${color}18`,
        border: `1px solid ${color}33`,
        color,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.background = `${color}30`;
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = `${color}18`;
      }}
    >
      {label}
    </button>
  );
}

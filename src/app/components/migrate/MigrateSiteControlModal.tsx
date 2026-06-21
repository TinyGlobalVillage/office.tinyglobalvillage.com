"use client";
// MigrateSiteControlModal — the operator surface over @tgv/migration-engine.
// Reuses the HardeningControlModal shell (timeline-at-top, QMBM bubbles). The
// Migrations panel now RUNS migrations from here: paste a URL → POST /api/migrate/jobs
// spawns the engine worker out-of-process → this modal polls /api/migrate/jobs/[id]
// and renders the live phase, a progress bar, the log tail, the preview site, and the
// optional headless walkthrough recording.

import { useCallback, useEffect, useRef, useState } from "react";
import HardeningControlModal, { type HCMSection } from "../hardening/HardeningControlModal";
import AuditLogTimeline from "../hardening/_shared/AuditLogTimeline";

type MigrationJob = {
  id: string;
  clientName: string;
  sourceDomain: string;
  status: string;
  fidelityScore: number | null;
  createdAt: string;
};

type Surface = { id: string; slug: string; codeMode: string; dataMode: string; status: string; chosenCatalogEntryId: string | null; site: string | null; notes: string | null };
type JobDetail = {
  job: MigrationJob & { deployLog: string | null; error: string | null };
  surfaces: Surface[];
  reviews: { id: string; reason: string; topScore: number | null }[];
  progress: { total: number; ported: number; halted: number; failed: number };
  site: string | null;
  hasRecording: boolean;
};

const TERMINAL = new Set(["live", "failed", "halted", "cancelled"]);
const statusColor = (s: string) =>
  s === "live" ? "#39d98a" : s === "failed" ? "#ff5c5c" : s === "halted" ? "#ffb547" : "#5be9f2";

const btn = {
  background: "rgba(91,233,242,0.1)", border: "1px solid rgba(91,233,242,0.3)",
  color: "#5be9f2", borderRadius: 6, padding: "0.3rem 0.7rem", fontSize: "0.75rem", cursor: "pointer",
} as const;
const primaryBtn = { ...btn, background: "rgba(57,217,138,0.14)", border: "1px solid rgba(57,217,138,0.45)", color: "#39d98a", fontWeight: 700 } as const;
const input = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.14)",
  color: "#e8f6f8", borderRadius: 6, padding: "0.4rem 0.55rem", fontSize: "0.82rem", width: "100%",
} as const;
const label = { fontSize: "0.72rem", opacity: 0.65, marginBottom: "0.2rem", display: "block" } as const;

export default function MigrateSiteControlModal({ onClose }: { onClose: () => void }) {
  const [jobs, setJobs] = useState<MigrationJob[]>([]);
  const [loading, setLoading] = useState(true);

  // new-migration form
  const [url, setUrl] = useState("");
  const [clientName, setClientName] = useState("");
  const [maxPages, setMaxPages] = useState(15);
  const [codeTier, setCodeTier] = useState<"reinvent" | "approximate" | "bespoke">("reinvent");
  const [record, setRecord] = useState(false);
  const [starting, setStarting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // live detail
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/migrate/jobs", { credentials: "same-origin", cache: "no-store" });
      if (r.ok) setJobs((await r.json()).jobs ?? []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  // poll the active job until it reaches a terminal state.
  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    const tick = async () => {
      const r = await fetch(`/api/migrate/jobs/${activeId}`, { credentials: "same-origin", cache: "no-store" });
      if (!alive || !r.ok) return;
      const d = (await r.json()) as JobDetail;
      setDetail(d);
      if (TERMINAL.has(d.job.status)) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        void refresh();
      }
    };
    void tick();
    pollRef.current = setInterval(() => void tick(), 1600);
    return () => { alive = false; if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [activeId, refresh]);

  const start = async () => {
    setFormError(null); setStarting(true);
    try {
      const r = await fetch("/api/migrate/jobs", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceUrl: url.trim(), clientName: clientName.trim() || undefined, maxPages, codeTier, record }),
      });
      const j = await r.json();
      if (!r.ok) { setFormError(j.error ?? "failed to start"); return; }
      setActiveId(j.jobId);
      setDetail(null);
      void refresh();
    } catch (e) {
      setFormError(String(e));
    } finally { setStarting(false); }
  };

  const NewMigrationForm = (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", padding: "0.75rem", border: "1px solid rgba(57,217,138,0.25)", borderRadius: 10, background: "rgba(57,217,138,0.03)" }}>
      <div>
        <span style={label}>Source URL (live site to crawl)</span>
        <input style={input} placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
        <div>
          <span style={label}>Client name (optional)</span>
          <input style={input} placeholder="defaults to the hostname" value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </div>
        <div>
          <span style={label}>Max pages</span>
          <input style={input} type="number" min={1} max={60} value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.6rem", alignItems: "end" }}>
        <div>
          <span style={label}>Code tier</span>
          <select style={input} value={codeTier} onChange={(e) => setCodeTier(e.target.value as typeof codeTier)}>
            <option value="reinvent">reinvent — deterministic palette (fast, free)</option>
            <option value="approximate">approximate — LLM-judge picks the block</option>
            <option value="bespoke">bespoke — content passthrough</option>
          </select>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", opacity: 0.85, paddingBottom: "0.45rem" }}>
          <input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} /> record walkthrough
        </label>
      </div>
      {formError && <div style={{ color: "#ff5c5c", fontSize: "0.8rem" }}>{formError}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
        <button type="button" style={primaryBtn} disabled={starting || !url.trim()} onClick={() => void start()}>
          {starting ? "starting…" : "Start migration"}
        </button>
      </div>
    </div>
  );

  const pct = detail && detail.progress.total > 0 ? Math.round((detail.progress.ported / detail.progress.total) * 100) : 0;
  const logTail = (detail?.job.deployLog ?? "").split("\n").filter(Boolean).slice(-8);

  const JobDetailPanel = detail && (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", padding: "0.75rem", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, background: "rgba(255,255,255,0.02)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{detail.job.clientName}</strong>
        <span style={{ color: statusColor(detail.job.status), fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{detail.job.status}</span>
      </div>
      {/* progress bar */}
      <div style={{ height: 8, borderRadius: 6, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: statusColor(detail.job.status), transition: "width 0.4s ease" }} />
      </div>
      <div style={{ fontSize: "0.76rem", opacity: 0.7 }}>
        {detail.progress.ported}/{detail.progress.total} surfaces ported
        {detail.progress.halted > 0 && ` · ${detail.progress.halted} awaiting review`}
        {detail.progress.failed > 0 && ` · ${detail.progress.failed} failed`}
        {detail.site && ` · preview site: ${detail.site}`}
      </div>
      {logTail.length > 0 && (
        <pre style={{ margin: 0, fontSize: "0.72rem", lineHeight: 1.45, opacity: 0.7, whiteSpace: "pre-wrap", maxHeight: 140, overflow: "auto", background: "rgba(0,0,0,0.25)", borderRadius: 6, padding: "0.5rem" }}>
          {logTail.join("\n")}
        </pre>
      )}
      {detail.job.error && <div style={{ color: "#ff5c5c", fontSize: "0.78rem" }}>error: {detail.job.error}</div>}
      {detail.surfaces.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
          {detail.surfaces.map((s) => (
            <span key={s.id} title={`${s.codeMode} → ${s.chosenCatalogEntryId ?? "?"}${s.notes ? ` · ${s.notes}` : ""}`}
              style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem", borderRadius: 5, border: `1px solid ${statusColor(s.status)}55`, color: statusColor(s.status) }}>
              {s.slug} · {s.status}
            </span>
          ))}
        </div>
      )}
      {detail.hasRecording && (
        <video controls style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }} src={`/api/migrate/jobs/${detail.job.id}/recording`} />
      )}
    </div>
  );

  const JobsPanel = (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {NewMigrationForm}
      {JobDetailPanel}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>{loading ? "loading…" : `${jobs.length} migration${jobs.length === 1 ? "" : "s"}`}</span>
        <button type="button" onClick={() => void refresh()} style={btn}>Refresh</button>
      </div>
      {jobs.length === 0 && !loading && <div style={{ opacity: 0.6, fontSize: "0.85rem" }}>No migrations yet — paste a URL above to run one.</div>}
      {jobs.map((j) => (
        <button key={j.id} type="button" onClick={() => setActiveId(j.id)} style={{
          display: "grid", gridTemplateColumns: "1fr auto", gap: "0.2rem 1rem", textAlign: "left",
          padding: "0.6rem 0.75rem", border: `1px solid ${j.id === activeId ? "rgba(91,233,242,0.4)" : "rgba(255,255,255,0.08)"}`,
          borderRadius: 8, background: "rgba(255,255,255,0.02)", cursor: "pointer", color: "inherit",
        }}>
          <div style={{ fontWeight: 600 }}>{j.clientName}</div>
          <div style={{ color: statusColor(j.status), fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>{j.status}</div>
          <div style={{ opacity: 0.6, fontSize: "0.8rem" }}>{j.sourceDomain}</div>
          <div style={{ opacity: 0.6, fontSize: "0.8rem", textAlign: "right" }}>{j.fidelityScore != null ? `fidelity ${Math.round(j.fidelityScore * 100)}%` : "—"}</div>
        </button>
      ))}
    </div>
  );

  const Placeholder = (text: string) => <div style={{ opacity: 0.6, fontSize: "0.9rem" }}>{text}</div>;

  const sections: HCMSection[] = [
    {
      id: "jobs",
      title: "Migrations",
      qmbm:
        "Paste a live site URL and press Start: the engine crawls it, rebuilds each page on TGV blocks, " +
        "and writes them to an isolated preview site in tgv_db. Watch the phase (intake → analyzing → " +
        "porting → live), the progress bar, and the log here. Code tier picks how pages are rebuilt: " +
        "reinvent (deterministic), approximate (an LLM chooses each block), or bespoke (content passthrough).",
      body: JobsPanel,
    },
    {
      id: "fidelity",
      title: "Per-Surface Fidelity",
      qmbm:
        "Fidelity is PER-SURFACE. Each page carries two independent settings — DATA (import ⇄ drop) and " +
        "CODE (reinvent | approximate | bespoke). The run form sets one default tier for the whole crawl; " +
        "per-surface overrides + the data axis land with the fidelity grid.",
      body: Placeholder("The run form sets a default code tier for every surface. Per-surface override grid is the next slice."),
    },
    {
      id: "halts",
      title: "Halt-Review Queue",
      qmbm:
        "When the approximate lane can't confidently place a section it HALTS instead of guessing — the " +
        "surface is flagged for review with its candidate blocks (component_match_candidates). The per-job " +
        "detail above shows how many surfaces are awaiting review; the resolve UI (pick / generate / skip) is next.",
      body: Placeholder("Halted surfaces surface in the per-job detail above. The pick/generate/skip resolver is the next slice."),
    },
    {
      id: "dogfood",
      title: "Dogfood — refusionist-test1",
      qmbm:
        "Acceptance test: migrate refusionist.com end-to-end into a throwaway preview, then score fidelity " +
        "vs the live site. For now, paste https://refusionist.com above with a low page cap to dogfood the crawl.",
      body: Placeholder("Provisioned-tenant dogfood (refusionist-test1) lands with the provisioning lane; crawl-dogfood works now via the form above."),
    },
  ];

  return (
    <HardeningControlModal
      title="Migrate a Site"
      subtitle="Absorb a legacy site into TGV — paste a URL, watch it migrate, per-surface fidelity."
      onClose={onClose}
      sections={sections}
      auditLogView={
        <AuditLogTimeline endpoint="/api/migrate/audit-log" kinds={["intake", "plan", "port", "halt", "deploy"]} />
      }
    />
  );
}

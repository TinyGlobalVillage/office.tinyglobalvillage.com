"use client";
// MigrateSiteControlModal — the operator surface over @tgv/migration-engine.
// Reuses the HardeningControlModal shell (timeline-at-top, QMBM bubbles, always-on
// Fail2ban/UFW global views). The Migrations panel lists real migration_jobs from
// /api/migrate/jobs; the rest are stubs landing in later slices.

import { useCallback, useEffect, useState } from "react";
import HardeningControlModal, { type HCMSection } from "../hardening/HardeningControlModal";
import Fail2banGlobalView from "../hardening/_shared/Fail2banGlobalView";
import UfwGlobalView from "../hardening/_shared/UfwGlobalView";
import AuditLogTimeline from "../hardening/_shared/AuditLogTimeline";

type MigrationJob = {
  id: string;
  clientName: string;
  sourceDomain: string;
  status: string;
  fidelityScore: number | null;
  createdAt: string;
};

const statusColor = (s: string) =>
  s === "live" ? "#39d98a" : s === "failed" ? "#ff5c5c" : s === "halted" ? "#ffb547" : "#5be9f2";

const btn = {
  background: "rgba(91,233,242,0.1)", border: "1px solid rgba(91,233,242,0.3)",
  color: "#5be9f2", borderRadius: 6, padding: "0.25rem 0.6rem", fontSize: "0.75rem", cursor: "pointer",
} as const;

export default function MigrateSiteControlModal({ onClose }: { onClose: () => void }) {
  const [jobs, setJobs] = useState<MigrationJob[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/migrate/jobs", { credentials: "same-origin", cache: "no-store" });
      if (r.ok) setJobs((await r.json()).jobs ?? []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const JobsPanel = (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>
          {loading ? "loading…" : `${jobs.length} migration${jobs.length === 1 ? "" : "s"}`}
        </span>
        <button type="button" onClick={() => void refresh()} style={btn}>↻ Refresh</button>
      </div>
      {jobs.length === 0 && !loading && (
        <div style={{ opacity: 0.6, fontSize: "0.85rem" }}>
          No migrations yet. Run one from the CLI (<code>tgv-migrate</code>) — a “run from here” button is the next slice.
        </div>
      )}
      {jobs.map((j) => (
        <div key={j.id} style={{
          display: "grid", gridTemplateColumns: "1fr auto", gap: "0.2rem 1rem",
          padding: "0.6rem 0.75rem", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8, background: "rgba(255,255,255,0.02)",
        }}>
          <div style={{ fontWeight: 600 }}>{j.clientName}</div>
          <div style={{ color: statusColor(j.status), fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>{j.status}</div>
          <div style={{ opacity: 0.6, fontSize: "0.8rem" }}>{j.sourceDomain}</div>
          <div style={{ opacity: 0.6, fontSize: "0.8rem", textAlign: "right" }}>
            {j.fidelityScore != null ? `fidelity ${Math.round(j.fidelityScore * 100)}%` : "—"}
          </div>
        </div>
      ))}
    </div>
  );

  const Placeholder = (label: string) => (
    <div style={{ opacity: 0.6, fontSize: "0.9rem" }}>{label} — panel stub (lands in a later slice).</div>
  );

  const sections: HCMSection[] = [
    {
      id: "jobs",
      title: "Migrations",
      qmbm:
        "Every migration is a job: a legacy site absorbed into TGV. This lists the real " +
        "migration_jobs rows with their status (intake → porting → live) and measured fidelity. " +
        "Content-first migrations write straight into tgv_db; you can watch them appear here.",
      body: JobsPanel,
    },
    {
      id: "intake",
      title: "Intake Source",
      qmbm:
        "Pick the legacy source. v1 supports four: DB dump + static export, live URL crawl, " +
        "WordPress/CMS export (WXR), and manual/placeholder. Intake runs Stage-A unpack then " +
        "Stage-B analyze, producing the surface list.",
      body: Placeholder("IntakeSourcePanel"),
    },
    {
      id: "fidelity",
      title: "Per-Surface Fidelity",
      qmbm:
        "Fidelity is PER-SURFACE. Each page/feature/table carries two independent settings — " +
        "DATA (import ⇄ drop) and CODE (reinvent | approximate AI-nearest-block | bespoke 1:1). " +
        "Set a default, then override individual surfaces.",
      body: Placeholder("FidelityGridPanel"),
    },
    {
      id: "halts",
      title: "Halt-Review Queue",
      qmbm:
        "When the approximate lane can't confidently place a legacy section it HALTS here instead " +
        "of guessing. Resolve each: pick the nearest existing block, generate a new component into " +
        "the sandbox, or skip the surface.",
      body: Placeholder("HaltReviewPanel"),
    },
    {
      id: "dogfood",
      title: "Dogfood — refusionist-test1",
      qmbm:
        "Acceptance test: spin up refusionist-test1.tinyglobalvillage.com by migrating refusionist.com " +
        "end-to-end, then score fidelity vs the live site. Admin-only.",
      body: Placeholder("DogfoodPanel"),
    },
  ];

  return (
    <HardeningControlModal
      title="Migrate a Site"
      subtitle="Absorb a legacy site into TGV — one engine, per-surface fidelity, halt-review, dogfood."
      onClose={onClose}
      sections={sections}
      auditLogView={
        <AuditLogTimeline endpoint="/api/migrate/audit-log" kinds={["intake", "plan", "port", "halt", "deploy"]} />
      }
      globalSystemViews={
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Fail2banGlobalView />
          <UfwGlobalView />
        </div>
      }
    />
  );
}

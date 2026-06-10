"use client";
// MigrateSiteControlModal — the operator surface over @tgv/migration-engine.
// Mirrors TelephonyControlModal: imports the HardeningControlModal shell +
// AuditLogTimeline + the two always-on global views, builds an HCMSection[],
// passes them in. NOT a hardening tile — it gets its own SECTIONS group on
// dashboard/utils/page.tsx — but reuses the shell for layout consistency
// (timeline-at-top, QMBM bubbles, always-on Fail2ban/UFW global views).
//
// STUB: panel bodies are placeholders. Wire to /api/migrate/* next.

import { useCallback, useEffect, useState } from "react";
import HardeningControlModal, { type HCMSection } from "../hardening/HardeningControlModal";
import Fail2banGlobalView from "../hardening/_shared/Fail2banGlobalView";
import UfwGlobalView from "../hardening/_shared/UfwGlobalView";
import AuditLogTimeline from "../hardening/_shared/AuditLogTimeline";

type MigrationJob = {
  id: string;
  status: string;
  targetDomain: string;
  surfaces?: unknown[];
};

export default function MigrateSiteControlModal({ onClose }: { onClose: () => void }) {
  const [job, setJob] = useState<MigrationJob | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/migrate/jobs?active=1", { credentials: "same-origin", cache: "no-store" });
    if (r.ok) setJob((await r.json()).jobs?.[0] ?? null);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const Placeholder = ({ label }: { label: string }) => (
    <div style={{ opacity: 0.7, fontSize: "0.9rem" }}>
      {label} — panel stub. Job: {job?.targetDomain ?? "none active"} ({job?.status ?? "—"}).
    </div>
  );

  const sections: HCMSection[] = [
    {
      id: "intake",
      title: "Intake Source",
      qmbm:
        "Pick the legacy source. v1 supports four:\n" +
        "1. DB dump + static export — upload a .sql + a zip of the built site.\n" +
        "2. Live URL crawl — point at a running site; we fetch + extract sections.\n" +
        "3. WordPress / CMS export (WXR) — upload the WordPress XML.\n" +
        "4. Manual / placeholder — start empty and hand-author surfaces.\n" +
        "Intake runs Stage-A unpack then Stage-B analyze, producing the surface list below.",
      body: <Placeholder label="IntakeSourcePanel" />,
    },
    {
      id: "fidelity",
      title: "Per-Surface Fidelity",
      qmbm:
        "Fidelity is PER-SURFACE, not per-client. Each page / feature / data-table " +
        "carries TWO independent settings:\n" +
        "• DATA axis: import its content into tgv_db  ⇄  drop it.\n" +
        "• CODE axis (3 tiers): reinvent (re-express on existing TGV editor blocks), " +
        "approximate (AI maps to nearest catalog block; halts on low confidence), " +
        "bespoke (port the legacy code 1:1, full fidelity).\n" +
        "Set a default with the bulk row at the top, then override individual surfaces.",
      body: <Placeholder label="FidelityGridPanel" />,
    },
    {
      id: "preview",
      title: "Live Fidelity / Preview",
      qmbm:
        "Shows the approximate-lane match confidence per surface and a side-by-side " +
        "render of the chosen catalog block vs the legacy excerpt. After a dogfood run, " +
        "shows the scored fidelity vs the live site.",
      body: <Placeholder label="FidelityPreviewPanel" />,
    },
    {
      id: "halts",
      title: "Halt-Review Queue",
      qmbm:
        "When the approximate lane can't confidently place a legacy section it HALTS here " +
        "instead of guessing. Resolve each: PICK the nearest existing catalog block, or " +
        "GENERATE a brand-new component into the Office sandbox (ties into the sandbox's " +
        "code deploy), or SKIP the surface.",
      body: <Placeholder label="HaltReviewPanel" />,
    },
    {
      id: "dogfood",
      title: "Dogfood — refusionist-test1",
      qmbm:
        "Acceptance test: spin up refusionist-test1.tinyglobalvillage.com by migrating " +
        "refusionist.com end-to-end, then score fidelity vs the live site. One-click launch. " +
        "Admin-only — never available from the self-serve funnel.",
      body: <Placeholder label="DogfoodPanel" />,
    },
  ];

  return (
    <HardeningControlModal
      title="Migrate a Site"
      subtitle="Absorb a legacy site into TGV — one engine, per-surface fidelity, halt-review, dogfood."
      onClose={onClose}
      sections={sections}
      auditLogView={
        <AuditLogTimeline
          endpoint="/api/migrate/audit-log"
          kinds={["intake", "plan", "port", "halt", "deploy"]}
        />
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

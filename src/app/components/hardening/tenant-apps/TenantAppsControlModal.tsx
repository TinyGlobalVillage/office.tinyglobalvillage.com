"use client";

// TenantAppsControlModal — the Tenant Apps hardening surface.
//
// Pattern: ~/.claude/CLAUDE.md §"Hardening UTILS Surfaces". Same shape as
// TelephonyControlModal — Activity Timeline up top, then hardening-specific
// sections. (The RCS-wide fail2ban + UFW views moved to the dedicated
// "Firewall & Intrusion" tile on 2026-06-14 — no longer on every modal.)
//
// Tenant-apps-specific sections:
//   1. Tenant Apps Table  — registry rows with per-row Restart / Stop / Finalize
//   2. Drift Panel        — pm2 processes not in tenant_apps OR ecosystem.config.cjs
//
// No SIP/firewall-specific highlighting — global views render as-is, since
// tenant-app drift is rarely a firewall concern.

import { useCallback, useEffect, useState } from "react";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";
import {
  TenantAppsTablePanel,
  DriftPanel,
  type TenantAppRow,
  type DriftEntry,
} from "./TenantAppsPanels";

export type TenantAppsControlModalProps = {
  onClose: () => void;
};

export default function TenantAppsControlModal({ onClose }: TenantAppsControlModalProps) {
  useEscapeToClose({ open: true, onClose });

  const [rows, setRows] = useState<TenantAppRow[]>([]);
  const [drift, setDrift] = useState<DriftEntry[]>([]);
  const [counts, setCounts] = useState<{ pm2: number; infra: number; tenants: number; drifting: number } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [listRes, driftRes] = await Promise.all([
        fetch("/api/admin/tenant-apps/list", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/admin/tenant-apps/drift-status", { credentials: "same-origin", cache: "no-store" }),
      ]);
      if (listRes.ok) {
        const j = (await listRes.json()) as { rows: TenantAppRow[] };
        setRows(j.rows);
      }
      if (driftRes.ok) {
        const j = (await driftRes.json()) as {
          drifting: DriftEntry[];
          counts: { pm2: number; infra: number; tenants: number; drifting: number };
        };
        setDrift(j.drifting);
        setCounts(j.counts);
      }
    } catch { /* render with prior state */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const sections: HCMSection[] = [
    {
      id: "table",
      title: "Tenant Apps",
      qmbm:
        "One row per provisioned tenant pm2 app. Each tenant is auto-allocated " +
        "a port from the 3101–3999 range by the provisionTenant script (the " +
        "only authorized path to creating a tenant). Ports 3000–3019 are " +
        "platform infra (in ecosystem.config.cjs) and 3020–3099 are reserved " +
        "for future infra. Port 3100 is Docker cospro and is skipped.\n\n" +
        "Stop = soft-delete (pm2 stop + status='deprovisioning'). Finalize " +
        "tears down fully (pm2 delete, nginx rm, clients/<slug>/ rm, DB row " +
        "delete) and is only available after the row has been soft-deleted. " +
        "Restart cycles the pm2 process.",
      body: <TenantAppsTablePanel rows={rows} onChange={refresh} />,
    },
    {
      id: "drift",
      title: "Drift",
      qmbm:
        "Live pm2 processes that are NOT in ecosystem.config.cjs AND NOT in " +
        "tenant_apps. These are unauthorized — usually a hand-typed `pm2 start` " +
        "that bypassed the canonical config. The pm2-drift-check cron audits " +
        "this hourly and announces new offenders to the Office Front Desk.\n\n" +
        "Adopt = register in tenant_apps as-is (only if the port is in the " +
        "tenant range). Stop & remove = pm2 delete. If you need a different " +
        "port assignment, stop first and re-run via provisionTenant.\n\n" +
        (counts
          ? `Current: pm2=${counts.pm2}, infra=${counts.infra}, tenants=${counts.tenants}, drifting=${counts.drifting}.`
          : ""),
      body: <DriftPanel entries={drift} onChange={refresh} />,
    },
  ];

  return (
    <HardeningControlModal
      title="Tenant Apps Registry"
      subtitle="Source-of-truth tenant pm2 registry + drift detection. Provision and deprovision tenants without ever touching pm2 directly."
      qmbm={
        "What is this?\n\n" +
        "Every tenant we host on RCS runs as a pm2 process behind nginx. Before this " +
        "hardening existed, anyone with shell access could `pm2 start` a new app, pick " +
        "a port by hand, and run it forever — there was no central record. On 2026-05-10 " +
        "that bypass actually happened: a parallel session squatted refusionist's port " +
        "and crashed it.\n\n" +
        "This surface fixes that with two sources of truth:\n" +
        "  • Platform infra (TGV.com, Office, refusionist, webhooks, automations) — " +
        "lives in /srv/refusion-core/ecosystem.config.cjs, ports 3000–3019.\n" +
        "  • Tenants — live in the tenant_apps Postgres table, ports 3101+, " +
        "auto-allocated by the provisionTenant CLI (the ONLY authorized path to " +
        "creating a tenant pm2 app).\n\n" +
        "An hourly cron (pm2-drift-check) diffs `pm2 jlist` against both sets. " +
        "Anything outside both = drift. New drift = audit row + Office announcement. " +
        "From here you can Adopt the offender into the registry, or Stop & remove it.\n\n" +
        "Day-to-day, this is where you Restart a misbehaving tenant, soft-deprovision " +
        "one (status flips to deprovisioning; reversible), or Finalize the teardown " +
        "(pm2 delete + nginx rm + clients/<slug>/ rm + DB row delete; irreversible)."
      }
      onClose={onClose}
      sections={sections}
      auditLogView={<AuditLogTimeline endpoint="/api/admin/tenant-apps/audit-log" />}
    />
  );
}

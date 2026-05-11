"use client";

// TenantAppsControlModal — the Tenant Apps hardening surface.
//
// Pattern: ~/.claude/CLAUDE.md §"Hardening UTILS Surfaces". Same shape as
// TelephonyControlModal — Activity Timeline up top, hardening-specific
// sections in the middle, Fail2banGlobalView + UfwGlobalView at the bottom.
//
// Tenant-apps-specific sections:
//   1. Tenant Apps Table  — registry rows with per-row Restart / Stop / Finalize
//   2. Drift Panel        — pm2 processes not in tenant_apps OR ecosystem.config.cjs
//
// No SIP/firewall-specific highlighting — global views render as-is, since
// tenant-app drift is rarely a firewall concern.

import { useCallback, useEffect, useState } from "react";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import Fail2banGlobalView from "../_shared/Fail2banGlobalView";
import UfwGlobalView from "../_shared/UfwGlobalView";
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
      onClose={onClose}
      sections={sections}
      auditLogView={<AuditLogTimeline endpoint="/api/admin/tenant-apps/audit-log" />}
      globalSystemViews={
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <div style={{
              fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", marginBottom: "0.4rem",
              color: "var(--t-textFaint)",
            }}>
              fail2ban — RCS-wide
            </div>
            <Fail2banGlobalView />
          </div>
          <div>
            <div style={{
              fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", marginBottom: "0.4rem",
              color: "var(--t-textFaint)",
            }}>
              UFW — RCS-wide
            </div>
            <UfwGlobalView />
          </div>
        </div>
      }
    />
  );
}

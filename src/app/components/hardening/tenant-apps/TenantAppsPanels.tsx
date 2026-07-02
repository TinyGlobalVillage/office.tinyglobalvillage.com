"use client";

// TenantAppsPanels — body panels for TenantAppsControlModal.
// Two main panels:
//   - TenantAppsTablePanel: per-row slug/hostname/port/status + actions
//   - DriftPanel: live offenders from /drift-status with Adopt + Stop&remove actions

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { rgb } from "@/app/theme";
import { askConfirm, showNotice } from "../../dialogService";

export type TenantAppRow = {
  slug: string;
  hostname: string;
  port: number;
  cwd: string;
  pm2Name: string;
  status: "active" | "stopped" | "errored" | "deprovisioning";
  createdAt: string;
  updatedAt: string;
  lastDriftCheckAt: string | null;
};

const Table = styled.div`
  display: grid;
  grid-template-columns: 1fr 1.6fr 0.6fr 0.9fr 1.4fr;
  gap: 0.25rem 0.5rem;
  font-size: 0.75rem;
`;

const HeaderCell = styled.div`
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--t-textFaint);
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--t-border);
`;

const Cell = styled.div`
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--t-borderFaint);
`;

const StatusPill = styled.span<{ $tone: "active" | "stopped" | "errored" | "deprovisioning" }>`
  display: inline-block;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.625rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: ${(p) =>
    p.$tone === "active" ? `rgba(${rgb.cyan}, 0.12)` :
    p.$tone === "errored" ? `rgba(${rgb.pink}, 0.12)` :
    "rgba(0,0,0,0.2)"};
  color: ${(p) =>
    p.$tone === "active" ? `rgba(${rgb.cyan}, 1)` :
    p.$tone === "errored" ? `rgba(${rgb.pink}, 1)` :
    "var(--t-textFaint)"};
  border: 1px solid ${(p) =>
    p.$tone === "active" ? `rgba(${rgb.cyan}, 0.35)` :
    p.$tone === "errored" ? `rgba(${rgb.pink}, 0.35)` :
    "var(--t-border)"};
`;

const Btn = styled.button<{ $tone?: "neutral" | "danger" }>`
  font-size: 0.6875rem;
  padding: 0.25rem 0.55rem;
  border-radius: 0.25rem;
  background: transparent;
  color: ${(p) => (p.$tone === "danger" ? `rgba(${rgb.pink}, 1)` : "var(--t-text)")};
  border: 1px solid ${(p) =>
    p.$tone === "danger" ? `rgba(${rgb.pink}, 0.35)` : "var(--t-border)"};
  cursor: pointer;
  margin-right: 0.25rem;
  &:disabled { opacity: 0.4; cursor: wait; }
`;

const Note = styled.div`
  font-size: 0.6875rem;
  color: var(--t-textFaint);
  margin-top: 0.4rem;
`;

const Mono = styled.span`
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.6875rem;
`;

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  let data: unknown = null;
  try { data = await res.json(); } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, data };
}

export function TenantAppsTablePanel({
  rows,
  onChange,
}: {
  rows: TenantAppRow[];
  onChange: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const restart = useCallback(async (slug: string) => {
    setBusy(slug + ":restart");
    try {
      const r = await postJson("/api/admin/tenant-apps/restart", { slug });
      if (!r.ok) void showNotice({ title: "Restart failed", message: `restart failed: ${JSON.stringify(r.data)}` });
    } finally {
      setBusy(null);
      onChange();
    }
  }, [onChange]);

  const deprovision = useCallback(async (slug: string, finalize: boolean) => {
    const warn = finalize
      ? `FINALIZE deprovision of "${slug}"? This deletes the pm2 process, nginx site, clients/${slug}/, and the DB row. Irreversible.`
      : `Soft-deprovision "${slug}"? pm2 will be stopped and status flipped to 'deprovisioning'. Reversible.`;
    if (!(await askConfirm({ title: "Deprovision tenant app?", message: warn, confirmLabel: "Deprovision" }))) return;
    setBusy(slug + (finalize ? ":finalize" : ":stop"));
    try {
      const r = await postJson("/api/admin/tenant-apps/deprovision", { slug, finalize });
      if (!r.ok) void showNotice({ title: "Deprovision failed", message: `deprovision failed: ${JSON.stringify(r.data)}` });
    } finally {
      setBusy(null);
      onChange();
    }
  }, [onChange]);

  if (rows.length === 0) {
    return (
      <Note>
        No tenant apps registered yet. Provision one via{" "}
        <Mono>provisionTenant &lt;slug&gt;</Mono> on RCS.
      </Note>
    );
  }

  return (
    <div>
      <Table>
        <HeaderCell>Slug</HeaderCell>
        <HeaderCell>Hostname</HeaderCell>
        <HeaderCell>Port</HeaderCell>
        <HeaderCell>Status</HeaderCell>
        <HeaderCell>Actions</HeaderCell>
        {rows.map((r) => (
          <RowFragment
            key={r.slug}
            row={r}
            busyTag={busy}
            onRestart={() => restart(r.slug)}
            onSoftDelete={() => deprovision(r.slug, false)}
            onFinalize={() => deprovision(r.slug, true)}
          />
        ))}
      </Table>
      <Note>
        ? Port auto-allocated from the tenant range (3101–3999) at provision
        time. Finalize is gated: a row must already be in{" "}
        <Mono>deprovisioning</Mono> state.
      </Note>
    </div>
  );
}

function RowFragment({
  row, busyTag, onRestart, onSoftDelete, onFinalize,
}: {
  row: TenantAppRow;
  busyTag: string | null;
  onRestart: () => void;
  onSoftDelete: () => void;
  onFinalize: () => void;
}) {
  return (
    <>
      <Cell><Mono>{row.slug}</Mono></Cell>
      <Cell><Mono>{row.hostname}</Mono></Cell>
      <Cell><Mono>{row.port}</Mono></Cell>
      <Cell><StatusPill $tone={row.status}>{row.status}</StatusPill></Cell>
      <Cell>
        <Btn disabled={busyTag === row.slug + ":restart"} onClick={onRestart}>
          Restart
        </Btn>
        {row.status !== "deprovisioning" ? (
          <Btn $tone="danger" disabled={busyTag === row.slug + ":stop"} onClick={onSoftDelete}>
            Stop
          </Btn>
        ) : (
          <Btn $tone="danger" disabled={busyTag === row.slug + ":finalize"} onClick={onFinalize}>
            Finalize
          </Btn>
        )}
      </Cell>
    </>
  );
}

export type DriftEntry = {
  pm2Name: string;
  cwd: string | null;
  port: string | null;
};

export function DriftPanel({
  entries,
  onChange,
}: {
  entries: DriftEntry[];
  onChange: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const adopt = useCallback(async (e: DriftEntry) => {
    const defaultHost = `${e.pm2Name}.tinyglobalvillage.com`;
    const hostname = prompt(
      `Adopt "${e.pm2Name}" into tenant_apps. Hostname?`,
      defaultHost,
    );
    if (!hostname) return;
    setBusy(e.pm2Name);
    try {
      const r = await postJson("/api/admin/tenant-apps/adopt", {
        pm2Name: e.pm2Name,
        hostname,
        slug: e.pm2Name,
      });
      if (!r.ok) void showNotice({ title: "Adopt failed", message: `adopt failed: ${JSON.stringify(r.data)}` });
    } finally {
      setBusy(null);
      onChange();
    }
  }, [onChange]);

  if (entries.length === 0) {
    return <Note>No drift detected. Live pm2 state matches the registry.</Note>;
  }

  return (
    <div>
      {entries.map((e) => (
        <div
          key={e.pm2Name}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.4fr 0.6rem 1fr",
            gap: "0.5rem",
            alignItems: "center",
            padding: "0.35rem 0",
            borderBottom: "1px solid var(--t-borderFaint)",
            fontSize: "0.75rem",
          }}
        >
          <Mono>{e.pm2Name}</Mono>
          <Mono style={{ color: "var(--t-textFaint)" }}>{e.cwd ?? "?"}</Mono>
          <Mono>:{e.port ?? "?"}</Mono>
          <div>
            <Btn disabled={busy === e.pm2Name} onClick={() => adopt(e)}>
              Adopt
            </Btn>
            <Btn $tone="danger" disabled={busy === e.pm2Name} onClick={async () => {
              if (!(await askConfirm({
                title: "Stop & remove process?",
                message: `Stop & remove pm2 process "${e.pm2Name}"?`,
                confirmLabel: "Stop & remove",
              }))) return;
              setBusy(e.pm2Name);
              try {
                const res = await fetch("/api/pm2", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "same-origin",
                  body: JSON.stringify({ action: "delete", name: e.pm2Name }),
                });
                if (!res.ok) {
                  // Fall back to no-op message — operator can run pm2 delete manually.
                  void showNotice({ title: "Stop failed", message: `stop failed; run \`pm2 delete ${e.pm2Name}\` on RCS` });
                }
              } finally {
                setBusy(null);
                onChange();
              }
            }}>
              Stop &amp; remove
            </Btn>
          </div>
        </div>
      ))}
      <Note>
        Adopt registers the pm2 process in <Mono>tenant_apps</Mono> as-is. If
        its port is outside the tenant range (3101–3999) the API will refuse
        — stop the app, free the port, and re-run via <Mono>provisionTenant</Mono>.
      </Note>
    </div>
  );
}

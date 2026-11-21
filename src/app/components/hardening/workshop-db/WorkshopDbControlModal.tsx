"use client";
// Workshop DB — Utils tile (Gio 2026-11-21). The workshop Postgres on RCS2 is a
// masked copy of prod, refreshed nightly by a root systemd job
// (utils/scripts/build-pipeline/workshop-db-refresh.sh). This panel shows the last
// runs, switches the nightly run on/off, sets its time, edits whose contacts stay
// unmasked, and asks for a run now. Office never touches either database itself.
import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";
import Tooltip from "@/app/components/ui/Tooltip";
import NeonButton from "@tgv/module-component-library/components/ui/NeonButton";
import Lightswitch from "@tgv/module-component-library/components/ui/Lightswitch";
import type { WorkshopDbConfig, WorkshopDbRun, WorkshopDbStatus } from "@/lib/workshop-db/state";

type Snapshot = { config: WorkshopDbConfig; status: WorkshopDbStatus | null; installed: boolean; requested: boolean };

const when = (iso?: string | null) => {
  if (!iso) return "never";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};
const mb = (b?: number) => (typeof b === "number" ? `${(b / 1024 / 1024).toFixed(0)} MB` : "—");
const dur = (r: WorkshopDbRun) => {
  if (!r.finishedAt) return "";
  const s = Math.round((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
};
const listText = (xs: string[]) => xs.join(", ");
const parseList = (s: string) => s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);

export default function WorkshopDbControlModal({ onClose }: { onClose: () => void }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [time, setTime] = useState("");
  const [domains, setDomains] = useState("");
  const [emails, setEmails] = useState("");

  const apply = useCallback((s: Snapshot) => {
    setSnap(s);
    setTime(s.config.time);
    setDomains(listText(s.config.keepDomains));
    setEmails(listText(s.config.keepEmails));
  }, []);

  const load = useCallback(async (resetForm = false) => {
    try {
      const r = await fetch("/api/admin/workshop-db", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      if (resetForm) apply(j); else setSnap(j);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [apply]);

  useEffect(() => { void load(true); }, [load]);
  const running = snap?.status?.state === "running" || !!snap?.requested;
  // Poll fast while a run is going, slowly otherwise.
  useEffect(() => {
    const t = setInterval(() => void load(false), running ? 3000 : 30000);
    return () => clearInterval(t);
  }, [load, running]);

  const save = async (patch: Partial<WorkshopDbConfig>) => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/workshop-db", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      apply(j);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const refreshNow = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/workshop-db/refresh", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      await load(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cfg = snap?.config;
  const st = snap?.status;
  const last = st?.last;
  const listsDirty = !!cfg && (domains !== listText(cfg.keepDomains) || emails !== listText(cfg.keepEmails));

  const sections: HCMSection[] = [
    {
      id: "status",
      title: "Status",
      qmbm: "Each run copies every listed prod database into the workshop Postgres (5440), masks member emails and phones, then swaps the copy in. Prod is only read. Lanes lose their DB connection for about a second per database, and anything they wrote since the last run is replaced.",
      body: !snap ? <Muted>{error ? `Could not load: ${error}` : "Loading…"}</Muted> : (
        <Body>
          {!snap.installed && <Warn>The refresh job is not installed on this box. Run <code>workshop-db-refresh.sh install</code>.</Warn>}
          <Rowline>
            <Pill $tone={running ? "warn" : last ? (last.ok ? "ok" : "critical") : "none"}>
              {running ? (st?.current?.db ? `Copying ${st.current.db}…` : "Starting…") : last ? (last.ok ? "Up to date" : "Last run failed") : "Never run"}
            </Pill>
            <Muted>Last success {when(st?.lastSuccessAt)}</Muted>
            <Spacer />
            <Tooltip label="Refresh now">
              <NeonButton strong disabled={busy || running || !snap.installed} onClick={refreshNow}>
                {running ? "Refreshing…" : "Refresh now"}
              </NeonButton>
            </Tooltip>
          </Rowline>
          {last && (
            <Table>
              <thead><tr><th>Database</th><th>Result</th><th>Size</th><th>Time</th></tr></thead>
              <tbody>
                {last.results.map((r) => (
                  <tr key={r.db}>
                    <td>{r.db}</td>
                    <td style={{ color: r.ok ? colors.green : colors.red }}>{r.ok ? "copied" : r.error || "failed"}</td>
                    <td>{mb(r.bytes)}</td>
                    <td>{typeof r.seconds === "number" ? `${r.seconds}s` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {last && <Muted>Last run {when(last.startedAt)} · {last.reason} · {dur(last)}{last.error ? ` · ${last.error}` : ""}</Muted>}
          {(st?.runs?.length ?? 0) > 1 && (
            <Muted>
              Earlier: {st!.runs!.slice(1, 6).map((r) => `${when(r.startedAt)} ${r.ok ? "ok" : "failed"}`).join(" · ")}
            </Muted>
          )}
        </Body>
      ),
    },
    {
      id: "schedule",
      title: "Nightly refresh",
      qmbm: "The box checks every 15 minutes and starts a run once a day after this time (Pacific). Switch it off to keep the current workshop data as it is.",
      body: !cfg ? <Muted>Loading…</Muted> : (
        <Body>
          <Rowline>
            <Tooltip label={cfg.enabled ? "Nightly run on" : "Nightly run off"}>
              <Lightswitch on={cfg.enabled} disabled={busy} ariaLabel="Nightly refresh" onChange={(on) => void save({ enabled: on })} />
            </Tooltip>
            <Muted>{cfg.enabled ? `Next run ${when(st?.nextRunAt)}` : "Off — the copy stays as it is"}</Muted>
          </Rowline>
          <Rowline>
            <Label htmlFor="wsdb-time">Run at</Label>
            <TimeInput id="wsdb-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            <Tooltip label="Save time">
              <NeonButton disabled={busy || time === cfg.time} onClick={() => void save({ time })}>Save</NeonButton>
            </Tooltip>
          </Rowline>
          <Muted>Databases: {cfg.databases.join(", ")}</Muted>
        </Body>
      ),
    },
    {
      id: "masking",
      title: "Kept contacts",
      qmbm: "Every member email and phone is replaced with a fake on each run, so dev can never message a real person. Addresses on these domains, these addresses, and every platform admin stay real.",
      body: !cfg ? <Muted>Loading…</Muted> : (
        <Body>
          <Label htmlFor="wsdb-domains">Keep domains</Label>
          <Area id="wsdb-domains" rows={2} value={domains} onChange={(e) => setDomains(e.target.value)} />
          <Label htmlFor="wsdb-emails">Keep addresses</Label>
          <Area id="wsdb-emails" rows={3} value={emails} placeholder="name@example.com, …" onChange={(e) => setEmails(e.target.value)} />
          <Rowline>
            <Muted>Applies from the next run.</Muted>
            <Spacer />
            <Tooltip label="Save kept contacts">
              <NeonButton disabled={busy || !listsDirty} onClick={() => void save({ keepDomains: parseList(domains), keepEmails: parseList(emails) })}>Save</NeonButton>
            </Tooltip>
          </Rowline>
        </Body>
      ),
    },
  ];

  return (
    <HardeningControlModal
      title="Workshop DB"
      subtitle="the dev copy of prod, contacts masked"
      qmbm={error ? `Error: ${error}` : "Lanes on RCS2 develop against a copy of the production databases with real data, refreshed every night. Member emails and phone numbers are masked so nothing built in dev can reach a real person."}
      sections={sections}
      auditLogView={<AuditLogTimeline endpoint="/api/admin/workshop-db/audit-log" />}
      onClose={onClose}
    />
  );
}

const Body = styled.div`display: flex; flex-direction: column; gap: 0.75rem;`;
const Rowline = styled.div`display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap;`;
const Spacer = styled.div`flex: 1 1 auto;`;
const Muted = styled.div`font-size: 0.72rem; color: var(--t-textFaint);`;
const Warn = styled.div`
  font-size: 0.78rem; color: ${colors.gold};
  border: 1px solid rgba(${rgb.gold}, 0.4); background: rgba(${rgb.gold}, 0.08);
  border-radius: 0.5rem; padding: 0.5rem 0.75rem;
`;
const Pill = styled.span<{ $tone: "ok" | "warn" | "critical" | "none" }>`
  font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 999px;
  color: ${(p) => (p.$tone === "ok" ? colors.green : p.$tone === "warn" ? colors.gold : p.$tone === "critical" ? colors.red : "var(--t-textMuted)")};
  border: 1px solid currentColor;
`;
const Label = styled.label`font-size: 0.75rem; font-weight: 650; color: var(--t-textMuted); min-width: 5.5rem;`;
const TimeInput = styled.input`
  padding: 0.35rem 0.5rem; border-radius: 0.4rem; font-size: 0.8rem;
  background: var(--t-inputBg, transparent); color: var(--t-text); border: 1px solid var(--t-border);
  color-scheme: dark;
`;
const Area = styled.textarea`
  width: 100%; box-sizing: border-box; padding: 0.5rem; border-radius: 0.4rem; font-size: 0.78rem; font-family: inherit;
  background: var(--t-inputBg, transparent); color: var(--t-text); border: 1px solid var(--t-border); resize: vertical;
`;
const Table = styled.table`
  width: 100%; border-collapse: collapse; font-size: 0.75rem;
  th { text-align: left; font-weight: 650; color: var(--t-textMuted); padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--t-border); }
  td { padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--t-border); color: var(--t-text); }
  @media (max-width: 520px) { th:nth-child(4), td:nth-child(4) { display: none; } }
`;

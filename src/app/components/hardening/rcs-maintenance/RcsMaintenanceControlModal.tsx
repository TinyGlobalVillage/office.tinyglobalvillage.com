"use client";

// RcsMaintenanceControlModal — Utils → System Hardening → RCS Maintenance.
// Whether RCS needs a reboot or is sitting on updates, who gets told (Front Desk
// board + email), how often it repeats, and every reboot the Mac-side runner
// recorded with its measured downtime. Reads/writes /api/hardening/rcs-maintenance.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb } from "@/app/theme";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";
import Fail2banGlobalView from "../_shared/Fail2banGlobalView";
import UfwGlobalView from "../_shared/UfwGlobalView";

type Notice = { activeSince: number | null; lastSentAt: number | null; sentCount: number; nextDueAt: number | null };
type Apt = { at: number; all: number; security: number } | { at: number; error: string } | null;
type Send = { at: number; kind: "reboot" | "updates"; send: string; frontDesk: string; email: string };
type Config = {
  enabled: boolean;
  rebootAlerts: boolean;
  updatesAlerts: boolean;
  updatesScope: "security" | "all";
  updatesThresholdHours: number;
  rebootThresholdHours: number;
  reminderDays: number;
  frontDesk: boolean;
  email: boolean;
  recipients: string[];
  aptCheckEveryMin: number;
  lastUpdated: string | null;
  updatedBy: string | null;
};
type Report = {
  at: number;
  host: string;
  rebootRequired: boolean;
  rebootSince: number | null;
  rebootPkgs: string[];
  apt: Apt;
  bootAt: number;
  uptimeDays: number;
  reboot: Notice;
  updates: Notice;
  sends: Send[];
  config: Config;
};
type Reboot = {
  id: string;
  by: string;
  reason?: string;
  startedAt: string;
  outcome: string;
  downtimeMs: number | null;
  stages: Record<string, number | null>;
  sites?: Array<{ host: string; code: number; backAtMs: number | null }>;
  pm2?: { online: number; total: number };
  maintenancePage?: boolean;
  notes?: string[];
};

const when = (t: number | string | null | undefined) => (t ? new Date(t).toLocaleString() : "—");
const secs = (ms: number | null | undefined) => (ms == null ? "—" : ms < 120_000 ? `${(ms / 1000).toFixed(0)} s` : `${(ms / 60_000).toFixed(1)} min`);
function age(ms: number): string {
  const h = ms / 3_600_000;
  return h < 48 ? `${h.toFixed(0)} h` : `${(h / 24).toFixed(0)} days`;
}

const STAGE_LABEL: Record<string, string> = {
  pingDown: "Stopped answering ping",
  pingUp: "Ping back",
  sshUp: "SSH back (public port)",
  meshUp: "Mesh back",
  pm2Up: "pm2 apps online",
  sitesUp: "Every site 200",
};

export default function RcsMaintenanceControlModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });
  const [rep, setRep] = useState<Report | null>(null);
  const [reboots, setReboots] = useState<Reboot[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [recipientsDraft, setRecipientsDraft] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/hardening/rcs-maintenance");
      const d = await r.json();
      if (!d?.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
      setRep(d.report);
      setReboots(d.reboots ?? []);
      setErr(d.samplerError ?? null);
      setRecipientsDraft((d.report?.config?.recipients ?? []).join(", "));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async (config: Partial<Config>) => {
    setBusy(true);
    try {
      await fetch("/api/hardening/rcs-maintenance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }) });
      await load();
    } finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true);
    setTestMsg(null);
    try {
      const r = await fetch("/api/hardening/rcs-maintenance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test" }) });
      const d = await r.json();
      setTestMsg(d?.send ? `Front Desk: ${d.send.frontDesk} · Email: ${d.send.email}` : "Test failed");
    } finally { setBusy(false); }
  };

  const cfg = rep?.config;
  const apt = rep?.apt;
  const aptOk = apt && !("error" in apt) ? apt : null;
  const now = rep?.at ?? Date.now();

  const num = (key: keyof Config, label: string, unit: string, step = 1) =>
    cfg ? (
      <Cell>
        <StatLabel>{label}</StatLabel>
        <Rowline>
          <Input
            type="number"
            step={step}
            defaultValue={cfg[key] as number}
            key={`${key}-${cfg.lastUpdated}`}
            disabled={busy}
            onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== cfg[key]) void save({ [key]: v } as Partial<Config>); }}
            style={{ width: "5.5rem" }}
          />
          <Muted>{unit}</Muted>
        </Rowline>
      </Cell>
    ) : null;

  const toggle = (key: keyof Config, on: string, off: string) =>
    cfg ? (
      <TBtn $active={cfg[key] as boolean} disabled={busy} onClick={() => void save({ [key]: !cfg[key] } as Partial<Config>)}>
        {cfg[key] ? on : off}
      </TBtn>
    ) : null;

  const sections: HCMSection[] = [
    {
      id: "status",
      title: "Right now",
      qmbm:
        "Ubuntu writes /var/run/reboot-required when an installed package (a kernel, libc) only takes effect after a reboot, and unattended-upgrades installs security updates every day. This section reads both on RCS: whether a reboot is pending and since when, and how many updates are waiting.",
      body: rep ? (
        <Body>
          <Rowline>
            <Pill $tone={rep.rebootRequired ? "warn" : "ok"}>{rep.rebootRequired ? "REBOOT NEEDED" : "NO REBOOT PENDING"}</Pill>
            <Pill $tone={aptOk ? (aptOk.security > 0 ? "warn" : "ok") : "none"}>
              {aptOk ? `${aptOk.security} security · ${aptOk.all} total updates` : apt && "error" in apt ? "updates: unreadable" : "updates: not read yet"}
            </Pill>
          </Rowline>
          <Grid>
            <Stat><StatLabel>Reboot pending since</StatLabel><StatValue>{rep.rebootSince ? `${when(rep.rebootSince)} (${age(now - rep.rebootSince)})` : "—"}</StatValue></Stat>
            <Stat><StatLabel>Last boot</StatLabel><StatValue>{when(rep.bootAt)} · up {rep.uptimeDays.toFixed(0)} days</StatValue></Stat>
            <Stat><StatLabel>Updates last read</StatLabel><StatValue>{when(apt?.at ?? null)}</StatValue></Stat>
            <Stat><StatLabel>Host</StatLabel><StatValue>{rep.host}</StatValue></Stat>
          </Grid>
          {rep.rebootPkgs.length > 0 && <Muted>Waiting on: {rep.rebootPkgs.join(", ")}</Muted>}
          {err && <ErrText>{err}</ErrText>}
        </Body>
      ) : (
        <Muted>{err ?? "Loading…"}</Muted>
      ),
    },
    {
      id: "notices",
      title: "Notices",
      qmbm:
        "\"RCS UPDATES AND REBOOT NEEDED\" goes out while a reboot is pending; \"RCS UPDATES NEEDED\" when updates have waited past the threshold (folded into the reboot notice while one is running). Each goes out once the threshold passes and then repeats every reminder interval until the condition clears, with one closing notice when it does. Turning the master switch off still tracks everything; nothing is sent.",
      body: cfg && rep ? (
        <Body>
          <Rowline>
            {toggle("enabled", "Notices on", "Notices off")}
            {toggle("rebootAlerts", "Reboot notice on", "Reboot notice off")}
            {toggle("updatesAlerts", "Updates notice on", "Updates notice off")}
            <Select value={cfg.updatesScope} disabled={busy} onChange={(e) => void save({ updatesScope: e.target.value as Config["updatesScope"] })}>
              <option value="security">Count security updates</option>
              <option value="all">Count every update</option>
            </Select>
          </Rowline>
          <Grid>
            {num("rebootThresholdHours", "Reboot: first notice after", "hours")}
            {num("updatesThresholdHours", "Updates: first notice after", "hours")}
            {num("reminderDays", "Repeat every", "days", 0.25)}
            {num("aptCheckEveryMin", "Read updates every", "minutes")}
          </Grid>
          <Grid>
            <Stat>
              <StatLabel>Reboot notice</StatLabel>
              <StatValue>
                {rep.reboot.activeSince === null ? "idle" : `sent ${rep.reboot.sentCount}× · last ${when(rep.reboot.lastSentAt)}`}
              </StatValue>
              <Muted>{rep.reboot.nextDueAt ? `next ${when(rep.reboot.nextDueAt)}` : ""}</Muted>
            </Stat>
            <Stat>
              <StatLabel>Updates notice</StatLabel>
              <StatValue>
                {rep.updates.activeSince === null ? "idle" : `sent ${rep.updates.sentCount}× · last ${when(rep.updates.lastSentAt)}`}
              </StatValue>
              <Muted>{rep.updates.nextDueAt ? `next ${when(rep.updates.nextDueAt)}` : rep.updates.activeSince !== null && rep.rebootRequired ? "carried by the reboot notice" : ""}</Muted>
            </Stat>
          </Grid>
          <Muted>Last changed {when(cfg.lastUpdated)}{cfg.updatedBy ? ` by ${cfg.updatedBy}` : ""}</Muted>
        </Body>
      ) : <Muted>Loading…</Muted>,
    },
    {
      id: "channels",
      title: "Who gets told",
      qmbm: "Front Desk posts a team alert on the board staff already watch. Email goes from Office's house sender to every address listed (comma-separated). \"Send a test\" delivers a [TEST] notice on both channels and changes nothing else.",
      body: cfg ? (
        <Body>
          <Rowline>
            {toggle("frontDesk", "Front Desk on", "Front Desk off")}
            {toggle("email", "Email on", "Email off")}
            <TBtn $active={false} disabled={busy} onClick={() => void test()}>Send a test</TBtn>
            {testMsg && <Muted>{testMsg}</Muted>}
          </Rowline>
          <Rowline>
            <Input
              value={recipientsDraft}
              disabled={busy}
              onChange={(e) => setRecipientsDraft(e.target.value)}
              onBlur={() => {
                const list = recipientsDraft.split(/[,\s;]+/).map((s) => s.trim()).filter(Boolean);
                if (list.join(",") !== cfg.recipients.join(",")) void save({ recipients: list });
              }}
              placeholder="admin@tinyglobalvillage.com"
              aria-label="Email recipients"
              style={{ flex: "1 1 18rem" }}
            />
          </Rowline>
          <Table>
            <thead><tr><th>Sent</th><th>Notice</th><th>Front Desk</th><th>Email</th></tr></thead>
            <tbody>
              {(rep?.sends ?? []).slice(0, 10).map((s, i) => (
                <tr key={i}>
                  <td>{when(s.at)}</td>
                  <td>{s.kind} · {s.send}</td>
                  <td>{s.frontDesk}</td>
                  <td>{s.email}</td>
                </tr>
              ))}
              {(rep?.sends ?? []).length === 0 && <tr><td colSpan={4}>Nothing sent yet.</td></tr>}
            </tbody>
          </Table>
        </Body>
      ) : <Muted>Loading…</Muted>,
    },
    {
      id: "reboots",
      title: "Reboot history",
      qmbm:
        "Each row is one reboot run from the Mac (utils/scripts/system/rcs-reboot.sh, on Gio's \"reboot\" cue). The runner timestamps every stage from the reboot command — ping gone, ping back, SSH, mesh, pm2, every site answering 200 — while Cloudflare shows the TGV maintenance page in front of every site. Downtime is the headline: sites unreachable until the last one answers again.",
      body: (
        <Body>
          {reboots.length === 0 && <Muted>No recorded reboots yet. RCS was last booted {rep ? when(rep.bootAt) : "—"}.</Muted>}
          {reboots.map((r) => (
            <RebootCard key={r.id}>
              <Rowline>
                <Pill $tone={r.outcome === "ok" ? "ok" : r.outcome === "partial" ? "warn" : "critical"}>{r.outcome.toUpperCase()}</Pill>
                <strong>{when(r.startedAt)}</strong>
                <Muted>by {r.by}{r.reason ? ` · ${r.reason}` : ""}{r.maintenancePage ? " · maintenance page up" : ""}</Muted>
              </Rowline>
              <Headline>
                <Big>{secs(r.downtimeMs)}</Big>
                <Muted>total downtime</Muted>
              </Headline>
              <Table>
                <tbody>
                  {Object.entries(r.stages).map(([k, v]) => (
                    <tr key={k}><td>{STAGE_LABEL[k] ?? k}</td><td>{v == null ? "—" : `+${secs(v)}`}</td></tr>
                  ))}
                  {r.pm2 && <tr><td>pm2 online after</td><td>{r.pm2.online} / {r.pm2.total}</td></tr>}
                </tbody>
              </Table>
              {r.sites && r.sites.some((s) => s.code !== 200) && (
                <ErrText>Not back: {r.sites.filter((s) => s.code !== 200).map((s) => `${s.host} (${s.code})`).join(", ")}</ErrText>
              )}
              {r.notes?.map((n, i) => <Muted key={i}>{n}</Muted>)}
            </RebootCard>
          ))}
        </Body>
      ),
    },
  ];

  return (
    <HardeningControlModal
      title="RCS Maintenance"
      subtitle="reboot-needed and updates-waiting notices, plus every measured reboot"
      qmbm="Patches that are installed but not live are the quiet way a box falls behind: RCS sat on a pending kernel from 2026-10-14 into November. This keeps telling the team — Front Desk and email — until it reboots, and records how long each reboot actually took."
      sections={sections}
      auditLogView={<AuditLogTimeline endpoint="/api/hardening/rcs-maintenance/audit-log" />}
      globalSystemViews={<><Fail2banGlobalView /><UfwGlobalView /></>}
      onClose={onClose}
    />
  );
}

const TONE: Record<"ok" | "warn" | "critical" | "none", string> = {
  ok: colors.green,
  warn: "#ffc53d",
  critical: colors.red,
  none: "var(--t-textFaint)",
};

const Body = styled.div`display: flex; flex-direction: column; gap: 0.75rem;`;
const Rowline = styled.div`display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap;`;
const Headline = styled.div`display: flex; align-items: baseline; gap: 0.75rem;`;
const Big = styled.div`font-size: 1.9rem; font-weight: 750; font-variant-numeric: tabular-nums; line-height: 1;`;
const Pill = styled.span<{ $tone: keyof typeof TONE }>`
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; padding: 0.2rem 0.6rem; border-radius: 999px; width: fit-content;
  color: ${(p) => TONE[p.$tone]}; border: 1px solid ${(p) => (p.$tone === "none" ? "var(--t-border)" : TONE[p.$tone])}; background: rgba(0,0,0,0.2);
`;
const Muted = styled.div`font-size: 0.72rem; color: var(--t-textFaint);`;
const ErrText = styled.div`font-size: 0.6875rem; color: ${colors.red}; font-family: var(--font-geist-mono), monospace;`;
const Grid = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0.625rem;`;
const Cell = styled.div`display: flex; flex-direction: column; gap: 0.2rem;`;
const Stat = styled.div`display: flex; flex-direction: column; gap: 0.1rem; min-width: 4rem;`;
const StatLabel = styled.span`font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--t-textFaint);`;
const StatValue = styled.span`font-size: 0.78rem; font-variant-numeric: tabular-nums; color: var(--t-text);`;
const TBtn = styled.button<{ $active: boolean }>`
  padding: 0.35rem 0.75rem; font-size: 0.72rem; font-weight: 650; border-radius: 0.4rem; cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.16)` : "transparent")};
  color: ${(p) => (p.$active ? colors.gold : "var(--t-textMuted)")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.5)` : "var(--t-border)")};
  &:hover:not(:disabled) { color: ${colors.gold}; border-color: rgba(${rgb.gold}, 0.5); }
  &:disabled { opacity: 0.5; cursor: default; }
`;
const Select = styled.select`
  font-size: 0.72rem; padding: 0.3rem 0.5rem; border-radius: 0.4rem;
  background: var(--t-inputBg); color: var(--t-text); border: 1px solid var(--t-border);
`;
const Input = styled.input`
  font-size: 0.78rem; font-variant-numeric: tabular-nums; padding: 0.3rem 0.5rem; border-radius: 0.4rem;
  background: var(--t-inputBg); color: var(--t-text); border: 1px solid var(--t-border);
  &:focus { outline: none; border-color: rgba(${rgb.gold}, 0.5); }
`;
const Table = styled.table`
  width: 100%; border-collapse: collapse; font-size: 12px;
  th { text-align: left; font-weight: 600; color: var(--t-textGhost); padding: 4px 8px 4px 0; border-bottom: 1px solid rgba(${rgb.cyan},0.18); }
  td { padding: 4px 8px 4px 0; border-bottom: 1px solid rgba(${rgb.cyan},0.08); font-variant-numeric: tabular-nums; }
`;
const RebootCard = styled.div`
  display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem; border-radius: 0.5rem;
  border: 1px solid var(--t-border); background: rgba(0,0,0,0.15);
`;

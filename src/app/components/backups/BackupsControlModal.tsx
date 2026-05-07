"use client";

// BackupsControlModal — single-modal GUI representation of TGV's backup system.
// Gold-themed to match the System Hardening tile that opens it.
//
// Sections (top → bottom):
//   1. Recent Activity — last N runs across all tiers, color-coded
//   2. Master Toggle — enable/disable cron (renames .disabled file)
//   3. Manual Runs — "Run now" buttons per tier
//   4. Account — provider, login link, contacts
//   5. Connection — host, repo, repo-reachable, snapshot count, total size
//   6. Encryption — restic password + GPG escrow status
//   7. Schedule — cron entries
//   8. Retention — editable per-tier policy (saves to config.json)
//   9. Last run per tier — manifest data
//  10. Idle alert — rsync.net AM canary status
//  11. Defense layers — positive listing of what's enabled
//
// Reused by tgv-franchise-rollout Component G — keep self-contained.

import { useEffect, useState, useCallback } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
} from "@/app/styled";
import NeonX from "../NeonX";
import BackupGuide from "./BackupGuide";

/* ── Types ─────────────────────────────────────────────────────── */

type Retention = { keepDaily: number; keepWeekly: number; keepMonthly: number; keepYearly: number };
type RunEntry = { tier?: string; timestamp: string; status: string; snapshot_id?: string; total_size_bytes?: number; file_count?: number };
type RestoreTest = { timestamp: string; status: string; sentinel_count: number; dump_size_bytes?: number };

type BackupStatus = {
  config: {
    provider: { name: string; tier: string; tierBilling: string; host: string; username: string;
      location: string; customerId: string; accountManagerUrl: string; owner: string;
      billingContact: string; technicalContact: string };
    repo: { url: string; tool: string; encryption: string };
    encryption: { resticPasswordPath: string; gpgEscrowFingerprint: string; gpgEscrowUid: string; gpgPrivateKeyLocation: string };
    schedule: Record<string, { cron: string; desc: string }>;
    retention: { tier1: Retention; tier2: Retention; tier4: Retention };
    idleAlert: { configuredInAm: boolean; thresholdHours: number; recipients: string[] };
    appendOnly: { filesystemMode: boolean };
  };
  cron: { active: boolean; disabledFileExists: boolean };
  secrets: { resticPasswordConfigured: boolean; gpgEscrowPubkeyImported: boolean };
  lastRunByTier: Record<string, { timestamp: string; status: string; snapshotId?: string; sizeBytes?: number } | null>;
  repo: { reachable: boolean; snapshotCount: number; latestSnapshotId: string | null;
    latestSnapshotTime: string | null; totalSizeBytes: number; error: string | null };
  restoreTest: { runs: number; latest: RestoreTest | null };
};

type HistoryResponse = { runs: RunEntry[]; restoreTests: RestoreTest[] };

/* ── Styled (gold-themed to match tile) ───────────────────────── */

const Sub = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  letter-spacing: 0.04em;
  margin-top: 0.125rem;
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Section = styled.section`
  display: flex; flex-direction: column; gap: 0.5rem;
  padding: 0.875rem 1rem;
  border: 1px solid rgba(${rgb.gold}, 0.2);
  border-radius: 0.625rem;
  background: rgba(${rgb.gold}, 0.04);
`;

const SectionTitle = styled.h3`
  margin: 0 0 0.4rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: ${colors.gold};
`;

const KV = styled.dl`
  display: grid;
  grid-template-columns: minmax(8rem, 12rem) 1fr;
  gap: 0.25rem 0.75rem;
  margin: 0;
  font-size: 0.75rem;

  & > dt { color: var(--t-textFaint); font-weight: 500; }
  & > dd { margin: 0; color: var(--t-text); font-family: ui-monospace, "SF Mono", monospace; word-break: break-all; }
`;

const Badge = styled.span<{ $variant: "ok" | "warn" | "err" | "off" }>`
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: ${(p) => {
    switch (p.$variant) {
      case "ok": return `rgba(${rgb.gold}, 0.18)`;
      case "warn": return `rgba(${rgb.gold}, 0.18)`;
      case "err": return `rgba(${rgb.red}, 0.15)`;
      case "off": return "rgba(120,120,120,0.15)";
    }
  }};
  color: ${(p) => p.$variant === "err" ? colors.red : p.$variant === "off" ? "#888" : colors.gold};
  border: 1px solid ${(p) => p.$variant === "err" ? `rgba(${rgb.red}, 0.3)` : p.$variant === "off" ? "rgba(120,120,120,0.3)" : `rgba(${rgb.gold}, 0.35)`};
`;

const ExtLink = styled.a`
  color: ${colors.gold};
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;

const Loading = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  font-style: italic;
  padding: 1rem 0;
`;

const ErrBox = styled.div`
  font-size: 0.75rem;
  color: ${colors.red};
  padding: 0.75rem 1rem;
  background: rgba(${rgb.red}, 0.05);
  border: 1px solid rgba(${rgb.red}, 0.3);
  border-radius: 0.5rem;
`;

/* Master toggle — Lightswitch (mirrors utils/page.tsx pattern) */
const LSTrack = styled.button<{ $on: boolean }>`
  appearance: none; border: none; cursor: pointer; position: relative;
  width: 44px; height: 24px; border-radius: 12px; flex-shrink: 0;
  transition: all 0.25s ease;
  background: ${(p) => p.$on
    ? `linear-gradient(90deg, ${colors.gold}55, ${colors.gold}22)`
    : "rgba(120,120,120,0.2)"};
  box-shadow: ${(p) => p.$on
    ? `inset 0 0 6px ${colors.gold}33, 0 0 8px ${colors.gold}22`
    : "inset 0 1px 3px rgba(0,0,0,0.2)"};
  &:focus { outline: none; box-shadow: 0 0 0 2px ${colors.gold}44; }
`;
const LSKnob = styled.div<{ $on: boolean }>`
  position: absolute; top: 2px; left: ${(p) => (p.$on ? "22px" : "2px")};
  width: 20px; height: 20px; border-radius: 50%;
  transition: all 0.25s ease;
  background: ${(p) => p.$on
    ? `radial-gradient(circle at 40% 35%, ${colors.gold}ee, ${colors.gold}, ${colors.gold}88)`
    : "radial-gradient(circle at 40% 35%, #888, #555)"};
  box-shadow: ${(p) => p.$on
    ? `0 0 8px ${colors.gold}80, 0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)`
    : "0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)"};
`;
function GoldSwitch({ on, onChange, disabled }: { on: boolean; onChange: (n: boolean) => void; disabled?: boolean }) {
  return (
    <LSTrack $on={on} type="button" onClick={() => !disabled && onChange(!on)} disabled={disabled}>
      <LSKnob $on={on} />
    </LSTrack>
  );
}

const ToggleRow = styled.div`
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.25rem 0;
`;
const ToggleLabel = styled.div`
  flex: 1;
  display: flex; flex-direction: column; gap: 0.125rem;
`;
const ToggleLabelMain = styled.div`
  font-size: 0.75rem; font-weight: 600; color: var(--t-text);
`;
const ToggleLabelSub = styled.div`
  font-size: 0.65rem; color: var(--t-textGhost); line-height: 1.4;
`;

/* Run-now buttons */
const RunRow = styled.div`
  display: flex; flex-wrap: wrap; gap: 0.5rem;
  margin-top: 0.25rem;
`;
const RunBtn = styled.button`
  padding: 0.35rem 0.85rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border: 1px solid rgba(${rgb.gold}, 0.45);
  background: rgba(${rgb.gold}, 0.08);
  color: ${colors.gold};
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: rgba(${rgb.gold}, 0.15); box-shadow: 0 0 10px rgba(${rgb.gold}, 0.25); }
  &:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
`;

/* Retention inputs */
const RetentionGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(6rem, 7rem) repeat(4, minmax(4rem, 1fr)) auto;
  gap: 0.4rem 0.5rem;
  align-items: center;
  font-size: 0.7rem;
`;
const RetentionLabel = styled.div`
  font-size: 0.7rem; font-weight: 600; color: var(--t-textFaint);
`;
const RetentionInput = styled.input`
  width: 100%;
  padding: 0.25rem 0.4rem;
  font-size: 0.7rem;
  font-family: ui-monospace, monospace;
  background: var(--t-inputBg);
  border: 1px solid rgba(${rgb.gold}, 0.25);
  border-radius: 0.3rem;
  color: var(--t-text);
  text-align: right;
  &:focus { outline: none; border-color: rgba(${rgb.gold}, 0.6); }
`;
const RetentionHeader = styled.div`
  font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--t-textGhost); text-align: center;
`;
const SaveBtn = styled.button`
  padding: 0.3rem 0.7rem;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border: none;
  background: linear-gradient(to right, ${colors.gold}dd, ${colors.gold}88);
  color: #0a0a0a;
  border-radius: 0.3rem;
  cursor: pointer;
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

/* Header guide-toggle — the persistent QMBM in the menu bar */
const HeaderActions = styled.div`
  display: flex; align-items: center; gap: 0.4rem;
`;
const GuideToggle = styled.button<{ $active: boolean }>`
  display: inline-flex; align-items: center; gap: 0.35rem;
  padding: 0.4rem 0.7rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border-radius: 0.45rem;
  cursor: pointer;
  transition: all 0.15s;
  background: ${(p) => p.$active ? `rgba(${rgb.gold}, 0.18)` : `rgba(${rgb.gold}, 0.06)`};
  border: 1px solid rgba(${rgb.gold}, ${(p) => p.$active ? 0.55 : 0.35});
  color: ${colors.gold};
  box-shadow: ${(p) => p.$active ? `0 0 12px rgba(${rgb.gold}, 0.3)` : "none"};
  &:hover {
    background: rgba(${rgb.gold}, 0.18);
    box-shadow: 0 0 10px rgba(${rgb.gold}, 0.25);
  }
`;

/* Gold-themed scrollbar — extends ModalBody so flex:1 + overflow-y:auto are preserved. */
const GoldModalBody = styled(ModalBody)`
  scrollbar-width: thin;
  scrollbar-color: rgba(${rgb.gold}, 0.55) transparent;
  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-thumb { background: rgba(${rgb.gold}, 0.45); border-radius: 4px; }
  &::-webkit-scrollbar-thumb:hover { background: ${colors.gold}; }
  &::-webkit-scrollbar-track { background: rgba(${rgb.gold}, 0.04); }
`;

/* Activity / history table */
const HistoryTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.7rem;
  font-family: ui-monospace, monospace;
  & th, & td { padding: 0.3rem 0.5rem; text-align: left; border-bottom: 1px solid rgba(${rgb.gold}, 0.1); }
  & th { color: var(--t-textGhost); font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.625rem; }
  & td { color: var(--t-text); }
`;

const TinyMsg = styled.div`
  font-size: 0.7rem;
  color: var(--t-textFaint);
  padding: 0.5rem 0;
  font-style: italic;
`;

/* ── Helpers ───────────────────────────────────────────────────── */

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MiB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GiB`;
}

function fmtTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "in the future?";
  const min = ms / 60000, hr = min / 60, day = hr / 24;
  if (min < 1) return "just now";
  if (min < 60) return `${Math.round(min)}m ago`;
  if (hr < 24) return `${Math.round(hr)}h ago`;
  return `${Math.round(day)}d ago`;
}

/* ── Component ─────────────────────────────────────────────────── */

export type BackupsControlModalProps = { onClose: () => void };

export default function BackupsControlModal({ onClose }: BackupsControlModalProps) {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState<boolean>(false);

  // Lock the underlying page scroll while this modal is open. Same idea as
  // a body-scroll-lock; uses the iframe's own document.body when we're in
  // embedded mode, and the top-level body otherwise. Restored on unmount.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([
        fetch("/api/backups/status", { credentials: "same-origin", cache: "no-store" }).then((r) => r.json()),
        fetch("/api/backups/history", { credentials: "same-origin", cache: "no-store" }).then((r) => r.json()),
      ]);
      setStatus(s);
      setHistory(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const onToggleCron = async (next: boolean) => {
    setBusy("toggle");
    setMsg(null);
    try {
      const r = await fetch("/api/backups/toggle-cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
      setMsg(`Cron ${next ? "ENABLED" : "DISABLED"}.`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onRunNow = async (tier: string) => {
    setBusy(`run-${tier}`);
    setMsg(null);
    try {
      const r = await fetch("/api/backups/run-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
      setMsg(body.message || `${tier} started (PID ${body.pid}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onSaveRetention = async (retention: { tier1?: Retention; tier2?: Retention; tier4?: Retention }) => {
    setBusy("save-retention");
    setMsg(null);
    try {
      const r = await fetch("/api/backups/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retention }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
      setMsg("Retention saved. Next backup will use new policy.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ModalBackdrop onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContainer $accent="gold" $maxWidth="56rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle $color={colors.gold}>💾 Backups</ModalTitle>
              <Sub>Off-site backup pipeline — rsync.net Lifetime 1 TB Zurich · restic over SFTP · GPG-encrypted secrets</Sub>
            </div>
          </ModalHeaderLeft>
          <HeaderActions>
            <GuideToggle
              $active={guideOpen}
              type="button"
              onClick={() => setGuideOpen((g) => !g)}
              title={guideOpen ? "Hide architecture guide" : "Show architecture guide"}
            >
              <span aria-hidden>📖</span>
              {guideOpen ? "Hide guide" : "Guide"}
            </GuideToggle>
            <NeonX accent="gold" onClick={onClose} />
          </HeaderActions>
        </ModalHeader>
        <GoldModalBody>
          {guideOpen && <div style={{ marginBottom: "1rem" }}><BackupGuide /></div>}
          {error && <ErrBox>{error}</ErrBox>}
          {msg && <Section style={{ borderColor: `rgba(${rgb.gold}, 0.45)` }}>{msg}</Section>}
          {!status && !error && <Loading>Loading backup state…</Loading>}
          {status && <Body
            status={status}
            history={history}
            busy={busy}
            onToggleCron={onToggleCron}
            onRunNow={onRunNow}
            onSaveRetention={onSaveRetention}
          />}
        </GoldModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}

function Body({
  status, history, busy, onToggleCron, onRunNow, onSaveRetention,
}: {
  status: BackupStatus;
  history: HistoryResponse | null;
  busy: string | null;
  onToggleCron: (next: boolean) => void;
  onRunNow: (tier: string) => void;
  onSaveRetention: (retention: { tier1?: Retention; tier2?: Retention; tier4?: Retention }) => void;
}) {
  const c = status.config;
  const [r1, setR1] = useState<Retention>(c.retention.tier1);
  const [r2, setR2] = useState<Retention>(c.retention.tier2);
  const [r4, setR4] = useState<Retention>(c.retention.tier4);
  const dirty = JSON.stringify({ r1, r2, r4 }) !== JSON.stringify({ r1: c.retention.tier1, r2: c.retention.tier2, r4: c.retention.tier4 });

  return (
    <Stack>
      {/* Recent Activity */}
      <Section>
        <SectionTitle>📜 Recent activity</SectionTitle>
        {history && history.runs.length === 0 && <TinyMsg>No backup runs yet.</TinyMsg>}
        {history && history.runs.length > 0 && (
          <HistoryTable>
            <thead>
              <tr><th>When</th><th>Tier</th><th>Status</th><th>Snapshot</th><th>Size</th></tr>
            </thead>
            <tbody>
              {history.runs.slice(0, 8).map((r, i) => (
                <tr key={i}>
                  <td>{timeAgo(r.timestamp)}</td>
                  <td>{r.tier ?? "—"}</td>
                  <td>{r.status === "ok" ? <Badge $variant="ok">ok</Badge> : <Badge $variant="err">{r.status}</Badge>}</td>
                  <td>{r.snapshot_id?.slice(0, 8) ?? "—"}</td>
                  <td>{r.total_size_bytes ? fmtBytes(r.total_size_bytes) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </HistoryTable>
        )}
      </Section>

      {/* Master Toggle */}
      <Section>
        <SectionTitle>🎛 Master cron toggle</SectionTitle>
        <ToggleRow>
          <GoldSwitch
            on={status.cron.active}
            onChange={onToggleCron}
            disabled={busy === "toggle" || (!status.cron.active && !status.cron.disabledFileExists)}
          />
          <ToggleLabel>
            <ToggleLabelMain>{status.cron.active ? "Cron ACTIVE — nightly runs scheduled" : "Cron DISABLED — manual runs only"}</ToggleLabelMain>
            <ToggleLabelSub>Renames /etc/cron.d/rcs-backups{status.cron.active ? " → .disabled" : ".disabled → (active)"}. Build-but-don&apos;t-fire convention: leave OFF until you&apos;ve done a successful manual run + monthly restore-test.</ToggleLabelSub>
          </ToggleLabel>
        </ToggleRow>
      </Section>

      {/* Run now */}
      <Section>
        <SectionTitle>▶ Run now (manual trigger)</SectionTitle>
        <RunRow>
          <RunBtn disabled={busy === "run-tier1"} onClick={() => onRunNow("tier1")}>{busy === "run-tier1" ? "Starting…" : "Tier 1 (DBs+JSON+cdn)"}</RunBtn>
          <RunBtn disabled={busy === "run-tier2"} onClick={() => onRunNow("tier2")}>{busy === "run-tier2" ? "Starting…" : "Tier 2 (configs)"}</RunBtn>
          <RunBtn disabled={busy === "run-tier4"} onClick={() => onRunNow("tier4")}>{busy === "run-tier4" ? "Starting…" : "Tier 4 (secrets)"}</RunBtn>
          <RunBtn disabled={busy === "run-restore-test"} onClick={() => onRunNow("restore-test")}>{busy === "run-restore-test" ? "Starting…" : "Restore-test"}</RunBtn>
        </RunRow>
        <TinyMsg>Detached — script writes to its log file and exits when complete (Tier 1 first run can take 20+ min over SFTP to Zurich).</TinyMsg>
      </Section>

      {/* Account */}
      <Section>
        <SectionTitle>📧 Account</SectionTitle>
        <KV>
          <dt>Provider</dt><dd>{c.provider.name}</dd>
          <dt>Tier</dt><dd>{c.provider.tier}</dd>
          <dt>Billing</dt><dd>{c.provider.tierBilling}</dd>
          <dt>Customer ID</dt><dd>{c.provider.customerId}</dd>
          <dt>Account Manager</dt><dd><ExtLink href={c.provider.accountManagerUrl} target="_blank" rel="noreferrer">{c.provider.accountManagerUrl}</ExtLink></dd>
          <dt>Owner</dt><dd>{c.provider.owner}</dd>
          <dt>Billing contact</dt><dd>{c.provider.billingContact}</dd>
          <dt>Technical contact</dt><dd>{c.provider.technicalContact}</dd>
        </KV>
      </Section>

      {/* Connection */}
      <Section>
        <SectionTitle>🔌 Connection</SectionTitle>
        <KV>
          <dt>Host</dt><dd>{c.provider.host}</dd>
          <dt>Username</dt><dd>{c.provider.username}</dd>
          <dt>Location</dt><dd>{c.provider.location}</dd>
          <dt>Repository URL</dt><dd>{c.repo.url}</dd>
          <dt>Tool</dt><dd>{c.repo.tool}</dd>
          <dt>Encryption</dt><dd>{c.repo.encryption}</dd>
          <dt>Repo reachable</dt><dd>{status.repo.reachable ? <Badge $variant="ok">Yes</Badge> : <Badge $variant="err">No · {status.repo.error ?? "unknown"}</Badge>}</dd>
          <dt>Snapshots</dt><dd>{status.repo.snapshotCount}</dd>
          <dt>Total size</dt><dd>{fmtBytes(status.repo.totalSizeBytes)}</dd>
          <dt>Latest snapshot</dt><dd>{status.repo.latestSnapshotId ?? "—"} {status.repo.latestSnapshotTime && `(${fmtTimestamp(status.repo.latestSnapshotTime)})`}</dd>
        </KV>
      </Section>

      {/* Encryption */}
      <Section>
        <SectionTitle>🔐 Encryption</SectionTitle>
        <KV>
          <dt>Restic password</dt><dd>{status.secrets.resticPasswordConfigured ? <Badge $variant="ok">Configured</Badge> : <Badge $variant="err">Missing</Badge>}</dd>
          <dt>GPG escrow public key</dt><dd>{status.secrets.gpgEscrowPubkeyImported ? <Badge $variant="ok">Imported</Badge> : <Badge $variant="err">Missing</Badge>}</dd>
          <dt>Escrow fingerprint</dt><dd>{c.encryption.gpgEscrowFingerprint}</dd>
          <dt>Escrow UID</dt><dd>{c.encryption.gpgEscrowUid}</dd>
          <dt>Escrow private key</dt><dd>{c.encryption.gpgPrivateKeyLocation}</dd>
        </KV>
      </Section>

      {/* Schedule */}
      <Section>
        <SectionTitle>📅 Schedule</SectionTitle>
        <KV>
          <dt>Tier 1</dt><dd>{c.schedule.tier1.cron} — {c.schedule.tier1.desc}</dd>
          <dt>Tier 2</dt><dd>{c.schedule.tier2.cron} — {c.schedule.tier2.desc}</dd>
          <dt>Tier 4</dt><dd>{c.schedule.tier4.cron} — {c.schedule.tier4.desc}</dd>
          <dt>Restore test</dt><dd>{c.schedule.restoreTest.cron} — {c.schedule.restoreTest.desc}</dd>
        </KV>
      </Section>

      {/* Retention — editable */}
      <Section>
        <SectionTitle>♻ Retention policy (live-editable)</SectionTitle>
        <RetentionGrid>
          <RetentionLabel></RetentionLabel>
          <RetentionHeader>Daily</RetentionHeader>
          <RetentionHeader>Weekly</RetentionHeader>
          <RetentionHeader>Monthly</RetentionHeader>
          <RetentionHeader>Yearly</RetentionHeader>
          <div></div>

          <RetentionLabel>Tier 1</RetentionLabel>
          <RetentionInput type="number" min={0} value={r1.keepDaily} onChange={(e) => setR1({ ...r1, keepDaily: +e.target.value })} />
          <RetentionInput type="number" min={0} value={r1.keepWeekly} onChange={(e) => setR1({ ...r1, keepWeekly: +e.target.value })} />
          <RetentionInput type="number" min={0} value={r1.keepMonthly} onChange={(e) => setR1({ ...r1, keepMonthly: +e.target.value })} />
          <RetentionInput type="number" min={0} value={r1.keepYearly} onChange={(e) => setR1({ ...r1, keepYearly: +e.target.value })} />
          <div></div>

          <RetentionLabel>Tier 2</RetentionLabel>
          <RetentionInput type="number" min={0} value={r2.keepDaily} onChange={(e) => setR2({ ...r2, keepDaily: +e.target.value })} />
          <RetentionInput type="number" min={0} value={r2.keepWeekly} onChange={(e) => setR2({ ...r2, keepWeekly: +e.target.value })} />
          <RetentionInput type="number" min={0} value={r2.keepMonthly} onChange={(e) => setR2({ ...r2, keepMonthly: +e.target.value })} />
          <RetentionInput type="number" min={0} value={r2.keepYearly} onChange={(e) => setR2({ ...r2, keepYearly: +e.target.value })} />
          <div></div>

          <RetentionLabel>Tier 4</RetentionLabel>
          <RetentionInput type="number" min={0} value={r4.keepDaily} onChange={(e) => setR4({ ...r4, keepDaily: +e.target.value })} />
          <RetentionInput type="number" min={0} value={r4.keepWeekly} onChange={(e) => setR4({ ...r4, keepWeekly: +e.target.value })} />
          <RetentionInput type="number" min={0} value={r4.keepMonthly} onChange={(e) => setR4({ ...r4, keepMonthly: +e.target.value })} />
          <RetentionInput type="number" min={0} value={r4.keepYearly} onChange={(e) => setR4({ ...r4, keepYearly: +e.target.value })} />
          <SaveBtn disabled={!dirty || busy === "save-retention"} onClick={() => onSaveRetention({ tier1: r1, tier2: r2, tier4: r4 })}>
            {busy === "save-retention" ? "…" : "Save"}
          </SaveBtn>
        </RetentionGrid>
      </Section>

      {/* Last run per tier */}
      <Section>
        <SectionTitle>🕒 Last run per tier</SectionTitle>
        <KV>
          <dt>Tier 1</dt><dd>{status.lastRunByTier.tier1 ? `${status.lastRunByTier.tier1.snapshotId} · ${timeAgo(status.lastRunByTier.tier1.timestamp)} · ${status.lastRunByTier.tier1.status}` : <Badge $variant="off">never</Badge>}</dd>
          <dt>Tier 2</dt><dd>{status.lastRunByTier.tier2 ? `${status.lastRunByTier.tier2.snapshotId} · ${timeAgo(status.lastRunByTier.tier2.timestamp)} · ${status.lastRunByTier.tier2.status}` : <Badge $variant="off">never</Badge>}</dd>
          <dt>Tier 4</dt><dd>{status.lastRunByTier.tier4 ? `${status.lastRunByTier.tier4.snapshotId} · ${timeAgo(status.lastRunByTier.tier4.timestamp)} · ${status.lastRunByTier.tier4.status}` : <Badge $variant="off">never</Badge>}</dd>
          <dt>Restore test</dt><dd>{status.restoreTest.latest ? `${timeAgo(status.restoreTest.latest.timestamp)} · ${status.restoreTest.latest.status} · pg_class=${status.restoreTest.latest.sentinel_count}` : <Badge $variant="off">never</Badge>}</dd>
        </KV>
      </Section>

      {/* Restore-test history */}
      <Section>
        <SectionTitle>🧪 Restore-test history</SectionTitle>
        {history && history.restoreTests.length === 0 && <TinyMsg>No restore-tests yet. First scheduled: 1st of next month, 04:00. Or click &ldquo;Restore-test&rdquo; above to run now.</TinyMsg>}
        {history && history.restoreTests.length > 0 && (
          <HistoryTable>
            <thead>
              <tr><th>When</th><th>Status</th><th>pg_class count</th><th>Dump size</th></tr>
            </thead>
            <tbody>
              {history.restoreTests.slice(0, 12).map((t, i) => (
                <tr key={i}>
                  <td>{fmtTimestamp(t.timestamp)}</td>
                  <td>{t.status === "ok" ? <Badge $variant="ok">PASS</Badge> : <Badge $variant="err">FAIL</Badge>}</td>
                  <td>{t.sentinel_count}</td>
                  <td>{t.dump_size_bytes ? fmtBytes(t.dump_size_bytes) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </HistoryTable>
        )}
      </Section>

      {/* Idle alert */}
      <Section>
        <SectionTitle>📡 Idle alert (rsync.net-side backup-failure canary)</SectionTitle>
        <KV>
          <dt>Configured</dt><dd>{c.idleAlert.configuredInAm ? <Badge $variant="ok">Yes</Badge> : <Badge $variant="warn">No — set in Account Manager</Badge>}</dd>
          <dt>Threshold</dt><dd>{c.idleAlert.thresholdHours} hours</dd>
          <dt>Recipients</dt><dd>{c.idleAlert.recipients.join(", ")}</dd>
        </KV>
      </Section>

      {/* Defense layers — positive framing */}
      <Section>
        <SectionTitle>🛡 Defense layers (ransomware / credential-theft resistance)</SectionTitle>
        <KV>
          <dt>Client-side encryption</dt><dd><Badge $variant="ok">Active</Badge> · restic AES-256 + Poly1305 — repo is unreadable without the password</dd>
          <dt>Secrets second layer</dt><dd><Badge $variant="ok">Active</Badge> · .env.local files GPG-encrypted with escrow keypair before restic — private key NEVER on RCS</dd>
          <dt>Dedicated SSH key</dt><dd><Badge $variant="ok">Active</Badge> · backup-only key, not shared with any other system</dd>
          <dt>ZFS snapshots (server-side)</dt><dd><Badge $variant="warn">Optional</Badge> · configurable in AM (Daily/Weekly/Monthly) — server-side rollback even if all client credentials are stolen</dd>
          <dt>SSH command= restriction</dt><dd><Badge $variant="warn">Pending</Badge> · post-go-live hardening — restricts the backup key to only run restic-required commands</dd>
          <dt>GC key off-RCS</dt><dd><Badge $variant="warn">Pending</Badge> · split prune credential into a separate key kept in MacPass — pruning runs out-of-band</dd>
        </KV>
      </Section>
    </Stack>
  );
}

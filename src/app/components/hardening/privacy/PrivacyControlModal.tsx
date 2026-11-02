"use client";

// PrivacyControlModal — Utils → System Hardening → Privacy & Data (privacy-compliance
// module, 2026-11-02; GDPR/UK-GDPR/CCPA on for everyone). One board for the things
// the rulebook says an operator must be able to see and act on: who consented to what,
// every data-subject request and whether it is inside its deadline, every closed
// account still inside its 30-day soft window (restore it, or pull it forward to
// tonight's erase run), the sealing key ring, and the nightly erase cron's last word.
// Reads /api/hardening/privacy; actions POST to the same route.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb } from "@/app/theme";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";
import ConfirmModal from "../../frontdesk/ConfirmModal";

type Consent = { purpose: string; active: number; withdrawn: number };
type Req = { id: string; memberId: string; email: string | null; kind: string; status: string; note: string | null; createdAt: string | null; dueAt: string | null; completedAt: string | null };
type Pending = { memberId: string; email: string | null; deletedAt: string | null; eraseAfter: string | null; requestId: string | null };
type Summary = {
  ok: boolean; migrated: boolean; at: string; error?: string;
  consents: Consent[]; openByKind: Record<string, number>; requests: Req[]; pending: Pending[];
  keys: { tgv: boolean | null; demo: boolean | null };
  cron: { logAt: string | null; lastLines: string[] };
};
type Ask = { op: "cancel" | "erase-now"; row: Pending } | null;

const PURPOSE_LABEL: Record<string, string> = {
  "starseed.birth": "Starseed birth data",
  "cospro.birth": "CosmicProfile birth data",
  "legal.terms": "Terms of service",
};
const KIND_LABEL: Record<string, string> = { export: "Export", erase: "Erase", rectify: "Rectify", restrict: "Restrict" };

const day = (t?: string | null) => (t ? new Date(t).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : "—");
const ago = (t?: string | null) => {
  if (!t) return "—";
  const s = Math.max(0, Math.round((Date.now() - Date.parse(t)) / 1000));
  return s < 90 ? `${s}s` : s < 5400 ? `${Math.round(s / 60)}m` : s < 172800 ? `${(s / 3600).toFixed(1)}h` : `${Math.round(s / 86400)}d`;
};
const daysLeft = (t?: string | null) => (t ? Math.ceil((Date.parse(t) - Date.now()) / 86400000) : 0);

export default function PrivacyControlModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/hardening/privacy", { cache: "no-store" });
      const j = (await r.json()) as Summary;
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setData(j); setErr(null);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { void refresh(); const t = setInterval(() => void refresh(), 30_000); return () => clearInterval(t); }, [refresh]);

  const post = useCallback(async (op: "cancel" | "erase-now", memberId: string) => {
    setBusy(memberId); setFlash(null);
    try {
      const r = await fetch("/api/hardening/privacy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op, memberId }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; note?: string };
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setFlash(op === "cancel" ? "Account restored — the member can sign in again." : (j.note ?? "Due now."));
      await refresh();
    } catch (e) { setFlash(`Failed: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(null); }
  }, [refresh]);

  const open = data?.openByKind ?? {};
  const overdue = (data?.requests ?? []).filter((r) => r.status === "open" && r.dueAt && Date.parse(r.dueAt) < Date.now());
  const dueErasures = (data?.pending ?? []).filter((p) => daysLeft(p.eraseAfter) <= 0);

  const sections: HCMSection[] = [
    {
      id: "status",
      title: "Status",
      qmbm: "Migration 0209 creates the privacy tables; until it has run on tgv_db this board is empty. The field key seals birth data at rest — it must be present in BOTH .env.local files (TGV and demo-hq) or sealed reads fail. The nightly cron on TGV hard-deletes accounts past their window at 03:30.",
      body: (
        <Body>
          {err && <ErrText>{err}</ErrText>}
          {flash && <Callout $tone={flash.startsWith("Failed") ? "critical" : "ok"}>{flash}</Callout>}
          {data && !data.migrated && <Callout $tone="warn">Privacy tables are not in tgv_db yet — migration 0209 has not run.</Callout>}
          <Grid>
            <Cell><StatLabel>Open requests</StatLabel><Rowline>
              {Object.keys(KIND_LABEL).map((k) => <Pill key={k} $tone={(open[k] ?? 0) > 0 ? "info" : "none"}>{KIND_LABEL[k]} {open[k] ?? 0}</Pill>)}
            </Rowline></Cell>
            <Cell><StatLabel>Overdue (past 30 days)</StatLabel><Pill $tone={overdue.length ? "critical" : "ok"}>{overdue.length}</Pill></Cell>
            <Cell><StatLabel>Accounts in soft window</StatLabel><Rowline>
              <Pill $tone={data?.pending.length ? "info" : "none"}>{data?.pending.length ?? 0} closing</Pill>
              {dueErasures.length > 0 && <Pill $tone="warn">{dueErasures.length} due tonight</Pill>}
            </Rowline></Cell>
            <Cell><StatLabel>Sealing key</StatLabel><Rowline>
              <Pill $tone={data?.keys.tgv ? "ok" : data?.keys.tgv === null ? "none" : "critical"}>TGV {data?.keys.tgv ? "present" : data?.keys.tgv === null ? "unreadable" : "MISSING"}</Pill>
              <Pill $tone={data?.keys.demo ? "ok" : data?.keys.demo === null ? "none" : "warn"}>demo {data?.keys.demo ? "present" : data?.keys.demo === null ? "unreadable" : "missing"}</Pill>
            </Rowline></Cell>
            <Cell><StatLabel>Erase cron</StatLabel>
              <Detail $tone={data?.cron.logAt ? (Date.now() - Date.parse(data.cron.logAt) < 2 * 86400000 ? "ok" : "warn") : "none"}>
                {data?.cron.logAt ? `last wrote ${ago(data.cron.logAt)} ago` : "no log yet (never ran)"}
              </Detail>
            </Cell>
          </Grid>
          <Muted>refreshed {data ? ago(data.at) : "—"} ago · every 30s</Muted>
        </Body>
      ),
    },
    {
      id: "closing",
      title: "Accounts closing",
      qmbm: "A member who closes their account is soft-deleted at once (cannot sign in, memberships hidden) and hard-deleted after the grace window (30 days by default, per-site tunable in the dashboard). Restore puts them back exactly as they were; Due now moves the hard delete to tonight's cron run — Keycloak, Stripe customer, uploads and every table that registered an eraser. Golden accounts cannot be erased.",
      body: (
        <Body>
          {!data?.pending.length ? <Muted>No account is inside its soft window.</Muted> : (
            <Table>
              <thead><tr><th>Member</th><th>Closed</th><th>Hard delete</th><th>Left</th><th /></tr></thead>
              <tbody>
                {data.pending.map((p) => {
                  const left = daysLeft(p.eraseAfter);
                  return (
                    <tr key={p.memberId}>
                      <td><Mono>{p.email ?? p.memberId.slice(0, 8)}</Mono></td>
                      <td>{day(p.deletedAt)}</td>
                      <td>{day(p.eraseAfter)}</td>
                      <td><Pill $tone={left <= 0 ? "warn" : left <= 3 ? "info" : "none"}>{left <= 0 ? "tonight" : `${left}d`}</Pill></td>
                      <td><Rowline>
                        <TBtn $active={false} disabled={busy === p.memberId || left <= 0} onClick={() => setAsk({ op: "cancel", row: p })}>Restore</TBtn>
                        <Danger disabled={busy === p.memberId || left <= 0} onClick={() => setAsk({ op: "erase-now", row: p })}>Due now</Danger>
                      </Rowline></td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Body>
      ),
    },
    {
      id: "requests",
      title: "Data-subject requests",
      qmbm: "Every export, erase, rectify and restrict request, newest first. Exports and self-service closes complete on the spot; a request still open past its due date is a statutory deadline missed (one month under GDPR, 45 days under CCPA) — answer it from the member's dashboard or by email, then it shows done.",
      body: (
        <Body>
          {!data?.requests.length ? <Muted>No requests yet.</Muted> : (
            <Table>
              <thead><tr><th>When</th><th>Member</th><th>Kind</th><th>Status</th><th>Due</th><th>Note</th></tr></thead>
              <tbody>
                {data.requests.map((r) => {
                  const late = r.status === "open" && r.dueAt && Date.parse(r.dueAt) < Date.now();
                  return (
                    <tr key={r.id}>
                      <td>{day(r.createdAt)}</td>
                      <td><Mono>{r.email ?? r.memberId.slice(0, 8)}</Mono></td>
                      <td>{KIND_LABEL[r.kind] ?? r.kind}</td>
                      <td><Pill $tone={late ? "critical" : r.status === "open" ? "info" : r.status === "done" ? "ok" : "none"}>{late ? "OVERDUE" : r.status}</Pill></td>
                      <td>{r.status === "open" ? day(r.dueAt) : r.completedAt ? `done ${day(r.completedAt)}` : "—"}</td>
                      <td><Muted>{r.note ?? ""}</Muted></td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Body>
      ),
    },
    {
      id: "consents",
      title: "Consent ledger",
      qmbm: "Special-category data (birth date, time and place for astrology) is collected only with explicit, revocable consent. Active = granted and not withdrawn; withdrawn rows are kept as proof the consent existed, with the data itself sealed or gone.",
      body: (
        <Body>
          {!data?.consents.length ? <Muted>No consent has been recorded yet.</Muted> : (
            <Table>
              <thead><tr><th>Purpose</th><th>Active</th><th>Withdrawn</th></tr></thead>
              <tbody>
                {data.consents.map((c) => (
                  <tr key={c.purpose}><td>{PURPOSE_LABEL[c.purpose] ?? c.purpose} <Mono>{c.purpose}</Mono></td><td>{c.active}</td><td>{c.withdrawn}</td></tr>
                ))}
              </tbody>
            </Table>
          )}
        </Body>
      ),
    },
    {
      id: "cron",
      title: "Erase cron — last run",
      qmbm: "Tail of data/privacy/erase-cron.log on TGV. The job is scripts/privacy-erase-cron.mts, run from crontab at 03:30 daily; --dry-run lists what would go.",
      body: (
        <Body>
          {!data?.cron.lastLines.length ? <Muted>Log is empty — the cron has not written yet.</Muted> : data.cron.lastLines.map((l, i) => <Mono key={i}>{l}</Mono>)}
        </Body>
      ),
    },
  ];

  return (
    <>
      <HardeningControlModal
        title="Privacy & Data"
        subtitle="consents · requests · closing accounts · the sealing key · the erase cron"
        sections={sections}
        auditLogView={<AuditLogTimeline endpoint="/api/hardening/privacy/audit-log" />}
        onClose={onClose}
      />
      <ConfirmModal
        open={!!ask}
        title={ask?.op === "cancel" ? "Restore this account?" : "Erase tonight?"}
        message={ask?.op === "cancel"
          ? `${ask.row.email ?? ask.row.memberId} comes back exactly as it was and can sign in again.`
          : `${ask?.row.email ?? ask?.row.memberId ?? ""} loses its remaining ${daysLeft(ask?.row.eraseAfter)} day(s) of grace. The 03:30 cron hard-deletes it: Keycloak, Stripe, uploads, every table.`}
        detail={ask?.op === "erase-now" ? "This cannot be undone once the cron has run." : undefined}
        confirmLabel={ask?.op === "cancel" ? "Restore" : "Erase tonight"}
        intent={ask?.op === "cancel" ? "primary" : "danger"}
        onConfirm={async () => { const a = ask; setAsk(null); if (a) await post(a.op, a.row.memberId); }}
        onCancel={() => setAsk(null)}
      />
    </>
  );
}

type Tone = "ok" | "info" | "warn" | "critical" | "none";
const TONE: Record<Tone, string> = { ok: colors.green, info: colors.cyan, warn: colors.gold, critical: colors.red, none: "var(--t-textFaint)" };
const TONE_RGB: Record<Tone, string> = { ok: rgb.green, info: rgb.cyan, warn: rgb.gold, critical: rgb.red, none: rgb.cyan };

const Body = styled.div`display: flex; flex-direction: column; gap: 0.75rem;`;
const Rowline = styled.div`display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;`;
const Pill = styled.span<{ $tone: Tone }>`
  display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.04em;
  color: ${(p) => TONE[p.$tone]}; background: rgba(${(p) => TONE_RGB[p.$tone]}, ${(p) => (p.$tone === "none" ? 0.06 : 0.14)}); border: 1px solid rgba(${(p) => TONE_RGB[p.$tone]}, ${(p) => (p.$tone === "none" ? 0.15 : 0.4)});
`;
const Callout = styled.div<{ $tone: Tone }>`
  padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-size: 0.78rem; color: ${(p) => TONE[p.$tone]};
  background: rgba(${(p) => TONE_RGB[p.$tone]}, 0.1); border: 1px solid rgba(${(p) => TONE_RGB[p.$tone]}, 0.35);
`;
const Detail = styled.div<{ $tone: Tone }>`font-size: 0.72rem; color: ${(p) => TONE[p.$tone]}; padding: 0.1rem 0;`;
const Muted = styled.div`font-size: 0.72rem; color: var(--t-textFaint);`;
const Mono = styled.span`font-family: var(--font-geist-mono), monospace; font-size: 0.72rem; color: var(--t-text); display: inline-block;`;
const ErrText = styled.div`font-size: 0.6875rem; color: ${colors.red}; font-family: var(--font-geist-mono), monospace;`;
const Grid = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0.625rem;`;
const Cell = styled.div`display: flex; flex-direction: column; gap: 0.3rem;`;
const StatLabel = styled.span`font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--t-textFaint);`;
const TBtn = styled.button<{ $active: boolean }>`
  padding: 0.3rem 0.7rem; font-size: 0.72rem; font-weight: 650; border-radius: 0.4rem; cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.16)` : "transparent")};
  color: ${(p) => (p.$active ? colors.gold : "var(--t-textMuted)")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.5)` : "var(--t-border)")};
  &:hover:not(:disabled) { color: ${colors.gold}; border-color: rgba(${rgb.gold}, 0.5); }
  &:disabled { opacity: 0.5; cursor: default; }
`;
const Danger = styled.button`
  padding: 0.3rem 0.7rem; font-size: 0.72rem; font-weight: 700; border-radius: 0.4rem; cursor: pointer;
  background: rgba(${rgb.red}, 0.12); color: ${colors.red}; border: 1px solid rgba(${rgb.red}, 0.5);
  &:disabled { opacity: 0.5; cursor: default; }
`;
const Table = styled.table`
  width: 100%; border-collapse: collapse; font-size: 12px;
  th { text-align: left; font-weight: 600; color: var(--t-textGhost); padding: 4px 8px 4px 0; border-bottom: 1px solid rgba(${rgb.cyan},0.18); }
  td { padding: 4px 8px 4px 0; border-bottom: 1px solid rgba(${rgb.cyan},0.08); font-variant-numeric: tabular-nums; vertical-align: top; }
`;

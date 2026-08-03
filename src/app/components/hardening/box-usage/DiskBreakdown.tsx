"use client";

// DiskBreakdown — the "why is the disk full, and what can I do about it" panel
// inside the Box Usage HCM.
//
// The gauge in the Capacity section says 93%. This says which directories that
// is, and puts a gear on the ones that can be cleaned up, so a full box is
// something an operator can act on from Office instead of an ssh session.
//
// Two rules the UI keeps to:
//   · Nothing is deleted without a preview first. The Reclaim button stays
//     disabled until Preview has said exactly what would go, and then it asks
//     once more before doing it.
//   · Every row carries its own consequence text. The point of the panel is
//     informed cleanup, not one-click cleanup.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import SettingsIcon from "@/app/components/icons/SettingsIcon";

type Group = "logs" | "builds" | "caches" | "system";

type TargetPolicy = { enabled: boolean; minAgeDays: number; keep: number };

type TargetUsage = {
  id: string;
  label: string;
  path: string;
  group: Group;
  what: string;
  consequence: string;
  bytes: number | null;
  unreadable?: string;
  reclaimableBytes: number | null;
  countsTowardTotal: boolean;
  sweepable: boolean;
  sweepKind: "files" | "children" | "nested" | "command" | null;
  policy: TargetPolicy;
};

type DiskScan = {
  fs: { mount: string; sizeBytes: number; usedBytes: number; availBytes: number; usePct: number } | null;
  targets: TargetUsage[];
  unaccountedBytes: number | null;
  scannedAt: string;
  durationMs: number;
};

type SweepCandidate = { path: string; bytes: number; ageDays: number; action: "delete" | "truncate" };

type SweepPlan = {
  targetId: string;
  armed: boolean;
  reason?: string;
  candidates: SweepCandidate[];
  totalBytes: number;
  opaqueCommand?: string;
};

type SweepResult = {
  targetId: string;
  applied: boolean;
  freedBytes: number;
  removed: number;
  errors: string[];
  commandOutput?: string;
};

const GROUP_LABEL: Record<Group, string> = {
  logs: "logs",
  builds: "build artefacts",
  caches: "caches",
  system: "system",
};

export function fmtBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

function ago(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

export default function DiskBreakdown() {
  const [scan, setScan] = useState<DiskScan | null>(null);
  const [needsScan, setNeedsScan] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [plans, setPlans] = useState<Record<string, SweepPlan>>({});
  const [results, setResults] = useState<Record<string, SweepResult>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // First paint asks for the CACHE only: a cold `du` over a million inodes can
  // take a minute, and a section that hangs on open reads as broken.
  const loadCached = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/host-metrics/disk?cached=1", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json();
      if (data?.needsScan) {
        setNeedsScan(true);
        return;
      }
      setScan(data as DiskScan);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    loadCached();
  }, [loadCached]);

  const runScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/host-metrics/disk?refresh=1", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      setScan(data as DiskScan);
      setNeedsScan(false);
      setPlans({});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const savePolicy = async (targetId: string, patch: Partial<TargetPolicy>) => {
    setBusyId(targetId);
    try {
      const res = await fetch("/api/admin/host-metrics/disk/policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ targetId, ...patch }),
      });
      if (!res.ok) return;
      const next = (await res.json()) as TargetPolicy;
      setScan((s) =>
        s
          ? { ...s, targets: s.targets.map((t) => (t.id === targetId ? { ...t, policy: next } : t)) }
          : s,
      );
      // The old preview was computed under the old policy — drop it rather than
      // leave a stale byte count sitting above a Reclaim button.
      setPlans((p) => {
        if (!(targetId in p)) return p;
        const rest = { ...p };
        delete rest[targetId];
        return rest;
      });
      setConfirmId(null);
    } finally {
      setBusyId(null);
    }
  };

  const preview = async (targetId: string) => {
    setBusyId(targetId);
    setConfirmId(null);
    try {
      const res = await fetch("/api/admin/host-metrics/disk/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ targetId }),
      });
      const data = await res.json();
      if (data?.plan) setPlans((p) => ({ ...p, [targetId]: data.plan as SweepPlan }));
    } finally {
      setBusyId(null);
    }
  };

  const reclaim = async (targetId: string) => {
    if (confirmId !== targetId) {
      setConfirmId(targetId);
      return;
    }
    setBusyId(targetId);
    setConfirmId(null);
    try {
      const res = await fetch("/api/admin/host-metrics/disk/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ targetId, apply: true }),
      });
      const data = await res.json();
      if (data?.result) setResults((r) => ({ ...r, [targetId]: data.result as SweepResult }));
      setPlans((p) => {
        if (!(targetId in p)) return p;
        const rest = { ...p };
        delete rest[targetId];
        return rest;
      });
      await runScan();
    } finally {
      setBusyId(null);
    }
  };

  const fs = scan?.fs ?? null;
  const largest = Math.max(1, ...(scan?.targets ?? []).map((t) => t.bytes ?? 0));
  const totalReclaimable = (scan?.targets ?? []).reduce((s, t) => s + (t.reclaimableBytes ?? 0), 0);

  return (
    <Wrap>
      {fs && (
        <FsHead>
          <FsBar>
            <FsFill
              style={{
                width: `${Math.min(100, fs.usePct)}%`,
                background: fs.usePct >= 90 ? colors.red : fs.usePct >= 75 ? colors.gold : colors.green,
              }}
            />
          </FsBar>
          <FsText>
            <strong>{fmtBytes(fs.usedBytes)}</strong> used of {fmtBytes(fs.sizeBytes)} ·{" "}
            {fmtBytes(fs.availBytes)} free · {fs.usePct.toFixed(1)}% on {fs.mount}
          </FsText>
        </FsHead>
      )}

      <Rowline>
        <Btn onClick={runScan} disabled={scanning}>
          {scanning ? "Scanning…" : scan ? "Rescan" : "Scan now"}
        </Btn>
        <Muted>
          {scanning
            ? "du is running at the lowest I/O priority — this takes about a minute on a full box."
            : scan
              ? `Measured ${ago(scan.scannedAt)} · took ${Math.round(scan.durationMs / 1000)}s${
                  totalReclaimable > 0
                    ? ` · ${fmtBytes(totalReclaimable)} free-able under the current policies`
                    : ""
                }`
              : needsScan
                ? "Nothing measured yet."
                : ""}
        </Muted>
      </Rowline>

      {error && <ErrText>{error}</ErrText>}

      {scan?.targets.map((t) => {
        const open = openId === t.id;
        const plan = plans[t.id];
        const result = results[t.id];
        return (
          <Row key={t.id} $open={open}>
            <RowTop>
              <RowLabel>
                {t.label}
                <RowGroup>{GROUP_LABEL[t.group]}</RowGroup>
              </RowLabel>
              <Track>
                <Fill
                  style={{
                    width: `${((t.bytes ?? 0) / largest) * 100}%`,
                    background: t.sweepable ? colors.gold : "var(--t-textGhost)",
                  }}
                />
              </Track>
              <RowSize>
                {t.unreadable ? t.unreadable : fmtBytes(t.bytes)}
                {!t.unreadable && t.reclaimableBytes ? (
                  <Reclaimable>{fmtBytes(t.reclaimableBytes)} free-able</Reclaimable>
                ) : null}
              </RowSize>
              <Gear
                onClick={() => setOpenId(open ? null : t.id)}
                $open={open}
                aria-label={`${t.label} cleanup settings`}
                title={`${t.label} — what this is, and what cleanup would do`}
              >
                <SettingsIcon size={14} />
              </Gear>
            </RowTop>

            {open && (
              <Pop>
                <PopPath>{t.path}</PopPath>
                <PopText>{t.what}</PopText>
                <PopText $warn>{t.consequence}</PopText>

                {!t.sweepable ? (
                  <Muted>Measured only — this row has no cleanup action by design.</Muted>
                ) : (
                  <>
                    <Knobs>
                      <Btn
                        $active={t.policy.enabled}
                        disabled={busyId === t.id}
                        onClick={() => savePolicy(t.id, { enabled: !t.policy.enabled })}
                      >
                        {t.policy.enabled ? "Armed" : "Disarmed"}
                      </Btn>
                      {t.sweepKind !== "command" && (
                        <>
                          <NumField
                            label="Older than (days)"
                            value={t.policy.minAgeDays}
                            disabled={busyId === t.id}
                            onCommit={(v) => savePolicy(t.id, { minAgeDays: v })}
                          />
                          <NumField
                            label="Keep newest"
                            value={t.policy.keep}
                            disabled={busyId === t.id}
                            onCommit={(v) => savePolicy(t.id, { keep: v })}
                          />
                        </>
                      )}
                    </Knobs>

                    <Rowline>
                      <Btn onClick={() => preview(t.id)} disabled={busyId === t.id}>
                        {busyId === t.id ? "Working…" : "Preview"}
                      </Btn>
                      <Btn
                        $danger
                        disabled={
                          busyId === t.id ||
                          !plan?.armed ||
                          (plan.candidates.length === 0 && !plan.opaqueCommand)
                        }
                        onClick={() => reclaim(t.id)}
                      >
                        {confirmId === t.id
                          ? "Click again to confirm"
                          : plan?.opaqueCommand
                            ? `Run ${plan.opaqueCommand}`
                            : plan
                              ? `Reclaim ${fmtBytes(plan.totalBytes)}`
                              : "Reclaim"}
                      </Btn>
                    </Rowline>

                    {plan && !plan.armed && <Muted>Not armed: {plan.reason}.</Muted>}
                    {plan?.opaqueCommand && (
                      <Muted>
                        This one can&apos;t be previewed — the command decides for itself what is
                        unreferenced.
                      </Muted>
                    )}
                    {plan?.armed && !plan.opaqueCommand && (
                      <PlanBox>
                        <Muted>
                          {plan.candidates.length} item{plan.candidates.length === 1 ? "" : "s"} ·{" "}
                          {fmtBytes(plan.totalBytes)}
                          {plan.candidates.some((c) => c.action === "truncate")
                            ? " · emptied in place, not deleted"
                            : ""}
                        </Muted>
                        {plan.candidates.slice(0, 12).map((c) => (
                          <PlanRow key={c.path}>
                            <PlanPath>{c.path}</PlanPath>
                            <PlanMeta>
                              {fmtBytes(c.bytes)} · {c.ageDays}d
                            </PlanMeta>
                          </PlanRow>
                        ))}
                        {plan.candidates.length > 12 && (
                          <Muted>+{plan.candidates.length - 12} more</Muted>
                        )}
                      </PlanBox>
                    )}

                    {result && (
                      <Muted>
                        Reclaimed {fmtBytes(result.freedBytes)} from {result.removed} item
                        {result.removed === 1 ? "" : "s"}
                        {result.commandOutput ? ` · ${result.commandOutput.split("\n")[0]}` : ""}
                        {result.errors.length ? ` · ${result.errors.length} error(s)` : ""}
                      </Muted>
                    )}
                    {result?.errors.slice(0, 3).map((e) => (
                      <ErrText key={e}>{e}</ErrText>
                    ))}
                  </>
                )}
              </Pop>
            )}
          </Row>
        );
      })}

      {scan && scan.unaccountedBytes !== null && (
        <Muted>
          {fmtBytes(scan.unaccountedBytes)} sits outside these directories — the OS, /usr, swap and
          everything not worth a row.
        </Muted>
      )}
    </Wrap>
  );
}

/** Commits on blur/Enter, like the thresholds above — a PATCH per keystroke would audit-log per digit. */
function NumField({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onCommit: (v: number) => void;
}) {
  // Re-sync when the saved value changes, without an effect: React's own
  // "adjust state during render" pattern, and one render instead of two.
  const [draft, setDraft] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(String(value));
  }

  return (
    <Knob>
      <KnobLabel>{label}</KnobLabel>
      <KnobInput
        type="number"
        min={0}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (!Number.isFinite(n) || n === value) {
            setDraft(String(value));
            return;
          }
          onCommit(n);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </Knob>
  );
}

// ── styled ───────────────────────────────────────────────────────────────

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Rowline = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const Muted = styled.div`
  font-size: 0.7rem;
  color: var(--t-textFaint);
  line-height: 1.5;
`;

const ErrText = styled.div`
  font-size: 0.6875rem;
  color: ${colors.red};
  font-family: var(--font-geist-mono), monospace;
  word-break: break-all;
`;

const FsHead = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
`;

const FsBar = styled.div`
  height: 0.6rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
`;

const FsFill = styled.div`
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
`;

const FsText = styled.div`
  font-size: 0.72rem;
  color: var(--t-textMuted);
  font-variant-numeric: tabular-nums;
`;

const Row = styled.div<{ $open: boolean }>`
  border: 1px solid ${(p) => (p.$open ? `rgba(${rgb.gold}, 0.35)` : "var(--t-border)")};
  border-radius: 0.5rem;
  padding: 0.45rem 0.6rem;
  background: ${(p) => (p.$open ? "rgba(0, 0, 0, 0.25)" : "transparent")};
`;

const RowTop = styled.div`
  display: grid;
  grid-template-columns: minmax(8rem, 12rem) 1fr 6.5rem 1.6rem;
  align-items: center;
  gap: 0.6rem;
`;

const RowLabel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  font-size: 0.75rem;
  color: var(--t-text);
`;

const RowGroup = styled.span`
  font-size: 0.575rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--t-textFaint);
`;

const Track = styled.div`
  height: 0.45rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
`;

const Fill = styled.div`
  height: 100%;
  border-radius: 999px;
  opacity: 0.75;
`;

const RowSize = styled.span`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.05rem;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--t-textMuted);
`;

const Reclaimable = styled.span`
  font-size: 0.6rem;
  color: ${colors.gold};
  white-space: nowrap;
`;

const Gear = styled.button<{ $open: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 0.35rem;
  cursor: pointer;
  background: ${(p) => (p.$open ? `rgba(${rgb.gold}, 0.16)` : "transparent")};
  color: ${(p) => (p.$open ? colors.gold : "var(--t-textFaint)")};
  border: 1px solid ${(p) => (p.$open ? `rgba(${rgb.gold}, 0.5)` : "transparent")};
  &:hover {
    color: ${colors.gold};
  }
`;

const Pop = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-top: 0.55rem;
  padding-top: 0.55rem;
  border-top: 1px dashed var(--t-border);
`;

const PopPath = styled.code`
  font-size: 0.66rem;
  font-family: var(--font-geist-mono), monospace;
  color: var(--t-textFaint);
  word-break: break-all;
`;

const PopText = styled.p<{ $warn?: boolean }>`
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.55;
  color: ${(p) => (p.$warn ? colors.gold : "var(--t-textMuted)")};
`;

const Knobs = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 0.6rem;
  flex-wrap: wrap;
`;

const Knob = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
`;

const KnobLabel = styled.span`
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--t-textFaint);
`;

const KnobInput = styled.input`
  width: 6rem;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  padding: 0.28rem 0.45rem;
  border-radius: 0.35rem;
  background: var(--t-inputBg);
  color: var(--t-text);
  border: 1px solid var(--t-border);
  &:focus {
    outline: none;
    border-color: rgba(${rgb.gold}, 0.5);
  }
`;

const Btn = styled.button<{ $active?: boolean; $danger?: boolean }>`
  padding: 0.32rem 0.7rem;
  font-size: 0.7rem;
  font-weight: 650;
  border-radius: 0.4rem;
  cursor: pointer;
  background: ${(p) =>
    p.$danger ? "rgba(255, 80, 80, 0.10)" : p.$active ? `rgba(${rgb.gold}, 0.16)` : "transparent"};
  color: ${(p) => (p.$danger ? colors.red : p.$active ? colors.gold : "var(--t-textMuted)")};
  border: 1px solid
    ${(p) => (p.$danger ? "rgba(255, 80, 80, 0.45)" : p.$active ? `rgba(${rgb.gold}, 0.5)` : "var(--t-border)")};
  &:hover:not(:disabled) {
    color: ${(p) => (p.$danger ? colors.red : colors.gold)};
    border-color: ${(p) => (p.$danger ? colors.red : `rgba(${rgb.gold}, 0.5)`)};
  }
  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
`;

const PlanBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  max-height: 12rem;
  overflow-y: auto;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--t-border);
  border-radius: 0.4rem;
  background: rgba(0, 0, 0, 0.25);
`;

const PlanRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.66rem;
  font-family: var(--font-geist-mono), monospace;
`;

const PlanPath = styled.span`
  color: var(--t-textMuted);
  word-break: break-all;
`;

const PlanMeta = styled.span`
  color: var(--t-textFaint);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
`;

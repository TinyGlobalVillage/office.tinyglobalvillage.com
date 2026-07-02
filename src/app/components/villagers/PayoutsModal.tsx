"use client";

// PayoutsModal — the VILLAGERS operations console for member cash-out (withdrawals). Sibling of
// MemberWalletModal; the day-to-day surface where an operator WORKS the payout queue: see pending
// requests, watch each one's fraud-hold countdown, and run the status transitions
// (approve → mark-paid, or fail / cancel). It also exposes "Release now" — the trusted-member
// override that pays a withdrawal BEFORE its holdHours fraud window elapses (audited distinctly).
//
// Split of concerns (de-dup): this tile owns the live QUEUE + transitions; the Wallet Cash-Out
// hardening tile (WalletControlModal) owns the SAFETY posture — the two-key gate, killswitch,
// fraud limits, and the full audit timeline. The queue used to live in both; it lives here now.
//
// Every transition reverses the `cash` ledger and MUST run tgv.com's engine, so this proxies
// server-to-server via /api/admin/wallet/advance (the internal-secret operator seam). Reads come
// straight from tgv_db (/api/admin/wallet/queue) + the config proxy (/api/admin/wallet/config, for
// holdHours + the live gate). Operator-only — requireAdmin guards every route, and the page itself
// is admin-gated server-side. tgv.com ADDITIONALLY 403s every transition until WITHDRAWALS_ENABLED
// is on, so actions are inert (and disabled here) while the launch flag is off. 1 token = $0.25.

import { useCallback, useEffect, useMemo, useState } from "react";
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

type WithdrawalStatus = "requested" | "approved" | "paid" | "failed" | "cancelled";

// snake_case — these rows come straight from tgv_db via the raw-SQL queue route.
type WithdrawalRow = {
  id: string;
  member_id: string;
  env: string;
  amount_tokens: number;
  amount_cents: number;
  status: WithdrawalStatus;
  rail: string;
  external_ref: string | null;
  note: string | null;
  requested_at: string;
  updated_at: string;
};

type WithdrawalConfig = { holdHours: number; rail: string; enabled: boolean };
type Gate = { launchEnabled: boolean; killswitchEnabled: boolean; live: boolean };

type LaneFilter = "all" | "live" | "test";
type Op = "approve" | "markPaid" | "releaseNow" | "markFailed" | "cancel";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const STATUS_COLOR: Record<WithdrawalStatus, string> = {
  requested: colors.cyan,
  approved: colors.gold,
  paid: "#4ade80",
  failed: colors.pink,
  cancelled: "#8a8a8a",
};

/** Human "2h 5m" / "45m" / "<1m" from a positive millisecond remainder. */
function fmtRemaining(ms: number): string {
  if (ms <= 0) return "now";
  const mins = Math.ceil(ms / 60000);
  if (mins < 1) return "<1m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function PayoutsModal({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<WithdrawalConfig | null>(null);
  const [gate, setGate] = useState<Gate | null>(null);
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [lane, setLane] = useState<LaneFilter>("live");
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<{ id: string; msg: string } | null>(null);
  // Ticking clock so the hold countdowns stay live without a refetch.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const loadConfig = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch("/api/admin/wallet/config", { cache: "no-store", signal });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setConfig(d.config ?? null);
      setGate(d.gate ?? null);
    }
  }, []);

  const loadQueue = useCallback(
    async (signal?: AbortSignal) => {
      const statuses = showHistory ? "all" : "requested,approved";
      const res = await fetch(`/api/admin/wallet/queue?statuses=${statuses}&limit=500`, {
        cache: "no-store",
        signal,
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) setRows(Array.isArray(d.withdrawals) ? d.withdrawals : []);
    },
    [showHistory],
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        await Promise.all([loadConfig(signal), loadQueue(signal)]);
        setLoadErr(null);
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        setLoadErr("Couldn't load the payout queue from tgv.com.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [loadConfig, loadQueue],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const holdHours = config?.holdHours ?? 0;
  const holdMs = holdHours * 3600_000;
  const liveActions = !!gate?.live;

  const eligibleAtMs = (w: WithdrawalRow) => new Date(w.requested_at).getTime() + holdMs;
  const withinHold = (w: WithdrawalRow) => holdMs > 0 && now < eligibleAtMs(w);

  const visible = useMemo(
    () => (lane === "all" ? rows : rows.filter((w) => w.env === lane)),
    [rows, lane],
  );
  const openRows = visible.filter((w) => w.status === "requested" || w.status === "approved");
  const pendingTokens = openRows.reduce((sum, w) => sum + w.amount_tokens, 0);

  const runAction = useCallback(
    async (w: WithdrawalRow, op: Op) => {
      const tag = `${w.id.slice(0, 8)} · ${w.amount_tokens} tok (${usd(w.amount_cents)})`;
      let externalRef: string | undefined;
      let note: string | undefined;

      if (op === "markPaid" || op === "releaseNow") {
        if (op === "releaseNow") {
          if (
            !window.confirm(
              `Release ${tag} NOW — bypassing the ${holdHours}h fraud hold?\n\n` +
                `Use only for a trusted member; this pays out immediately and is audited as an early release.`,
            )
          )
            return;
        }
        const ref = window.prompt(
          `${op === "releaseNow" ? "Release (pay)" : "Mark"} ${tag} PAID.\n` +
            `Enter the payout reference (bank / transfer id) — required for the operator_advance rail:`,
        );
        if (ref === null) return; // dismissed
        if (!ref.trim()) {
          setActionErr({ id: w.id, msg: "A payout reference is required to pay." });
          return;
        }
        externalRef = ref.trim();
      } else {
        const verb = op === "approve" ? "Approve" : op === "markFailed" ? "Mark FAILED" : "Cancel";
        if (!window.confirm(`${verb} withdrawal ${tag}?`)) return;
        if (op === "markFailed" || op === "cancel") {
          const n = window.prompt("Optional note (reason) — blank for none:") ?? "";
          if (n.trim()) note = n.trim();
        }
      }

      setActingId(w.id);
      setActionErr(null);
      try {
        const res = await fetch("/api/admin/wallet/advance", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ op, withdrawalId: w.id, env: w.env, externalRef, note }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || d?.ok === false) {
          const err = d?.error ?? d?.status;
          setActionErr({
            id: w.id,
            msg: err ? `Action failed: ${err}` : `Action failed (HTTP ${res.status}).`,
          });
          return;
        }
        await loadQueue();
      } catch {
        setActionErr({ id: w.id, msg: "Action failed — couldn't reach the server." });
      } finally {
        setActingId(null);
      }
    },
    [holdHours, loadQueue],
  );

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="gold" $maxWidth="62rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle>Payouts</ModalTitle>
              <Sub>Work the member cash-out queue · watch fraud holds · approve, pay, or release early</Sub>
            </div>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <Stack>
            {gate && (
              <GateBanner $live={gate.live}>
                <LivePill $live={gate.live}>{gate.live ? "WITHDRAWALS LIVE" : "WITHDRAWALS OFF"}</LivePill>
                <GateText>
                  {gate.live
                    ? `Queue transitions are live. Fraud hold: ${holdHours > 0 ? `${holdHours}h` : "none"}.`
                    : "Launch flag is off — the queue is read-only and actions are inert until withdrawals go live."}
                </GateText>
              </GateBanner>
            )}

            <Controls>
              <LaneTabs>
                {(["live", "test", "all"] as LaneFilter[]).map((l) => (
                  <LaneTab key={l} type="button" $active={lane === l} onClick={() => setLane(l)}>
                    {l}
                  </LaneTab>
                ))}
              </LaneTabs>
              <Spacer />
              <ToggleBtn type="button" $on={showHistory} onClick={() => setShowHistory((v) => !v)}>
                {showHistory ? "Showing all history" : "Open queue only"}
              </ToggleBtn>
              <ToggleBtn type="button" $on={false} onClick={() => void load()} disabled={loading}>
                {loading ? "Loading…" : "Refresh"}
              </ToggleBtn>
            </Controls>

            <Summary>
              <strong>{openRows.length}</strong> open{" "}
              {openRows.length === 1 ? "request" : "requests"} · <strong>{pendingTokens}</strong> tok{" "}
              <Dim>({usd(pendingTokens * 25)})</Dim> pending
              {lane !== "all" && <Dim> · {lane} lane</Dim>}
            </Summary>

            {loadErr && <ErrText>{loadErr}</ErrText>}

            {loading ? (
              <Dim>Loading…</Dim>
            ) : visible.length === 0 ? (
              <Empty>
                {showHistory
                  ? "No cash-out requests on record for this lane."
                  : "No open cash-out requests — the queue fills once members request withdrawals."}
              </Empty>
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Env</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Rail</th>
                      <th>Ref</th>
                      <th>Requested</th>
                      <th>Hold</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((w) => {
                      const busy = actingId === w.id;
                      const held = w.status === "approved" && withinHold(w);
                      const rowErr = actionErr?.id === w.id ? actionErr.msg : null;
                      return (
                        <tr key={w.id}>
                          <td><Mono>{w.member_id.slice(0, 8)}</Mono></td>
                          <td><EnvPill $live={w.env === "live"}>{w.env}</EnvPill></td>
                          <td>
                            {w.amount_tokens} tok <Dim>({usd(w.amount_cents)})</Dim>
                          </td>
                          <td><Pill $color={STATUS_COLOR[w.status] ?? "#8a8a8a"}>{w.status}</Pill></td>
                          <td>{w.rail}</td>
                          <td>{w.external_ref ? <Mono>{w.external_ref}</Mono> : <Dim>—</Dim>}</td>
                          <td><Dim>{new Date(w.requested_at).toLocaleString()}</Dim></td>
                          <td>
                            {w.status === "approved" ? (
                              held ? (
                                <Hold title={`Paid-eligible at ${new Date(eligibleAtMs(w)).toLocaleString()}`}>
                                  ⏳ {fmtRemaining(eligibleAtMs(w) - now)}
                                </Hold>
                              ) : (
                                <Clear>✓ clear</Clear>
                              )
                            ) : (
                              <Dim>—</Dim>
                            )}
                          </td>
                          <td>
                            <ActionCell>
                              {!liveActions ? (
                                <Dim title="Withdrawals are OFF — actions are inert until launch.">—</Dim>
                              ) : (
                                <>
                                  {w.status === "requested" && (
                                    <ActBtn type="button" disabled={busy} onClick={() => runAction(w, "approve")}>
                                      Approve
                                    </ActBtn>
                                  )}
                                  {w.status === "approved" && !held && (
                                    <ActBtn $tone="go" type="button" disabled={busy} onClick={() => runAction(w, "markPaid")}>
                                      Mark paid
                                    </ActBtn>
                                  )}
                                  {w.status === "approved" && held && (
                                    <ActBtn $tone="warn" type="button" disabled={busy} onClick={() => runAction(w, "releaseNow")}
                                      title="Pay now, bypassing the fraud hold (trusted member)">
                                      Release now
                                    </ActBtn>
                                  )}
                                  {(w.status === "requested" || w.status === "approved") && (
                                    <>
                                      <ActBtn type="button" disabled={busy} onClick={() => runAction(w, "cancel")}>Cancel</ActBtn>
                                      <ActBtn $tone="warn" type="button" disabled={busy} onClick={() => runAction(w, "markFailed")}>Fail</ActBtn>
                                    </>
                                  )}
                                  {w.status !== "requested" && w.status !== "approved" && <Dim>—</Dim>}
                                </>
                              )}
                            </ActionCell>
                            {rowErr && <RowErr>{rowErr}</RowErr>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            )}

            <Note>
              &ldquo;Release now&rdquo; pays a withdrawal before its {holdHours > 0 ? `${holdHours}h ` : ""}fraud hold
              elapses — for a trusted member only. It is audited as an early release (visible in the Wallet Cash-Out
              activity timeline). Cancelling or failing a request during the hold reverses the member&apos;s debited
              cash — nothing leaves TGV.
            </Note>
          </Stack>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}

/* ── styles (mirror MemberWalletModal + the WalletControlModal queue) ──────── */
const Sub = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  letter-spacing: 0.04em;
  margin-top: 0.125rem;
`;
const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
`;
const GateBanner = styled.div<{ $live: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.7rem;
  border-radius: 0.5rem;
  border: 1px solid ${(p) => (p.$live ? "rgba(74, 222, 128, 0.4)" : `rgba(${rgb.pink}, 0.35)`)};
  background: ${(p) => (p.$live ? "rgba(74, 222, 128, 0.06)" : `rgba(${rgb.pink}, 0.06)`)};
`;
const LivePill = styled.span<{ $live: boolean }>`
  flex: 0 0 auto;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  color: ${(p) => (p.$live ? "#4ade80" : colors.pink)};
  border: 1px solid ${(p) => (p.$live ? "#4ade80" : colors.pink)};
  background: ${(p) => (p.$live ? "#4ade8019" : `rgba(${rgb.pink}, 0.1)`)};
`;
const GateText = styled.span`
  font-size: 0.72rem;
  color: var(--t-textFaint);
  line-height: 1.4;
`;
const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;
const Spacer = styled.div`
  flex: 1 1 auto;
`;
const LaneTabs = styled.div`
  display: flex;
  gap: 0.3rem;
`;
const LaneTab = styled.button<{ $active: boolean }>`
  padding: 0.2rem 0.7rem;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: 999px;
  cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.cyan}, 0.15)` : "transparent")};
  color: ${(p) => (p.$active ? colors.cyan : "var(--t-textFaint)")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.cyan}, 0.55)` : "var(--t-border)")};
`;
const ToggleBtn = styled.button<{ $on: boolean }>`
  padding: 0.3rem 0.65rem;
  font-size: 0.72rem;
  border-radius: 0.4rem;
  cursor: pointer;
  background: ${(p) => (p.$on ? `rgba(${rgb.gold}, 0.14)` : "rgba(0,0,0,0.3)")};
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.gold}, 0.5)` : "var(--t-border)")};
  color: ${(p) => (p.$on ? colors.gold : "var(--t-text)")};
  &:hover:not(:disabled) { filter: brightness(1.2); }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
`;
const Summary = styled.div`
  font-size: 0.78rem;
  color: var(--t-text);
`;
const Dim = styled.span`
  color: var(--t-textFaint);
  font-size: 0.72rem;
`;
const Empty = styled.div`
  font-size: 0.78rem;
  color: var(--t-textFaint);
  padding: 1rem 0;
`;
const Note = styled.div`
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--t-textFaint);
`;
const ErrText = styled.div`
  font-size: 0.75rem;
  color: ${colors.pink};
`;
const RowErr = styled.div`
  font-size: 0.68rem;
  color: ${colors.pink};
  margin-top: 0.25rem;
`;
const TableWrap = styled.div`
  max-height: 26rem;
  overflow: auto;
`;
const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
  th,
  td {
    padding: 0.45rem 0.55rem;
    text-align: left;
    border-bottom: 1px solid rgba(${rgb.gold}, 0.1);
    white-space: nowrap;
    vertical-align: top;
  }
  th {
    color: ${colors.gold};
    font-weight: 600;
    position: sticky;
    top: 0;
    background: #14110a;
  }
  tr:hover td {
    background: rgba(${rgb.gold}, 0.04);
  }
`;
const Mono = styled.span`
  font-family: var(--font-geist-mono), monospace;
  color: ${colors.cyan};
`;
const Pill = styled.span<{ $color: string }>`
  display: inline-block;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.68rem;
  border: 1px solid ${(p) => p.$color};
  color: ${(p) => p.$color};
  background: ${(p) => p.$color}1a;
`;
const EnvPill = styled.span<{ $live: boolean }>`
  display: inline-block;
  padding: 0.05rem 0.4rem;
  border-radius: 0.3rem;
  font-size: 0.64rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border: 1px solid ${(p) => (p.$live ? `rgba(${rgb.gold}, 0.5)` : "var(--t-border)")};
  color: ${(p) => (p.$live ? colors.gold : "var(--t-textFaint)")};
`;
const Hold = styled.span`
  color: ${colors.gold};
  font-size: 0.72rem;
  font-weight: 600;
`;
const Clear = styled.span`
  color: #4ade80;
  font-size: 0.72rem;
`;
const ActionCell = styled.div`
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
`;
const ActBtn = styled.button<{ $tone?: "go" | "warn" }>`
  padding: 0.2rem 0.45rem;
  font-size: 0.68rem;
  border-radius: 0.3rem;
  cursor: pointer;
  white-space: nowrap;
  background: ${(p) =>
    p.$tone === "warn" ? `rgba(${rgb.pink}, 0.1)` : p.$tone === "go" ? "#4ade8019" : "rgba(0,0,0,0.3)"};
  border: 1px solid ${(p) =>
    p.$tone === "warn" ? `rgba(${rgb.pink}, 0.5)` : p.$tone === "go" ? "#4ade80" : "var(--t-border)"};
  color: ${(p) => (p.$tone === "warn" ? colors.pink : p.$tone === "go" ? "#4ade80" : "var(--t-text)")};
  &:hover:not(:disabled) { filter: brightness(1.25); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

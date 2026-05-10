"use client";

// UfwGlobalView — RCS-wide UFW rule list, embedded inside every
// HardeningControlModal. Operators see the FULL rule set so they
// can spot misconfigurations elsewhere (an unexpectedly-open port,
// a forgotten allow-rule) while looking at any hardening surface.
//
// Each modal can pass `highlightFn` to visually elevate the rules it
// owns (telephony highlights anything matching 5060/5080 or Telnyx
// SBC ranges; future modals do similar for their ports).

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";

type UfwRule = {
  index: number;
  to: string;
  action: string;
  direction: string;
  from: string;
  comment: string | null;
};

type UfwSnapshot = {
  active: boolean;
  defaultIncoming: string;
  defaultOutgoing: string;
  defaultRouted: string;
  rules: UfwRule[];
};

const Wrap = styled.div`
  display: flex; flex-direction: column; gap: 0.5rem;
`;

const Header = styled.div`
  display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;
  font-size: 0.6875rem;
  font-family: var(--font-geist-mono), monospace;
  color: var(--t-textFaint);
`;

const Pill = styled.span<{ $tone: "ok" | "warn" | "muted" }>`
  display: inline-flex; align-items: center;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  font-size: 0.625rem;
  border: 1px solid ${p =>
    p.$tone === "ok" ? `rgba(${rgb.cyan}, 0.5)` :
    p.$tone === "warn" ? `rgba(${rgb.pink}, 0.5)` :
    "var(--t-border)"};
  color: ${p =>
    p.$tone === "ok" ? colors.cyan :
    p.$tone === "warn" ? colors.pink :
    "var(--t-textFaint)"};
  background: ${p =>
    p.$tone === "ok" ? `rgba(${rgb.cyan}, 0.08)` :
    p.$tone === "warn" ? `rgba(${rgb.pink}, 0.08)` :
    "transparent"};
`;

const Table = styled.div`
  display: grid;
  grid-template-columns: 2.25rem 5rem 4rem 1fr 1.25fr 1.5rem;
  gap: 0;
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
  overflow: hidden;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.6875rem;

  & > div {
    padding: 0.3rem 0.5rem;
    border-bottom: 1px solid var(--t-border);
  }
  & > div:nth-last-child(-n+6) { border-bottom: none; }
`;

const Th = styled.div`
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${colors.gold};
  background: rgba(${rgb.gold}, 0.05);
  font-size: 0.625rem;
`;

const Cell = styled.div<{ $highlight?: boolean; $tone?: "allow" | "deny" }>`
  background: ${p => p.$highlight ? `rgba(${rgb.gold}, 0.08)` : "transparent"};
  color: ${p =>
    p.$tone === "allow" ? colors.cyan :
    p.$tone === "deny" ? colors.pink :
    "var(--t-text)"};
  word-break: break-word;
`;

const DelBtn = styled.button`
  cursor: pointer; border: 0; background: transparent;
  color: ${colors.pink}; font-size: 0.875rem;
  &:hover { opacity: 0.7; }
  &:disabled { opacity: 0.3; cursor: not-allowed; }
`;

const Empty = styled.div`
  font-size: 0.6875rem; color: var(--t-textFaint); font-style: italic;
`;

const ErrorText = styled.div`
  font-size: 0.6875rem; color: ${colors.pink};
  font-family: var(--font-geist-mono), monospace;
`;

export type UfwGlobalViewProps = {
  /** Returns true when the rule belongs to the calling hardening surface — visually elevated. */
  highlightFn?: (rule: UfwRule) => boolean;
};

export default function UfwGlobalView({ highlightFn }: UfwGlobalViewProps) {
  const [snap, setSnap] = useState<UfwSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/admin/system/ufw", {
        credentials: "same-origin", cache: "no-store",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? `HTTP ${res.status}`); setSnap(null);
        return;
      }
      const data = (await res.json()) as UfwSnapshot;
      setSnap(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const deleteRule = useCallback(async (index: number) => {
    if (!window.confirm(`Delete UFW rule [${index}]? This is irreversible — confirm only if you understand the rule.`)) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/admin/system/ufw", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", index }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? `HTTP ${res.status}`);
        return;
      }
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return (
    <Wrap>
      {error && <ErrorText>ufw: {error}</ErrorText>}
      {snap === null && <Empty>Loading firewall rules…</Empty>}
      {snap && (
        <>
          <Header>
            <Pill $tone={snap.active ? "ok" : "warn"}>
              UFW {snap.active ? "active" : "INACTIVE"}
            </Pill>
            <span>defaults: in {snap.defaultIncoming} · out {snap.defaultOutgoing} · routed {snap.defaultRouted}</span>
          </Header>
          <Table>
            <Th>#</Th>
            <Th>To</Th>
            <Th>Action</Th>
            <Th>From</Th>
            <Th>Comment</Th>
            <Th></Th>
            {snap.rules.map(r => {
              const highlight = highlightFn ? highlightFn(r) : false;
              const tone: "allow" | "deny" | undefined =
                r.action === "ALLOW" ? "allow" :
                r.action === "DENY" || r.action === "REJECT" ? "deny" :
                undefined;
              return (
                <div key={r.index} style={{ display: "contents" }}>
                  <Cell $highlight={highlight}>{r.index}</Cell>
                  <Cell $highlight={highlight}>{r.to}</Cell>
                  <Cell $highlight={highlight} $tone={tone}>
                    {r.action} {r.direction}
                  </Cell>
                  <Cell $highlight={highlight}>{r.from}</Cell>
                  <Cell $highlight={highlight}>{r.comment ?? ""}</Cell>
                  <Cell $highlight={highlight}>
                    <DelBtn
                      type="button"
                      title={`Delete rule ${r.index}`}
                      disabled={busy}
                      onClick={() => deleteRule(r.index)}
                    >×</DelBtn>
                  </Cell>
                </div>
              );
            })}
          </Table>
        </>
      )}
    </Wrap>
  );
}

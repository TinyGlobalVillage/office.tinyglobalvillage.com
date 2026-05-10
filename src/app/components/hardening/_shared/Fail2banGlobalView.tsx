"use client";

// Fail2banGlobalView — RCS-wide jail snapshot, embedded inside every
// HardeningControlModal. Each hardening modal can pass `highlightJail`
// to visually elevate its own jail (e.g. telephony highlights
// "freeswitch-toll-fraud", a future postgres modal would highlight
// "postgresql"). The full jail list always renders so operators see
// whole-box posture.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";

type JailSummary = {
  name: string;
  filter: string | null;
  fileList: string[];
  currentlyFailed: number;
  totalFailed: number;
  currentlyBanned: number;
  totalBanned: number;
  bannedIps: string[];
};

const Wrap = styled.div`
  display: flex; flex-direction: column; gap: 0.625rem;
`;

const JailCard = styled.div<{ $highlight: boolean }>`
  border: 1px solid ${p => p.$highlight ? `rgba(${rgb.gold}, 0.6)` : "var(--t-border)"};
  background: ${p => p.$highlight ? `rgba(${rgb.gold}, 0.06)` : "rgba(0,0,0,0.15)"};
  border-radius: 0.5rem;
  padding: 0.625rem 0.75rem;
  display: flex; flex-direction: column; gap: 0.4rem;
`;

const JailName = styled.div<{ $highlight: boolean }>`
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.8125rem;
  font-weight: 700;
  color: ${p => p.$highlight ? colors.gold : "var(--t-text)"};
  display: flex; align-items: center; gap: 0.4rem;
`;

const JailMeta = styled.div`
  font-size: 0.6875rem;
  color: var(--t-textFaint);
  font-family: var(--font-geist-mono), monospace;
`;

const BannedList = styled.div`
  display: flex; flex-wrap: wrap; gap: 0.25rem;
  margin-top: 0.25rem;
`;

const BannedChip = styled.span`
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.15rem 0.4rem 0.15rem 0.5rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.6875rem;
  background: rgba(${rgb.pink}, 0.08);
  border: 1px solid rgba(${rgb.pink}, 0.35);
  color: ${colors.pink};
  border-radius: 999px;
`;

const Unban = styled.button`
  cursor: pointer;
  border: 0; background: transparent;
  color: inherit;
  font-size: 0.6875rem;
  &:hover { opacity: 0.7; }
`;

const ManualBan = styled.div`
  display: flex; gap: 0.4rem; align-items: center;
  margin-top: 0.4rem;
`;

const Input = styled.input`
  flex: 1;
  padding: 0.3rem 0.5rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.75rem;
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--t-border);
  border-radius: 0.375rem;
  color: var(--t-text);
  &:focus { outline: none; border-color: rgba(${rgb.gold}, 0.5); }
`;

const Btn = styled.button`
  padding: 0.3rem 0.6rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  border-radius: 0.375rem;
  background: rgba(${rgb.pink}, 0.1);
  color: ${colors.pink};
  border: 1px solid rgba(${rgb.pink}, 0.45);
  &:hover:not(:disabled) { background: rgba(${rgb.pink}, 0.2); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Empty = styled.div`
  font-size: 0.6875rem; color: var(--t-textFaint); font-style: italic;
`;

const ErrorText = styled.div`
  font-size: 0.6875rem; color: ${colors.pink};
  font-family: var(--font-geist-mono), monospace;
`;

export type Fail2banGlobalViewProps = {
  highlightJail?: string;
};

export default function Fail2banGlobalView({ highlightJail }: Fail2banGlobalViewProps) {
  const [jails, setJails] = useState<JailSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualIp, setManualIp] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/admin/system/fail2ban", {
        credentials: "same-origin", cache: "no-store",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? `HTTP ${res.status}`); setJails([]);
        return;
      }
      const data = await res.json();
      setJails(data.jails);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const act = useCallback(async (jail: string, ip: string, action: "ban" | "unban") => {
    if (!ip) return;
    if (action === "ban" && !window.confirm(`Permaban ${ip} in jail ${jail}?`)) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/admin/system/fail2ban/ban", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jail, ip, action }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? `HTTP ${res.status}`);
        return;
      }
      await refresh();
      setManualIp(prev => ({ ...prev, [jail]: "" }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return (
    <Wrap>
      {error && <ErrorText>fail2ban: {error}</ErrorText>}
      {jails === null && <Empty>Loading jails…</Empty>}
      {jails && jails.length === 0 && <Empty>No fail2ban jails configured.</Empty>}
      {jails?.map(j => {
        const highlight = j.name === highlightJail;
        return (
          <JailCard key={j.name} $highlight={highlight}>
            <JailName $highlight={highlight}>
              {j.name}
              {highlight && <span style={{ fontSize: "0.6rem", opacity: 0.7 }}>(this hardening)</span>}
            </JailName>
            <JailMeta>
              filter: {j.filter ?? "?"} · banned now: {j.currentlyBanned} · banned ever: {j.totalBanned} · failed now: {j.currentlyFailed}
            </JailMeta>
            {j.bannedIps.length > 0 && (
              <BannedList>
                {j.bannedIps.map(ip => (
                  <BannedChip key={ip}>
                    {ip}
                    <Unban
                      type="button"
                      title={`Unban ${ip}`}
                      onClick={() => act(j.name, ip, "unban")}
                      disabled={busy}
                    >×</Unban>
                  </BannedChip>
                ))}
              </BannedList>
            )}
            <ManualBan>
              <Input
                placeholder="Manual ban: IPv4/IPv6 address"
                value={manualIp[j.name] ?? ""}
                onChange={e => setManualIp(prev => ({ ...prev, [j.name]: e.target.value }))}
                disabled={busy}
              />
              <Btn
                type="button"
                disabled={busy || !(manualIp[j.name] ?? "").trim()}
                onClick={() => act(j.name, (manualIp[j.name] ?? "").trim(), "ban")}
              >Ban</Btn>
            </ManualBan>
          </JailCard>
        );
      })}
    </Wrap>
  );
}

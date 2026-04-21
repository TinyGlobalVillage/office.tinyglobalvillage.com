"use client";

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import type { Alert } from "@/lib/frontdesk/types";
import AnnouncementsPanel from "../AnnouncementsPanel";
import { TrashIcon } from "../icons";

// ── Styled ───────────────────────────────────────────────────────

const Wrap = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem;
`;

const SectionHead = styled.div`
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: ${colors.gold};
  text-shadow: 0 0 6px rgba(${rgb.gold}, 0.45);
  margin: 0 0 0.5rem;
  [data-theme="light"] & { text-shadow: none; }
`;

const Divider = styled.div`
  height: 1px;
  margin: 1.5rem 0;
  background: rgba(${rgb.gold}, 0.18);
`;

const AlertList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const AlertRow = styled.li<{ $unread: boolean }>`
  padding: 0.6rem 0.75rem;
  border-radius: 0.5rem;
  background: ${(p) => (p.$unread ? `rgba(${rgb.gold}, 0.08)` : "rgba(255,255,255,0.02)")};
  border: 1px solid ${(p) => (p.$unread ? `rgba(${rgb.gold}, 0.3)` : "var(--t-border)")};
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.25rem 0.5rem;
`;

const AlertSubject = styled.div`
  font-weight: 700;
  color: var(--t-textBase);
`;

const AlertMeta = styled.div`
  font-size: 0.6875rem;
  color: var(--t-textGhost);
  font-family: var(--font-geist-mono), monospace;
  white-space: nowrap;
`;

const AlertBody = styled.div`
  grid-column: 1 / -1;
  font-size: 0.8125rem;
  color: var(--t-textGhost);
  white-space: pre-wrap;
`;

const AlertFooter = styled.div`
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: var(--t-textFaint);
`;

const RowBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: 1px solid var(--t-border);
  border-radius: 0.3rem;
  color: var(--t-textFaint);
  font-size: 0.6875rem;
  cursor: pointer;
  &:hover { color: ${colors.pink}; border-color: rgba(${rgb.pink}, 0.45); }
  svg { width: 10px; height: 10px; }
`;

const Empty = styled.div`
  text-align: center;
  padding: 1rem 0;
  color: var(--t-textGhost);
  font-size: 0.8125rem;
`;

// ── Component ────────────────────────────────────────────────────

export default function AlertsTab() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/frontdesk/alerts");
      if (!res.ok) return;
      const j = await res.json();
      setAlerts(j.alerts ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  const archive = async (id: string) => {
    await fetch(`/api/frontdesk/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archive: true }),
    });
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  return (
    <Wrap>
      <SectionHead>Inbound inquiries</SectionHead>
      {alerts.length === 0 ? (
        <Empty>No new inquiries.</Empty>
      ) : (
        <AlertList>
          {alerts.map(a => (
            <AlertRow key={a.id} $unread={a.readBy.length === 0}>
              <AlertSubject>{a.subject}</AlertSubject>
              <AlertMeta>{new Date(a.createdAt).toLocaleString()}</AlertMeta>
              <AlertBody>{a.body}</AlertBody>
              <AlertFooter>
                <span>
                  {a.fromName && <>From <strong>{a.fromName}</strong> · </>}
                  {a.fromEmail && <>{a.fromEmail} · </>}
                  {a.fromPhone && <>{a.fromPhone}</>}
                </span>
                <RowBtn onClick={() => archive(a.id)} title="Archive">
                  <TrashIcon size={10} /> Archive
                </RowBtn>
              </AlertFooter>
            </AlertRow>
          ))}
        </AlertList>
      )}

      <Divider />

      <SectionHead>System announcements</SectionHead>
      <AnnouncementsPanel />
    </Wrap>
  );
}

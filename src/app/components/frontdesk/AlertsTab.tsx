"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import type { Alert } from "@/lib/frontdesk/types";
import type { PersonalAlert } from "@tgv/module-calendar/alerts/types";
import AnnouncementsPanel from "../AnnouncementsPanel";
import { TrashIcon, EventIcon, SettingsIcon } from "../icons";
import { askConfirm } from "../dialogService";
import AlertsCalendarModal from "./AlertsCalendarModal";
import AlertSettingsModal from "./AlertSettingsModal";

// ── Styled ───────────────────────────────────────────────────────

const Wrap = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable both-edges;
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


const SelectBtn = styled.button<{ $danger?: boolean }>`
  background: transparent;
  border: 1px solid ${(p) => (p.$danger ? `rgba(${rgb.pink}, 0.4)` : `rgba(${rgb.gold}, 0.35)`)};
  color: ${(p) => (p.$danger ? colors.pink : colors.gold)};
  padding: 0.2rem 0.55rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 0.35rem;
  cursor: pointer;
  &:hover:not(:disabled) { background: ${(p) => (p.$danger ? `rgba(${rgb.pink}, 0.14)` : `rgba(${rgb.gold}, 0.12)`)}; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const Empty = styled.div`
  text-align: center;
  padding: 1rem 0;
  color: var(--t-textGhost);
  font-size: 0.8125rem;
`;

const SchedRow = styled.li`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.25rem 0.5rem;
  padding: 0.5rem 0.7rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(${rgb.gold}, 0.2);
  background: rgba(${rgb.gold}, 0.05);
  cursor: pointer;
  &:hover { border-color: rgba(${rgb.gold}, 0.4); background: rgba(${rgb.gold}, 0.1); }
`;

const SchedTitle = styled.div`
  font-weight: 600;
  color: var(--t-textBase);
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const SrcTag = styled.span<{ $manual: boolean }>`
  font-size: 0.5625rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 0.35rem;
  color: ${(p) => (p.$manual ? colors.gold : colors.pink)};
  border: 1px solid ${(p) => (p.$manual ? `rgba(${rgb.gold}, 0.4)` : `rgba(${rgb.pink}, 0.4)`)};
`;

// 3-column range pillbar for the inline scheduled-alerts peek.
const RangeBar = styled.div`
  display: inline-flex;
  border: 1px solid rgba(${rgb.gold}, 0.35);
  border-radius: 0.35rem;
  overflow: hidden;
`;

const RangeSeg = styled.button<{ $active: boolean }>`
  padding: 0.2rem 0.55rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  cursor: pointer;
  border: none;
  color: ${(p) => (p.$active ? "#0b0b0b" : colors.gold)};
  background: ${(p) => (p.$active ? colors.gold : "transparent")};
  & + & { border-left: 1px solid rgba(${rgb.gold}, 0.25); }
  &:hover:not(:disabled) { background: ${(p) => (p.$active ? colors.gold : `rgba(${rgb.gold}, 0.14)`)}; }
`;

type SchedRange = "today" | "30d" | "12mo";
const RANGES: { key: SchedRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "30d", label: "30 Days" },
  { key: "12mo", label: "12 Months" },
];

// Upper bound (ISO) of a range, measured from now. Alerts with trigger_at
// between now and this bound show in that range.
function rangeEndIso(range: SchedRange): string {
  const d = new Date();
  if (range === "today") d.setHours(23, 59, 59, 999);
  else if (range === "30d") d.setDate(d.getDate() + 30);
  else d.setMonth(d.getMonth() + 12);
  return d.toISOString();
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// ── Component ────────────────────────────────────────────────────

export default function AlertsTab() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sched, setSched] = useState<PersonalAlert[]>([]);
  const [range, setRange] = useState<SchedRange>("30d");
  const [calOpen, setCalOpen] = useState(false);
  const [calCreate, setCalCreate] = useState(false);
  const [viewAlert, setViewAlert] = useState<PersonalAlert | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/frontdesk/alerts");
      if (!res.ok) return;
      const j = await res.json();
      setAlerts(j.alerts ?? []);
    } catch { /* ignore */ }
  }, []);

  // Upcoming team-scheduled alerts (System C) for the inline peek. Keep ALL
  // future non-dismissed alerts; the range pillbar narrows what's shown.
  const loadSched = useCallback(async () => {
    try {
      const res = await fetch("/api/frontdesk/team-alerts");
      if (!res.ok) return;
      const rows: PersonalAlert[] = await res.json();
      const nowIso = new Date().toISOString();
      setSched(
        rows
          .filter((r) => r.status !== "dismissed" && r.trigger_at >= nowIso)
          .sort((a, b) => a.trigger_at.localeCompare(b.trigger_at))
      );
    } catch { /* ignore */ }
  }, []);

  // Narrow the peek to the selected range (Today / 30 days / 12 months). The
  // far-future Hetzner migration alert (2027) only appears under "12 Months".
  const visibleSched = useMemo(() => {
    const endIso = rangeEndIso(range);
    return sched.filter((a) => a.trigger_at <= endIso);
  }, [sched, range]);

  useEffect(() => {
    load();
    loadSched();
    const id = setInterval(() => { load(); loadSched(); }, 20_000);
    return () => clearInterval(id);
  }, [load, loadSched]);

  const archive = async (id: string) => {
    await fetch(`/api/frontdesk/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archive: true }),
    });
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const batchDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!(await askConfirm({
      title: "Delete inquiries?",
      message: `Delete ${ids.length} inquir${ids.length === 1 ? "y" : "ies"}?`,
      detail: "This cannot be undone (archive keeps them recoverable instead).",
      confirmLabel: `Delete ${ids.length}`,
    }))) return;
    for (const id of ids) {
      await fetch(`/api/frontdesk/alerts/${id}`, { method: "DELETE" });
    }
    setSelected(new Set());
    setSelectMode(false);
    load();
  };

  return (
    <Wrap>
      <SectionHead style={{ textAlign: "center" }}>Scheduled alerts</SectionHead>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
        <RangeBar>
          {RANGES.map((r) => (
            <RangeSeg key={r.key} $active={range === r.key} onClick={() => setRange(r.key)}>
              {r.label}
            </RangeSeg>
          ))}
        </RangeBar>
        <SelectBtn
          onClick={() => { setViewAlert(null); setCalCreate(false); setCalOpen(true); }}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
        >
          <EventIcon size={11} /> Calendar
        </SelectBtn>
        <SelectBtn onClick={() => { setViewAlert(null); setCalCreate(true); setCalOpen(true); }}>＋ Add</SelectBtn>
        <SelectBtn
          onClick={() => setSettingsOpen(true)}
          title="Alert preferences"
          aria-label="Alert preferences"
          style={{ display: "inline-flex", alignItems: "center" }}
        >
          <SettingsIcon size={12} />
        </SelectBtn>
      </div>
      {visibleSched.length === 0 ? (
        <Empty style={{ padding: "0.5rem 0" }}>
          No alerts {range === "today" ? "today" : range === "30d" ? "in the next 30 days" : "in the next 12 months"}.
        </Empty>
      ) : (
        <AlertList style={{ marginTop: "0.5rem" }}>
          {visibleSched.map((a) => (
            <SchedRow
              key={a.id}
              onClick={() => { setViewAlert(a); setCalCreate(false); setCalOpen(true); }}
              title="Open & edit this alert"
            >
              <SchedTitle>
                {a.title}
                {a.source !== "manual" && <SrcTag $manual={false}>{a.source}</SrcTag>}
              </SchedTitle>
              <AlertMeta>{fmtWhen(a.trigger_at)}</AlertMeta>
            </SchedRow>
          ))}
        </AlertList>
      )}

      <Divider />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
        <SectionHead>Inbound inquiries</SectionHead>
        {alerts.length > 0 && (
          <div style={{ display: "flex", gap: "0.4rem" }}>
            {selectMode ? (
              <>
                <SelectBtn onClick={() => setSelected(new Set(alerts.map((a) => a.id)))}>All</SelectBtn>
                <SelectBtn onClick={() => { setSelectMode(false); setSelected(new Set()); }}>Cancel</SelectBtn>
                <SelectBtn $danger disabled={selected.size === 0} onClick={batchDelete}>
                  Delete ({selected.size})
                </SelectBtn>
              </>
            ) : (
              <SelectBtn onClick={() => setSelectMode(true)}>Select</SelectBtn>
            )}
          </div>
        )}
      </div>
      {alerts.length === 0 ? (
        <Empty>No new inquiries.</Empty>
      ) : (
        <AlertList>
          {alerts.map(a => (
            <AlertRow
              key={a.id}
              $unread={a.readBy.length === 0}
              onClick={selectMode ? () => toggleSel(a.id) : undefined}
              style={selectMode ? { cursor: "pointer" } : undefined}
            >
              <AlertSubject>
                {selectMode && (
                  <input type="checkbox" checked={selected.has(a.id)} readOnly style={{ accentColor: colors.pink, marginRight: "0.5rem" }} />
                )}
                {a.subject}
              </AlertSubject>
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

      <AlertsCalendarModal
        open={calOpen}
        startInCreate={calCreate}
        viewAlert={viewAlert}
        onClose={() => { setCalOpen(false); setViewAlert(null); loadSched(); }}
      />
      <AlertSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Wrap>
  );
}

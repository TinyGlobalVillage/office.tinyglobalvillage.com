"use client";

// AuditLogTimeline — generic chronological-feed component for any
// HardeningControlModal. The consumer passes `endpoint` (which must
// return `{ rows: TimelineRow[] }`) and an optional kind→label map for
// pretty-printing.

import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";

export type TimelineRow = {
  id: string;
  ts: string;
  kind: string;
  label: string;
  detail: string | null;
  ip: string | null;
  by: string | null;
  outcome: string;
};

const Wrap = styled.div`
  display: flex; flex-direction: column; gap: 0.4rem;
  max-height: 14rem; overflow-y: auto;
  padding-right: 0.25rem;
`;

const Row = styled.div<{ $tone: "ok" | "warn" | "neutral" }>`
  display: grid;
  grid-template-columns: 7rem 1fr;
  gap: 0.625rem;
  align-items: start;
  padding: 0.4rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  background: ${p =>
    p.$tone === "warn" ? `rgba(${rgb.pink}, 0.05)` :
    p.$tone === "ok" ? `rgba(${rgb.cyan}, 0.04)` :
    "rgba(0,0,0,0.15)"};
  border: 1px solid ${p =>
    p.$tone === "warn" ? `rgba(${rgb.pink}, 0.25)` :
    p.$tone === "ok" ? `rgba(${rgb.cyan}, 0.2)` :
    "var(--t-border)"};
`;

const Ts = styled.span`
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.6875rem;
  color: var(--t-textFaint);
`;

const Body = styled.div`
  display: flex; flex-direction: column; gap: 0.15rem;
  word-break: break-word;
`;

const Label = styled.div<{ $tone: "ok" | "warn" | "neutral" }>`
  font-weight: 700;
  font-size: 0.75rem;
  text-transform: capitalize;
  color: ${p =>
    p.$tone === "warn" ? colors.pink :
    p.$tone === "ok" ? colors.cyan :
    "var(--t-text)"};
`;

const Meta = styled.div`
  font-size: 0.6875rem;
  font-family: var(--font-geist-mono), monospace;
  color: var(--t-textFaint);
`;

const Detail = styled.div`
  font-size: 0.6875rem;
  font-family: var(--font-geist-mono), monospace;
  color: var(--t-textFaint);
  opacity: 0.85;
`;

const Filters = styled.div`
  display: flex; gap: 0.4rem; flex-wrap: wrap;
  margin-bottom: 0.25rem;
`;

const FilterBtn = styled.button<{ $active: boolean }>`
  padding: 0.25rem 0.55rem;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  border-radius: 999px;
  background: ${p => p.$active ? `rgba(${rgb.gold}, 0.15)` : "transparent"};
  color: ${p => p.$active ? colors.gold : "var(--t-textFaint)"};
  border: 1px solid ${p => p.$active ? `rgba(${rgb.gold}, 0.55)` : "var(--t-border)"};
  &:hover { color: ${colors.gold}; border-color: rgba(${rgb.gold}, 0.55); }
`;

const Empty = styled.div`
  font-size: 0.75rem; color: var(--t-textFaint); font-style: italic;
  text-align: center; padding: 0.75rem;
`;

const ErrorText = styled.div`
  font-size: 0.6875rem; color: ${colors.pink};
  font-family: var(--font-geist-mono), monospace;
`;

function fmtTs(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function tone(outcome: string): "ok" | "warn" | "neutral" {
  if (outcome === "warn") return "warn"; // explicit warn (e.g. killswitch engaged, withdrawal released)
  if (/fail|reject|ban|spike|attempt/i.test(outcome)) return "warn";
  if (outcome === "ok") return "ok";
  return "neutral";
}

export type AuditLogTimelineProps = {
  endpoint: string;
  /** Filter controls: a list of `kind` values to expose as toggles. */
  kinds?: string[];
};

export default function AuditLogTimeline({ endpoint, kinds }: AuditLogTimelineProps) {
  const [rows, setRows] = useState<TimelineRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<string | "all">("all");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(endpoint, {
        credentials: "same-origin", cache: "no-store",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? `HTTP ${res.status}`); setRows([]);
        return;
      }
      const data = await res.json();
      setRows(data.rows ?? []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [endpoint]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return activeKind === "all" ? rows : rows.filter(r => r.kind === activeKind);
  }, [rows, activeKind]);

  return (
    <div>
      {kinds && kinds.length > 0 && (
        <Filters>
          <FilterBtn type="button" $active={activeKind === "all"} onClick={() => setActiveKind("all")}>All</FilterBtn>
          {kinds.map(k => (
            <FilterBtn
              key={k}
              type="button"
              $active={activeKind === k}
              onClick={() => setActiveKind(k)}
            >{k}</FilterBtn>
          ))}
        </Filters>
      )}
      {error && <ErrorText>audit-log: {error}</ErrorText>}
      <Wrap>
        {rows === null && <Empty>Loading…</Empty>}
        {rows && filtered.length === 0 && <Empty>No events recorded yet.</Empty>}
        {filtered.map(r => {
          const t = tone(r.outcome);
          return (
            <Row key={r.id} $tone={t}>
              <Ts>{fmtTs(r.ts)}</Ts>
              <Body>
                <Label $tone={t}>{r.label}</Label>
                <Meta>
                  {r.kind} · {r.outcome}
                  {r.ip ? ` · ${r.ip}` : ""}
                  {r.by ? ` · by ${r.by}` : ""}
                </Meta>
                {r.detail && <Detail>{r.detail}</Detail>}
              </Body>
            </Row>
          );
        })}
      </Wrap>
    </div>
  );
}

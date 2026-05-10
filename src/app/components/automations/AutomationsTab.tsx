"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import { rgb } from "../../theme";

interface Automation {
  id: string;
  title: string;
  category: string;
  enabled: boolean;
  schedule?: string;
  threshold?: number;
  thresholdUsd?: number;
  leadDays?: number;
  maxAttempts?: number;
  recipients: string[];
  readMeId?: string;
  trigger?: string;
  lastRun?: string | null;
  lastFired?: string | null;
}

const Wrap = styled.div`
  padding: 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.85rem 1rem;
  border: 1px solid var(--t-border);
  border-radius: 8px;
  background: var(--t-surface);
`;

const Title = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const Subtle = styled.span`
  font-size: 0.78rem;
  color: var(--t-textMuted);
`;

const Toggle = styled.button<{ $on: boolean }>`
  width: 42px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid var(--t-border);
  background: ${(p) => (p.$on ? `rgb(${rgb.cyan})` : "var(--t-inputBg)")};
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
  &::after {
    content: "";
    position: absolute;
    top: 2px;
    left: ${(p) => (p.$on ? "20px" : "2px")};
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: white;
    transition: left 120ms;
  }
`;

const TestBtn = styled.button`
  padding: 0.4rem 0.7rem;
  font-size: 0.78rem;
  border-radius: 6px;
  border: 1px solid var(--t-border);
  background: transparent;
  color: var(--t-text);
  cursor: pointer;
  &:hover {
    background: rgba(${rgb.cyan}, 0.08);
  }
`;

export default function AutomationsTab() {
  const [items, setItems] = useState<Automation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    const r = await fetch("/api/automations/config").then((x) => x.json());
    setItems(r.automations ?? []);
  };

  useEffect(() => {
    refresh();
  }, []);

  const toggle = async (a: Automation) => {
    setBusy(a.id);
    await fetch("/api/automations/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, patch: { enabled: !a.enabled } }),
    });
    await refresh();
    setBusy(null);
  };

  const test = async (a: Automation) => {
    setBusy(a.id);
    const r = await fetch("/api/automations/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, dryRun: true }),
    }).then((x) => x.json());
    setBusy(null);
    alert(`Test fired for ${a.id}: ${JSON.stringify(r, null, 2)}`);
  };

  const detail = (a: Automation) => {
    if (a.threshold !== undefined) return `threshold ${a.threshold}`;
    if (a.thresholdUsd !== undefined) return `$${a.thresholdUsd}`;
    if (a.leadDays !== undefined) return `${a.leadDays}d lead`;
    if (a.maxAttempts !== undefined) return `max ${a.maxAttempts} attempts`;
    return "—";
  };

  return (
    <Wrap>
      {items.map((a) => (
        <Row key={a.id}>
          <Title>
            <strong>{a.title}</strong>
            <Subtle>
              {a.category} · {a.schedule ?? "event-driven"} · {detail(a)} ·{" "}
              {a.recipients.length} recipient{a.recipients.length === 1 ? "" : "s"}
            </Subtle>
          </Title>
          <TestBtn onClick={() => test(a)} disabled={busy === a.id}>
            Test
          </TestBtn>
          <Toggle
            $on={a.enabled}
            disabled={busy === a.id}
            onClick={() => toggle(a)}
            aria-label={`Toggle ${a.title}`}
          />
        </Row>
      ))}
      {items.length === 0 && <Subtle>No automations configured.</Subtle>}
    </Wrap>
  );
}

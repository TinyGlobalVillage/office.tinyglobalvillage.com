"use client";

import { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import LogsModal, { type TabMode } from "./LogsModal";
import { colors, rgb, glowRgba } from "../theme";
import { CloseBtn, PillButton } from "../styled";

type ActivityEvent = {
  timeLabel: string;
  actor: string;
  event: string;
  type: "pm2" | "git" | "system";
};

const TYPE_COLOR: Record<string, string> = {
  pm2:    colors.gold,
  git:    colors.pink,
  system: colors.green,
};

const PAGE_OPTIONS = [5, 10, 25, 50] as const;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 65;
  background: var(--t-overlay);
  backdrop-filter: blur(4px);
`;

const Panel = styled.div<{ $fs: boolean }>`
  position: fixed;
  z-index: 66;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--t-surface);
  border: 1px solid ${glowRgba("cyan", 0.18)};
  box-shadow: 0 24px 80px rgba(0,0,0,0.85);
  transition: all 0.2s cubic-bezier(0.4,0,0.2,1);

  ${(p) => p.$fs
    ? `top:0;left:0;right:0;bottom:0;border-radius:0;`
    : `top:60px;left:4%;right:4%;bottom:4%;border-radius:20px;`}

  [data-theme="light"] & {
    border-color: ${glowRgba("cyan", 0.12)};
    box-shadow: 0 12px 40px rgba(0,0,0,0.1);
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  row-gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--t-border);
  flex-shrink: 0;
`;

const Title = styled.h2`
  font-size: 0.875rem;
  font-weight: 700;
  margin: 0 0.25rem 0 0;
  color: ${colors.cyan};
`;

const Spacer = styled.div`flex: 1;`;

const DropWrap = styled.div`position: relative;`;

const DropMenu = styled.div`
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 0.25rem;
  border-radius: 0.75rem;
  overflow: hidden;
  z-index: 10;
  min-width: 90px;
  background: var(--t-surface);
  border: 1px solid ${glowRgba("pink", 0.3)};
  box-shadow: 0 8px 32px rgba(0,0,0,0.7);

  [data-theme="light"] & {
    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  }
`;

const DropItem = styled.button<{ $active?: boolean }>`
  width: 100%;
  text-align: left;
  padding: 0.5rem 1rem;
  font-size: 0.6875rem;
  border: none;
  cursor: pointer;
  color: ${(p) => p.$active ? colors.pink : "var(--t-textMuted)"};
  background: transparent;
  transition: background 0.1s;

  &:hover { background: ${glowRgba("pink", 0.08)}; }
`;

const CustomInput = styled.input`
  width: 3.5rem;
  text-align: center;
  font-size: 0.6875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  outline: none;
  background: transparent;
  color: ${colors.pink};
  border: 1px solid ${glowRgba("pink", 0.35)};
`;

const PageBtn = styled.button`
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  border: 1px solid ${glowRgba("pink", 0.3)};
  background: ${glowRgba("pink", 0.1)};
  color: ${colors.pink};
  cursor: pointer;
  transition: opacity 0.15s;

  &:disabled { opacity: 0.25; cursor: default; }
`;

const PageInfo = styled.span`
  font-size: 0.625rem;
  color: var(--t-textGhost);
  font-variant-numeric: tabular-nums;
  width: 2.5rem;
  text-align: center;
`;

const ListBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1.25rem;
  scrollbar-width: thin;
`;

const Empty = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 8rem;
  font-size: 0.875rem;
  color: var(--t-textGhost);
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0;
  border-bottom: 1px solid var(--t-border);
`;

const TimeLabel = styled.span`
  font-size: 0.625rem;
  font-family: var(--font-geist-mono), monospace;
  color: var(--t-textGhost);
  width: 3rem;
  flex-shrink: 0;
  text-align: right;
`;

const TypeBadge = styled.span<{ $color: string }>`
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
  width: 2.5rem;
  color: ${(p) => p.$color};
`;

const EventText = styled.span`
  font-size: 0.75rem;
  color: var(--t-textMuted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export default function ActivityModal({ onClose }: { onClose: () => void }) {
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [perPage, setPerPage] = useState<number>(25);
  const [customPerPage, setCustomPerPage] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [page, setPage] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [logsTab, setLogsTab] = useState<TabMode | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/activity")
      .then((r) => r.json())
      .then((d) => { setActivity(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (fullscreen) { setFullscreen(false); return; }
        onClose();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose, fullscreen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const effectivePerPage = showCustom && parseInt(customPerPage) > 0
    ? parseInt(customPerPage) : perPage;
  const totalPages = Math.max(1, Math.ceil(activity.length / effectivePerPage));
  const pageItems = activity.slice(page * effectivePerPage, (page + 1) * effectivePerPage);

  return (
    <>
      {logsTab && <LogsModal onClose={() => setLogsTab(null)} initialTab={logsTab} />}
      <Backdrop onClick={onClose} />
      <Panel $fs={fullscreen}>
        <Header>
          <Title>Recent Activity</Title>
          {(["logs", "archive"] as TabMode[]).map((t) => (
            <PillButton key={t} $color="pink" onClick={() => setLogsTab(t)}>
              {t === "logs" ? "�� Logs" : "🗜 Archive"}
            </PillButton>
          ))}
          <Spacer />
          <DropWrap ref={dropRef}>
            <PillButton $color="pink" $active onClick={() => setShowDropdown((p) => !p)}>
              {showCustom && parseInt(customPerPage) > 0 ? customPerPage : effectivePerPage} / pg ▾
            </PillButton>
            {showDropdown && (
              <DropMenu>
                {PAGE_OPTIONS.map((n) => (
                  <DropItem
                    key={n}
                    $active={effectivePerPage === n && !showCustom}
                    onClick={() => { setPerPage(n); setShowCustom(false); setPage(0); setShowDropdown(false); }}
                  >{n}</DropItem>
                ))}
                <DropItem
                  $active={showCustom}
                  onClick={() => { setShowCustom(true); setShowDropdown(false); }}
                  style={{ borderTop: "1px solid var(--t-border)" }}
                >Custom…</DropItem>
              </DropMenu>
            )}
          </DropWrap>
          {showCustom && (
            <CustomInput
              type="number"
              value={customPerPage}
              onChange={(e) => { setCustomPerPage(e.target.value); setPage(0); }}
              placeholder="n"
              autoFocus
            />
          )}
          <PageBtn onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>←</PageBtn>
          <PageInfo>{page + 1} / {totalPages}</PageInfo>
          <PageBtn onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>→</PageBtn>
          <CloseBtn onClick={() => setFullscreen((p) => !p)} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {fullscreen ? "⊡" : "⊞"}
          </CloseBtn>
          <CloseBtn onClick={onClose} title="Close (Esc)">✕</CloseBtn>
        </Header>
        <ListBody>
          {loading ? <Empty>Loading…</Empty>
          : pageItems.length === 0 ? <Empty>No activity yet.</Empty>
          : pageItems.map((item, i) => (
            <Row key={i}>
              <TimeLabel>{item.timeLabel}</TimeLabel>
              <TypeBadge $color={TYPE_COLOR[item.type] ?? "var(--t-text)"}>{item.type}</TypeBadge>
              <EventText>{item.event}</EventText>
            </Row>
          ))}
        </ListBody>
      </Panel>
    </>
  );
}

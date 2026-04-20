"use client";

import { useState, useEffect, useCallback } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import {
  PanelBackdrop,
  Panel,
  PanelHeader,
  PanelIconBtn,
  PanelActionBtn,
  PanelEmptyState,
  PanelTitle,
  Spacer,
} from "@/app/styled";
import NeonX from "./NeonX";

type LiveDate = { date: string; bytes: number; archived: false };
type ArchiveDate = { date: string; bytes: number; archived: true; decompressed: boolean };
type AnyDate = LiveDate | ArchiveDate;

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export type TabMode = "logs" | "archive";

/* ── Local styled ──────────────────────────────────────────────── */

const TabPill = styled.button<{ $active?: boolean }>`
  padding: 0.25rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.15s;
  background: ${(p) => (p.$active ? `rgba(${rgb.pink}, 0.15)` : "transparent")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.pink}, 0.4)` : "var(--t-borderStrong)")};
  color: ${(p) => (p.$active ? colors.pink : "var(--t-textFaint)")};
`;

const SidebarWrap = styled.div`
  display: flex;
  flex-direction: column;
  width: 13rem;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 0.5rem 0;
  border-right: 1px solid var(--t-border);
  scrollbar-width: thin;
`;

const DateBtn = styled.button<{ $active?: boolean }>`
  display: flex;
  flex-direction: column;
  padding: 0.625rem 1rem;
  text-align: left;
  transition: all 0.15s;
  cursor: pointer;
  border: none;
  border-left: 2px solid ${(p) => (p.$active ? colors.pink : "transparent")};
  background: ${(p) => (p.$active ? `rgba(${rgb.pink}, 0.12)` : "transparent")};

  &:hover {
    background: ${(p) => (p.$active ? `rgba(${rgb.pink}, 0.12)` : "var(--t-inputBg)")};
  }
`;

const DateLabel = styled.span<{ $active?: boolean }>`
  font-size: 0.75rem;
  font-family: var(--font-geist-mono), monospace;
  font-weight: 700;
  color: ${(p) => (p.$active ? colors.pink : "var(--t-textMuted)")};
`;

const DateMeta = styled.span`
  font-size: 0.5625rem;
  color: var(--t-textGhost);
  margin-top: 0.125rem;
`;

const SidebarPager = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  margin-top: auto;
  border-top: 1px solid var(--t-border);
`;

const PagerBtn = styled.button`
  font-size: 0.5625rem;
  color: var(--t-textFaint);
  padding: 0 0.25rem;
  border: none;
  background: none;
  cursor: pointer;

  &:hover { color: var(--t-textMuted); }
  &:disabled { opacity: 0.3; cursor: not-allowed; }
`;

const PagerLabel = styled.span`
  font-size: 0.5625rem;
  color: var(--t-textGhost);
  flex: 1;
  text-align: center;
`;

const ViewerWrap = styled.div`
  flex: 1;
  overflow: hidden;
  padding: 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const ViewerControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  flex-shrink: 0;
`;

const InfoText = styled.span`
  font-size: 0.75rem;
  color: var(--t-textFaint);
`;

const LoadingText = styled.span`
  font-size: 0.625rem;
  color: ${colors.gold};
  opacity: 0.7;
`;

const NavBtn = styled.button`
  font-size: 0.625rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  color: var(--t-textFaint);
  border: 1px solid var(--t-borderStrong);
  background: none;
  cursor: pointer;

  &:hover { color: ${colors.cyan}; }
  &:disabled { opacity: 0.3; cursor: not-allowed; }
`;

const LogPane = styled.div`
  flex: 1;
  overflow-y: auto;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.6875rem;
  line-height: 1.55;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.5);
  min-height: 0;
  scrollbar-width: thin;

  [data-theme="light"] & {
    background: rgba(0, 0, 0, 0.03);
  }
`;

const LogLine = styled.div<{ $err?: boolean }>`
  color: ${(p) => (p.$err ? colors.red : "var(--t-textMuted)")};
`;

const CompressedWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 16rem;
  gap: 1rem;
`;

const CompressedIcon = styled.span`
  font-size: 1.875rem;
`;

const CompressedLabel = styled.p`
  font-size: 0.875rem;
  color: var(--t-textMuted);
`;

const DateTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--t-textMuted);
`;

const ArchiveBadge = styled.span`
  font-size: 0.5625rem;
  font-weight: 700;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  background: rgba(${rgb.gold}, 0.12);
  border: 1px solid rgba(${rgb.gold}, 0.3);
  color: ${colors.gold};
`;

const CountLabel = styled.span`
  font-size: 0.625rem;
  color: var(--t-textGhost);
`;

const BodySplit = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const EmptyCenter = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 0.75rem;
  color: var(--t-textGhost);
`;

/* ── LogViewer ─────────────────────────────────────────────────── */

function LogViewer({
  date,
  isArchive,
  decompressed,
  onDecompressRequest,
  onCloseArchive,
}: {
  date: string;
  isArchive: boolean;
  decompressed: boolean;
  onDecompressRequest: (date: string) => Promise<void>;
  onCloseArchive: (date: string) => Promise<void>;
}) {
  const [lines, setLines] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [decompressing, setDecompressing] = useState(false);
  const [isDecompressed, setIsDecompressed] = useState(decompressed);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const qs =
          isArchive && isDecompressed
            ? `date=${date}&page=${p}&tmp=1`
            : `date=${date}&page=${p}`;
        const res = await fetch(`/api/logs?${qs}`);
        if (res.ok) {
          const d = await res.json();
          setLines(d.lines ?? []);
          setTotal(d.total ?? 0);
          setTotalPages(d.totalPages ?? 1);
          setPage(d.page ?? 1);
        }
      } finally {
        setLoading(false);
      }
    },
    [date, isArchive, isDecompressed]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const handleDecompress = async () => {
    setDecompressing(true);
    await onDecompressRequest(date);
    setIsDecompressed(true);
    setDecompressing(false);
  };

  const handleClose = async () => {
    await onCloseArchive(date);
    setIsDecompressed(false);
    setLines([]);
  };

  if (isArchive && !isDecompressed) {
    return (
      <CompressedWrap>
        <CompressedIcon>🗜</CompressedIcon>
        <CompressedLabel>This log is compressed</CompressedLabel>
        <PanelActionBtn $color="cyan" onClick={handleDecompress} disabled={decompressing}>
          {decompressing ? "Decompressing…" : "🗃 Decompress to View"}
        </PanelActionBtn>
      </CompressedWrap>
    );
  }

  return (
    <>
      <ViewerControls>
        <InfoText>
          {total.toLocaleString()} lines · page {page}/{totalPages}
        </InfoText>
        {loading && <LoadingText>Loading…</LoadingText>}
        {isArchive && isDecompressed && (
          <PanelActionBtn $color="red" onClick={handleClose} style={{ marginLeft: "auto" }}>
            ✕ Close Preview
          </PanelActionBtn>
        )}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginLeft: "auto" }}>
            <NavBtn disabled={page >= totalPages} onClick={() => load(page + 1)}>
              ← Older
            </NavBtn>
            <NavBtn disabled={page <= 1} onClick={() => load(page - 1)}>
              Newer →
            </NavBtn>
          </div>
        )}
      </ViewerControls>
      <LogPane>
        {lines.length === 0 && !loading && (
          <span style={{ color: "var(--t-textGhost)" }}>No log entries for this date.</span>
        )}
        {lines.map((line, i) => {
          const isErr = line.includes("error") || line.includes("Error") || line.includes("✗");
          return (
            <LogLine key={i} $err={isErr}>
              {line}
            </LogLine>
          );
        })}
      </LogPane>
    </>
  );
}

/* ── Main ──────────────────────────────────────────────────────── */

export default function LogsModal({
  onClose,
  initialTab = "logs",
}: {
  onClose: () => void;
  initialTab?: TabMode;
}) {
  const [tab, setTab] = useState<TabMode>(initialTab);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [liveDates, setLiveDates] = useState<LiveDate[]>([]);
  const [archiveDates, setArchiveDates] = useState<ArchiveDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<AnyDate | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveResult, setArchiveResult] = useState<string | null>(null);
  const [livePage, setLivePage] = useState(0);
  const DATES_PER_PAGE = 30;

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch("/api/logs");
      if (res.ok) {
        const d = await res.json();
        setLiveDates(d.dates ?? []);
        setArchiveDates(d.archives ?? []);
      }
    } catch {
      /* skip */
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    const all = [...liveDates, ...archiveDates].sort((a, b) => b.date.localeCompare(a.date));
    if (all.length && !selectedDate) setSelectedDate(all[0]);
  }, [liveDates, archiveDates, selectedDate]);

  const handleArchive = async () => {
    setArchiving(true);
    setArchiveResult(null);
    try {
      const res = await fetch("/api/logs/archive", { method: "POST" });
      const d = await res.json();
      const n = d.archived?.length ?? 0;
      setArchiveResult(
        n === 0
          ? "No logs ready to archive (< 30 days old)."
          : `Archived ${n} log${n !== 1 ? "s" : ""}.`
      );
      await loadMeta();
    } finally {
      setArchiving(false);
    }
  };

  const handleDecompress = async (date: string) => {
    await fetch(`/api/logs/archive?decompress=${date}`, { method: "POST" });
    await loadMeta();
    setArchiveDates((prev) =>
      prev.map((d) => (d.date === date ? { ...d, decompressed: true } : d))
    );
  };

  const handleCloseArchive = async (date: string) => {
    await fetch(`/api/logs/archive?date=${date}`, { method: "DELETE" });
    setArchiveDates((prev) =>
      prev.map((d) => (d.date === date ? { ...d, decompressed: false } : d))
    );
  };

  const pagedLive = liveDates.slice(livePage * DATES_PER_PAGE, (livePage + 1) * DATES_PER_PAGE);
  const livePageTotal = Math.ceil(liveDates.length / DATES_PER_PAGE);
  const sidebarDates: AnyDate[] = tab === "logs" ? pagedLive : archiveDates;

  return (
    <>
      <PanelBackdrop onClick={onClose} />
      <Panel $accent="pink">
        <PanelHeader $accent="pink">
          <PanelTitle $color={colors.pink}>Activity Logs</PanelTitle>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            {(["logs", "archive"] as TabMode[]).map((t) => (
              <TabPill key={t} $active={tab === t} onClick={() => setTab(t)}>
                {t === "logs" ? "📋 Logs" : "🗜 Archive"}
              </TabPill>
            ))}
          </div>
          {tab === "archive" && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginLeft: "0.5rem" }}>
              <PanelActionBtn $color="gold" onClick={handleArchive} disabled={archiving}>
                {archiving ? "Archiving…" : "⚡ Archive Old Logs"}
              </PanelActionBtn>
              {archiveResult && <CountLabel>{archiveResult}</CountLabel>}
            </div>
          )}
          <Spacer />
          <CountLabel>
            {tab === "logs"
              ? `${liveDates.length} day${liveDates.length !== 1 ? "s" : ""} · LA time`
              : `${archiveDates.length} archive${archiveDates.length !== 1 ? "s" : ""}`}
          </CountLabel>
          <NeonX accent="pink" onClick={onClose} title="Close" />
        </PanelHeader>

        <BodySplit>
          <SidebarWrap>
            {sidebarDates.length === 0 ? (
              <PanelEmptyState style={{ fontSize: "0.625rem", padding: "0.75rem 1rem" }}>
                {tab === "logs"
                  ? "No logs yet."
                  : "No archives. Run 'Archive Old Logs' after 30 days."}
              </PanelEmptyState>
            ) : (
              sidebarDates.map((d) => {
                const isSelected = selectedDate?.date === d.date;
                return (
                  <DateBtn key={d.date} $active={isSelected} onClick={() => setSelectedDate(d)}>
                    <DateLabel $active={isSelected}>{d.date}</DateLabel>
                    <DateMeta>
                      {d.archived
                        ? `🗜 ${fmtBytes(d.bytes)}${d.decompressed ? " · open" : ""}`
                        : fmtBytes(d.bytes)}
                    </DateMeta>
                  </DateBtn>
                );
              })
            )}
            {tab === "logs" && livePageTotal > 1 && (
              <SidebarPager>
                <PagerBtn disabled={livePage <= 0} onClick={() => setLivePage((p) => p - 1)}>
                  ↑ Newer
                </PagerBtn>
                <PagerLabel>
                  {livePage + 1}/{livePageTotal}
                </PagerLabel>
                <PagerBtn
                  disabled={livePage >= livePageTotal - 1}
                  onClick={() => setLivePage((p) => p + 1)}
                >
                  Older ↓
                </PagerBtn>
              </SidebarPager>
            )}
          </SidebarWrap>

          {selectedDate ? (
            <ViewerWrap>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                <DateTitle>{selectedDate.date}</DateTitle>
                {selectedDate.archived && <ArchiveBadge>Archived</ArchiveBadge>}
              </div>
              <LogViewer
                key={selectedDate.date}
                date={selectedDate.date}
                isArchive={selectedDate.archived}
                decompressed={selectedDate.archived ? selectedDate.decompressed : false}
                onDecompressRequest={handleDecompress}
                onCloseArchive={handleCloseArchive}
              />
            </ViewerWrap>
          ) : (
            <EmptyCenter>
              <span style={{ fontSize: "2.5rem" }}>📋</span>
              <p style={{ fontSize: "0.875rem" }}>Select a date to view logs</p>
            </EmptyCenter>
          )}
        </BodySplit>
      </Panel>
    </>
  );
}

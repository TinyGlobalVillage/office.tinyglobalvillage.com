"use client";

import { useState, useEffect, useCallback } from "react";
import styled, { css } from "styled-components";
import { colors, rgb } from "../../theme";
import TopNav from "../../components/TopNav";
import { useTerminal } from "../../components/TerminalProvider";
import { usePreview } from "../../components/PreviewDrawer";

type Proc = {
  id: number;
  name: string;
  status: "online" | "stopped" | "errored" | string;
  restarts: number;
  uptime: number | null;
  memoryMb: number | null;
  cpu: number | null;
  port: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  online: "#00dc64",
  stopped: "#6b7280",
  errored: colors.red,
};

function formatUptime(ms: number | null) {
  if (!ms) return "—";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d`;
}

/* ── Styled Components ─────────────────────────────────────────── */

const PageMain = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 7rem 1rem 8rem;
  max-width: 72rem;
  margin: 0 auto;
  width: 100%;
  gap: 1.25rem;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
`;

const PageSubtitle = styled.p`
  font-size: 0.75rem;
  color: var(--t-textGhost);

  [data-theme="light"] & {
    color: var(--t-textFaint);
  }
`;

const LastRefreshSpan = styled.span`
  margin-left: 0.5rem;
  color: rgba(255, 255, 255, 0.15);

  [data-theme="light"] & {
    color: var(--t-textGhost);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const RefreshBtn = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  border: 1px solid rgba(${rgb.cyan}, 0.3);
  color: ${colors.cyan};
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: rgba(${rgb.cyan}, 0.1);
  }

  [data-theme="light"] & {
    border-color: rgba(${rgb.cyan}, 0.4);
  }
`;

const SaveListBtn = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  border: 1px solid rgba(${rgb.gold}, 0.3);
  color: ${colors.gold};
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: rgba(${rgb.gold}, 0.1);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  [data-theme="light"] & {
    border-color: rgba(${rgb.gold}, 0.4);
  }
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
`;

const SummaryCard = styled.div<{ $color: string }>`
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--t-inputBg);
  border: 1px solid ${(p) => p.$color}22;

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: ${(p) => p.$color}33;
  }
`;

const SummaryLabel = styled.span`
  font-size: 0.75rem;
  color: var(--t-textGhost);

  [data-theme="light"] & {
    color: var(--t-textFaint);
  }
`;

const SummaryCount = styled.span<{ $color: string }>`
  font-size: 1.125rem;
  font-weight: 700;
  color: ${(p) => p.$color};
`;

const ProcessList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const SkeletonRow = styled.div`
  height: 4rem;
  border-radius: 0.75rem;
  background: var(--t-inputBg);
  animation: pulse 2s ease-in-out infinite;

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const ProcessRowWrapper = styled.div<{ $statusColor: string }>`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: 0.75rem;
  transition: all 0.15s;
  background: linear-gradient(44deg, hsla(190, 100%, 12%, 0.35), rgba(0, 0, 0, 0.7));
  border: 1px solid ${(p) => p.$statusColor}18;

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: ${(p) => p.$statusColor}33;
  }
`;

const StatusDot = styled.div<{ $color: string; $glow: boolean }>`
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  flex-shrink: 0;
  background: ${(p) => p.$color};
  box-shadow: ${(p) => (p.$glow ? `0 0 6px ${p.$color}` : "none")};
`;

const ProcNameWrap = styled.div`
  flex: 1;
  min-width: 0;
`;

const ProcNameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const ProcName = styled.span`
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--t-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ProcId = styled.span`
  font-size: 0.75rem;
  color: var(--t-textGhost);
  font-family: monospace;
`;

const ProcPort = styled.span`
  font-size: 0.75rem;
  font-family: monospace;
  color: ${colors.cyan};
`;

const ProcMetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.125rem;
`;

const ProcStatus = styled.span<{ $color: string }>`
  font-size: 0.75rem;
  color: ${(p) => p.$color};
`;

const ProcUptime = styled.span`
  font-size: 0.75rem;
  color: var(--t-textGhost);
`;

const ProcRestarts = styled.span`
  font-size: 0.75rem;
  color: rgba(${rgb.gold}, 0.7);
`;

const StatsWrap = styled.div`
  display: none;
  align-items: center;
  gap: 1.5rem;
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--t-textGhost);

  @media (min-width: 640px) {
    display: flex;
  }
`;

const ActionsWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
`;

const ActionButton = styled.button<{ $color: string }>`
  padding: 0.25rem 0.625rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  transition: all 0.15s;
  cursor: pointer;
  background: ${(p) => p.$color}18;
  border: 1px solid ${(p) => p.$color}33;
  color: ${(p) => p.$color};

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    background: ${(p) => p.$color}30;
  }

  [data-theme="light"] & {
    background: ${(p) => p.$color}12;
    border-color: ${(p) => p.$color}44;
  }
`;

/* ── Components ─────────────────────────────────────────────────── */

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<Proc[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const { runCommand, isRunning } = useTerminal();
  const { openPreview } = usePreview();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/pm2");
      if (res.ok) {
        const data = await res.json();
        setProcesses(data);
        setLastRefresh(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <>
      <TopNav />
      <PageMain>
        {/* Header */}
        <HeaderRow>
          <div>
            <PageSubtitle>
              PM2 — auto-refreshes every 10s
              {lastRefresh && (
                <LastRefreshSpan>
                  last: {lastRefresh.toLocaleTimeString()}
                </LastRefreshSpan>
              )}
            </PageSubtitle>
          </div>

          <ButtonGroup>
            <RefreshBtn onClick={refresh} title="Manually refresh PM2 process list">
              ↺ Refresh
            </RefreshBtn>
            <SaveListBtn
              onClick={() => runCommand("pm2-save", [])}
              disabled={isRunning}
              title="Save PM2 process list so it survives reboots"
            >
              💾 Save List
            </SaveListBtn>
          </ButtonGroup>
        </HeaderRow>

        {/* Summary bar */}
        {!loading && (
          <SummaryGrid>
            {([
              { label: "Online", count: processes.filter((p) => p.status === "online").length, color: "#00dc64" },
              { label: "Stopped", count: processes.filter((p) => p.status === "stopped").length, color: "#6b7280" },
              { label: "Errored", count: processes.filter((p) => p.status === "errored").length, color: colors.red },
            ] as const).map(({ label, count, color }) => (
              <SummaryCard key={label} $color={color}>
                <SummaryLabel>{label}</SummaryLabel>
                <SummaryCount $color={color}>{count}</SummaryCount>
              </SummaryCard>
            ))}
          </SummaryGrid>
        )}

        {/* Process list */}
        <ProcessList>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
            : processes.map((proc) => (
                <ProcessRow
                  key={proc.id}
                  proc={proc}
                  onAction={(action) => {
                    if (action === "preview" && proc.port) {
                      openPreview(proc.name);
                    } else if (action === "restart") {
                      runCommand("pm2-restart", ["--update-env", proc.name]);
                    } else if (action === "stop") {
                      runCommand("pm2-stop", [proc.name]);
                    } else if (action === "logs") {
                      runCommand("pm2-logs", [proc.name]);
                    }
                  }}
                />
              ))}
        </ProcessList>
      </PageMain>
    </>
  );
}

function ProcessRow({
  proc,
  onAction,
}: {
  proc: Proc;
  onAction: (action: string) => void;
}) {
  const { isRunning } = useTerminal();
  const statusColor = STATUS_COLOR[proc.status] ?? "#6b7280";
  const isWebProject = proc.port !== null;

  return (
    <ProcessRowWrapper $statusColor={statusColor}>
      <StatusDot $color={statusColor} $glow={proc.status === "online"} />

      <ProcNameWrap>
        <ProcNameRow>
          <ProcName>{proc.name}</ProcName>
          <ProcId>#{proc.id}</ProcId>
          {proc.port && <ProcPort>:{proc.port}</ProcPort>}
        </ProcNameRow>
        <ProcMetaRow>
          <ProcStatus $color={statusColor}>{proc.status}</ProcStatus>
          <ProcUptime>up {formatUptime(proc.uptime)}</ProcUptime>
          {proc.restarts > 0 && <ProcRestarts>↺ {proc.restarts}</ProcRestarts>}
        </ProcMetaRow>
      </ProcNameWrap>

      <StatsWrap>
        {proc.memoryMb !== null && <span>{proc.memoryMb} MB</span>}
        {proc.cpu !== null && <span>{proc.cpu}% CPU</span>}
      </StatsWrap>

      <ActionsWrap>
        {isWebProject && (
          <ActionButton
            $color={colors.pink}
            onClick={() => onAction("preview")}
            disabled={false}
            title={`Open ${proc.name} in preview pane`}
          >
            Preview
          </ActionButton>
        )}
        <ActionButton
          $color={colors.cyan}
          onClick={() => onAction("logs")}
          disabled={isRunning}
          title={`View last 80 lines of ${proc.name} logs`}
        >
          Logs
        </ActionButton>
        {proc.status === "online" ? (
          <ActionButton
            $color={colors.gold}
            onClick={() => onAction("restart")}
            disabled={isRunning}
            title={`Restart ${proc.name} (with --update-env)`}
          >
            Restart
          </ActionButton>
        ) : (
          <ActionButton
            $color="#00dc64"
            onClick={() => onAction("restart")}
            disabled={isRunning}
            title={`Start ${proc.name}`}
          >
            Start
          </ActionButton>
        )}
        {proc.status === "online" && (
          <ActionButton
            $color={colors.red}
            onClick={() => onAction("stop")}
            disabled={isRunning}
            title={`Stop ${proc.name}`}
          >
            Stop
          </ActionButton>
        )}
      </ActionsWrap>
    </ProcessRowWrapper>
  );
}

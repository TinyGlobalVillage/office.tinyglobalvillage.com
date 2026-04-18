"use client";

import styled, { keyframes } from "styled-components";
import { colors, rgb } from "../../theme";

/* ------------------------------------------------------------------ */
/*  Styled                                                            */
/* ------------------------------------------------------------------ */

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const StatusBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.75rem;
  flex-shrink: 0;
  font-size: 0.625rem;
  border-bottom: 1px solid var(--t-border);
  color: var(--t-textFaint);
`;

const PulseText = styled.span`
  animation: ${pulse} 1.5s ease-in-out infinite;
`;

const ScrollArea = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 6rem;
  font-size: 0.6875rem;
  color: var(--t-textGhost);
`;

const MessageRow = styled.div<{ $selected: boolean }>`
  width: 100%;
  text-align: left;
  transition: all 0.15s ease;
  background: ${(p) => (p.$selected ? `rgba(${rgb.cyan}, 0.08)` : "transparent")};
  border-bottom: 1px solid var(--t-border);
  border-left: 2px solid ${(p) => (p.$selected ? colors.cyan : "transparent")};
  cursor: pointer;
  outline: none;

  &:focus-visible {
    box-shadow: inset 0 0 0 2px rgba(${rgb.cyan}, 0.5);
  }

  &:hover {
    background: ${(p) =>
      p.$selected ? `rgba(${rgb.cyan}, 0.08)` : "var(--t-surface)"};
  }

  [data-theme="light"] & {
    border-bottom-color: var(--t-border);
  }
`;

const RowInner = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
`;

const DotWrap = styled.div`
  flex-shrink: 0;
  margin-top: 0.375rem;
`;

const UnreadDot = styled.div<{ $visible: boolean }>`
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 9999px;
  background: ${(p) => (p.$visible ? colors.cyan : "transparent")};
`;

const Content = styled.div`
  flex: 1;
  min-width: 0;
`;

const TopLine = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.25rem;
  margin-bottom: 0.125rem;
`;

const FromName = styled.span<{ $unread: boolean }>`
  font-size: 0.6875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: ${(p) => (p.$unread ? 700 : 400)};
  color: ${(p) => (p.$unread ? "var(--t-text)" : "var(--t-textMuted)")};
`;

const DateLabel = styled.span`
  font-size: 0.5625rem;
  flex-shrink: 0;
  margin-left: 0.25rem;
  color: var(--t-textGhost);
`;

const Subject = styled.div<{ $unread: boolean }>`
  font-size: 0.6875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 0.125rem;
  font-weight: ${(p) => (p.$unread ? 600 : 400)};
  color: ${(p) => (p.$unread ? "var(--t-textMuted)" : "var(--t-textFaint)")};
`;

const PreviewRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const Preview = styled.span`
  font-size: 0.625rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  color: var(--t-textGhost);
`;

const ActionGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.125rem;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s ease;

  ${MessageRow}:hover & {
    opacity: 1;
  }
`;

const MetaIcon = styled.span`
  font-size: 0.5625rem;
  color: var(--t-textFaint);
`;

const ActionBtn = styled.button`
  padding: 0 0.25rem;
  font-size: 0.5625rem;
  border-radius: 0.25rem;
  transition: all 0.15s ease;
  color: var(--t-textFaint);
  background: transparent;
  border: none;
  cursor: pointer;

  &:hover {
    background: var(--t-surface);
  }
`;

const LoadMoreBtn = styled.button`
  width: 100%;
  padding: 0.75rem 0;
  font-size: 0.6875rem;
  font-weight: 600;
  transition: all 0.15s ease;
  color: rgba(${rgb.cyan}, 0.6);
  background: transparent;
  border: none;
  cursor: pointer;

  &:hover {
    background: var(--t-surface);
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

type EmailSummary = {
  id: string;
  subject: string | null;
  from: { name?: string; email: string }[] | null;
  receivedAt: string | null;
  preview: string | null;
  unread: boolean;
  flagged: boolean;
  hasAttachment: boolean;
};

type Props = {
  messages: EmailSummary[];
  selected: string | null;
  total: number;
  loading: boolean;
  onSelect: (id: string) => void;
  onLoadMore: () => void;
  onAction: (
    id: string,
    action: "markRead" | "markUnread" | "flag" | "unflag" | "trash",
  ) => void;
};

function fromLabel(
  from: { name?: string; email: string }[] | null | undefined,
): string {
  if (!from || !from.length) return "(no sender)";
  const f = from[0];
  return f?.name || f?.email || "(no sender)";
}

function relativeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = diff / 60000;
  const hours = mins / 60;
  const days = hours / 24;
  if (mins < 1) return "just now";
  if (mins < 60) return `${Math.floor(mins)}m`;
  if (hours < 24) return `${Math.floor(hours)}h`;
  if (days < 7) return `${Math.floor(days)}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MessageList({
  messages,
  selected,
  total,
  loading,
  onSelect,
  onLoadMore,
  onAction,
}: Props) {
  return (
    <Container>
      <StatusBar>
        <span>
          {messages.length} of {total}
        </span>
        {loading && <PulseText>loading…</PulseText>}
      </StatusBar>

      <ScrollArea>
        {messages.length === 0 && !loading && (
          <EmptyState>No messages</EmptyState>
        )}

        {messages.map((msg) => (
          <MessageRow
            key={msg.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(msg.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(msg.id);
              }
            }}
            $selected={selected === msg.id}
          >
            <RowInner>
              <DotWrap>
                <UnreadDot $visible={msg.unread} />
              </DotWrap>

              <Content>
                <TopLine>
                  <FromName $unread={msg.unread}>
                    {fromLabel(msg.from)}
                  </FromName>
                  <DateLabel>{relativeDate(msg.receivedAt)}</DateLabel>
                </TopLine>

                <Subject $unread={msg.unread}>
                  {msg.subject ?? "(no subject)"}
                </Subject>

                <PreviewRow>
                  <Preview>{msg.preview}</Preview>
                  <ActionGroup>
                    {msg.hasAttachment && <MetaIcon>📎</MetaIcon>}
                    {msg.flagged && <MetaIcon>⭐</MetaIcon>}
                    <ActionBtn
                      onClick={(e) => {
                        e.stopPropagation();
                        onAction(
                          msg.id,
                          msg.unread ? "markRead" : "markUnread",
                        );
                      }}
                      title={msg.unread ? "Mark read" : "Mark unread"}
                    >
                      {msg.unread ? "✓" : "●"}
                    </ActionBtn>
                    <ActionBtn
                      onClick={(e) => {
                        e.stopPropagation();
                        onAction(msg.id, msg.flagged ? "unflag" : "flag");
                      }}
                      title={msg.flagged ? "Unflag" : "Flag"}
                    >
                      {msg.flagged ? "★" : "☆"}
                    </ActionBtn>
                    <ActionBtn
                      onClick={(e) => {
                        e.stopPropagation();
                        onAction(msg.id, "trash");
                      }}
                      title="Move to trash"
                    >
                      🗑
                    </ActionBtn>
                  </ActionGroup>
                </PreviewRow>
              </Content>
            </RowInner>
          </MessageRow>
        ))}

        {messages.length < total && (
          <LoadMoreBtn onClick={onLoadMore} disabled={loading}>
            {loading
              ? "Loading…"
              : `Load more (${total - messages.length} remaining)`}
          </LoadMoreBtn>
        )}
      </ScrollArea>
    </Container>
  );
}

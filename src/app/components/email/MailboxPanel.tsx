"use client";

import styled from "styled-components";
import { colors, rgb } from "../../theme";

/* ------------------------------------------------------------------ */
/*  Styled                                                            */
/* ------------------------------------------------------------------ */

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.2);
  border-right: 1px solid var(--t-border);

  [data-theme="light"] & {
    background: rgba(0, 0, 0, 0.03);
  }
`;

const ComposeArea = styled.div`
  padding: 0.5rem;
  flex-shrink: 0;
`;

const ComposeBtn = styled.button`
  width: 100%;
  padding: 0.5rem 0;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  background: rgba(${rgb.cyan}, 0.15);
  border: 1px solid rgba(${rgb.cyan}, 0.3);
  color: ${colors.cyan};
  cursor: pointer;

  &:hover {
    background: rgba(${rgb.cyan}, 0.25);
  }
`;

const ListArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0 0.25rem 0.5rem;
`;

const EmptyText = styled.div`
  text-align: center;
  padding: 2rem 0;
  font-size: 0.6875rem;
  color: var(--t-textGhost);
`;

const MailboxBtn = styled.button<{ $selected: boolean; $indent: number }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.5rem;
  transition: all 0.15s ease;
  text-align: left;
  padding: 5px ${(p) => 8 + p.$indent * 16}px 5px ${(p) => 8 + p.$indent * 12}px;
  background: ${(p) => (p.$selected ? `rgba(${rgb.cyan}, 0.12)` : "transparent")};
  color: ${(p) => (p.$selected ? colors.cyan : "var(--t-textMuted)")};
  border: none;
  cursor: pointer;

  &:hover {
    background: ${(p) =>
      p.$selected ? `rgba(${rgb.cyan}, 0.12)` : "var(--t-surface)"};
  }
`;

const MailboxIcon = styled.span`
  font-size: 0.75rem;
  flex-shrink: 0;
  width: 1rem;
  text-align: center;
`;

const MailboxName = styled.span`
  flex: 1;
  font-size: 0.6875rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const UnreadBadge = styled.span`
  font-size: 0.5625rem;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
  flex-shrink: 0;
  background: rgba(${rgb.cyan}, 0.2);
  color: ${colors.cyan};
`;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

type Mailbox = {
  id: string;
  name: string;
  role: string | null;
  totalEmails: number;
  unreadEmails: number;
  parentId: string | null;
  sortOrder: number;
};

type Props = {
  mailboxes: Mailbox[];
  selected: string | null;
  onSelect: (id: string) => void;
  onCompose: () => void;
};

const ROLE_ICON: Record<string, string> = {
  inbox: "📥",
  sent: "📤",
  drafts: "📝",
  trash: "🗑",
  spam: "🚫",
  archive: "🗃",
  starred: "⭐",
};

const ROLE_ORDER: Record<string, number> = {
  inbox: 0,
  sent: 1,
  drafts: 2,
  archive: 3,
  spam: 4,
  trash: 5,
};

export default function MailboxPanel({ mailboxes, selected, onSelect, onCompose }: Props) {
  const sorted = [...mailboxes].sort((a, b) => {
    const ra = ROLE_ORDER[a.role ?? ""] ?? 10;
    const rb = ROLE_ORDER[b.role ?? ""] ?? 10;
    if (ra !== rb) return ra - rb;
    return a.sortOrder - b.sortOrder;
  });

  const topLevel = sorted.filter((m) => !m.parentId);
  const children = sorted.filter((m) => !!m.parentId);

  const renderMailbox = (m: Mailbox, indent = 0) => {
    const icon = ROLE_ICON[m.role ?? ""] ?? "📁";
    const isSelected = m.id === selected;
    const subs = children.filter((c) => c.parentId === m.id);

    return (
      <div key={m.id}>
        <MailboxBtn
          onClick={() => onSelect(m.id)}
          $selected={isSelected}
          $indent={indent}
        >
          <MailboxIcon>{icon}</MailboxIcon>
          <MailboxName>{m.name}</MailboxName>
          {m.unreadEmails > 0 && (
            <UnreadBadge>
              {m.unreadEmails > 99 ? "99+" : m.unreadEmails}
            </UnreadBadge>
          )}
        </MailboxBtn>
        {subs.map((s) => renderMailbox(s, indent + 1))}
      </div>
    );
  };

  return (
    <Panel>
      <ComposeArea>
        <ComposeBtn onClick={onCompose}>
          <span>✏</span> Compose
        </ComposeBtn>
      </ComposeArea>
      <ListArea>
        {topLevel.length === 0 && <EmptyText>Loading…</EmptyText>}
        {topLevel.map((m) => renderMailbox(m))}
      </ListArea>
    </Panel>
  );
}

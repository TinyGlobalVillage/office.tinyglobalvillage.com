"use client";

/**
 * Front Desk SMS Trash Modal — soft-deleted threads.
 *
 * Each entry shows the peer (E.164 or short code), the last message preview,
 * how long ago it was deleted, and how many days remain before the 30-day
 * auto-purge fires. Two actions per row:
 *   - Restore: move back to the active thread list.
 *   - Delete permanently: confirm via ConfirmModal, then DELETE the trash row.
 */

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb } from "../../theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalSubtitle,
  ModalBody,
  CloseBtn,
} from "../../styled";
import ConfirmModal from "./ConfirmModal";

type TrashedThread = {
  peerE164: string;
  deletedAt: string;
  messageCount: number;
  expiresAt: string;
  lastMessage: { body: string; createdAt: string; direction: "inbound" | "outbound" } | null;
};

const Empty = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: var(--t-textFaint);
  font-size: 0.85rem;
`;

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Row = styled.li`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--t-border);
  border-radius: 0.6rem;
  background: var(--t-inputBg);
`;

const PeerLine = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--t-text);
  font-weight: 600;
`;

const Preview = styled.div`
  margin-top: 0.25rem;
  font-size: 0.78rem;
  color: var(--t-textFaint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Meta = styled.div`
  margin-top: 0.4rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.7rem;
  color: var(--t-textGhost);
  font-family: var(--font-geist-mono), monospace;
`;

const Pill = styled.span<{ $tone?: "warn" | "ghost" }>`
  padding: 0.15rem 0.45rem;
  border-radius: 0.35rem;
  background: ${({ $tone }) =>
    $tone === "warn" ? `rgba(${rgb.pink}, 0.12)` : "rgba(255,255,255,0.04)"};
  border: 1px solid
    ${({ $tone }) => ($tone === "warn" ? `rgba(${rgb.pink}, 0.3)` : "var(--t-border)")};
  color: ${({ $tone }) => ($tone === "warn" ? colors.pink : "var(--t-textFaint)")};
`;

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  align-items: flex-end;
`;

const ActionBtn = styled.button<{ $variant: "primary" | "danger" }>`
  appearance: none;
  border: 1px solid
    ${({ $variant }) =>
      $variant === "danger" ? `rgba(${rgb.pink}, 0.4)` : `rgba(${rgb.cyan}, 0.4)`};
  background: ${({ $variant }) =>
    $variant === "danger" ? `rgba(${rgb.pink}, 0.08)` : `rgba(${rgb.cyan}, 0.08)`};
  color: ${({ $variant }) => ($variant === "danger" ? colors.pink : colors.cyan)};
  padding: 0.35rem 0.65rem;
  border-radius: 0.4rem;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  &:hover:not(:disabled) {
    background: ${({ $variant }) =>
      $variant === "danger" ? `rgba(${rgb.pink}, 0.16)` : `rgba(${rgb.cyan}, 0.16)`};
  }
`;

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function TrashModal({ open, onClose }: Props) {
  useEscapeToClose({ open, onClose });

  const [items, setItems] = useState<TrashedThread[]>([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState<TrashedThread | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/frontdesk/sms/trash");
      if (!res.ok) return;
      const j = await res.json();
      setItems(j.trashed ?? []);
      setRetentionDays(j.retentionDays ?? 30);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const restore = useCallback(
    async (peer: string) => {
      const res = await fetch(
        `/api/frontdesk/sms/trash/${encodeURIComponent(peer)}/restore`,
        { method: "POST" }
      );
      if (res.ok) await load();
    },
    [load]
  );

  const permanentDelete = useCallback(
    async (peer: string) => {
      const res = await fetch(`/api/frontdesk/sms/trash/${encodeURIComponent(peer)}`, {
        method: "DELETE",
      });
      if (res.ok) await load();
      setConfirming(null);
    },
    [load]
  );

  if (!open) return null;

  return (
    <>
      <ModalBackdrop onClick={onClose}>
        <ModalContainer $accent="pink" $maxWidth="38rem" onClick={(e) => e.stopPropagation()}>
          <ModalHeader>
            <ModalHeaderLeft>
              <ModalTitle>🗑 SMS Trash</ModalTitle>
              <ModalSubtitle>
                Threads auto-delete {retentionDays} days after they're trashed.
              </ModalSubtitle>
            </ModalHeaderLeft>
            <CloseBtn onClick={onClose}>×</CloseBtn>
          </ModalHeader>
          <ModalBody>
            {loading && items.length === 0 ? (
              <Empty>Loading…</Empty>
            ) : items.length === 0 ? (
              <Empty>Trash is empty.</Empty>
            ) : (
              <List>
                {items.map((t) => (
                  <Row key={t.peerE164}>
                    <div>
                      <PeerLine>{t.peerE164}</PeerLine>
                      <Preview>
                        {t.lastMessage
                          ? `${t.lastMessage.direction === "outbound" ? "→ " : "← "}${t.lastMessage.body}`
                          : "(no preview)"}
                      </Preview>
                      <Meta>
                        <Pill>{t.messageCount} msg{t.messageCount === 1 ? "" : "s"}</Pill>
                        <Pill>deleted {timeAgo(t.deletedAt)}</Pill>
                        <Pill $tone={daysLeft(t.expiresAt) <= 3 ? "warn" : undefined}>
                          purges in {daysLeft(t.expiresAt)} day{daysLeft(t.expiresAt) === 1 ? "" : "s"}
                        </Pill>
                      </Meta>
                    </div>
                    <Actions>
                      <ActionBtn $variant="primary" onClick={() => restore(t.peerE164)}>
                        ↺ Restore
                      </ActionBtn>
                      <ActionBtn $variant="danger" onClick={() => setConfirming(t)}>
                        🗑 Delete forever
                      </ActionBtn>
                    </Actions>
                  </Row>
                ))}
              </List>
            )}
          </ModalBody>
        </ModalContainer>
      </ModalBackdrop>
      <ConfirmModal
        open={confirming !== null}
        title="Delete forever?"
        message={`Permanently delete the conversation with ${confirming?.peerE164 ?? ""}?`}
        detail={`${confirming?.messageCount ?? 0} message${confirming?.messageCount === 1 ? "" : "s"} will be removed. This cannot be undone.`}
        confirmLabel="Delete forever"
        cancelLabel="Cancel"
        intent="danger"
        onConfirm={() => confirming && permanentDelete(confirming.peerE164)}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function daysLeft(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

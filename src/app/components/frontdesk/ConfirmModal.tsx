"use client";

/**
 * Generic confirmation modal — matches the existing TGV Office modal styling
 * (uses the shared ModalBackdrop/ModalContainer/ModalHeader/ModalBody/CloseBtn
 * primitives from app/styled.ts).
 *
 * Two intents:
 *   - "danger"  — pink accent, destructive. Default for permanent-delete flows.
 *   - "primary" — cyan accent, neutral confirm.
 */

import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb } from "../../theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
  CloseBtn,
} from "../../styled";

type Intent = "danger" | "primary";

type Props = {
  open: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  intent?: Intent;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

// A confirm spawned FROM another modal must stack above it. The shared ModalBackdrop
// sits at z-index 100, but callers live higher (e-sign modals 1000, MediaConverter
// 10500, ChatDrawer 11000) — so this dialog gets its own top layer.
const ConfirmBackdrop = styled(ModalBackdrop)`
  z-index: 12000;
`;

const Footer = styled.div`
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
  margin-top: 1.25rem;
`;

const Btn = styled.button<{ $variant: "primary" | "danger" | "ghost" }>`
  appearance: none;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.55rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid
    ${({ $variant }) =>
      $variant === "danger"
        ? `rgba(${rgb.pink}, 0.5)`
        : $variant === "primary"
          ? `rgba(${rgb.cyan}, 0.5)`
          : "var(--t-border)"};
  background: ${({ $variant }) =>
    $variant === "danger"
      ? `rgba(${rgb.pink}, 0.12)`
      : $variant === "primary"
        ? `rgba(${rgb.cyan}, 0.12)`
        : "transparent"};
  color: ${({ $variant }) =>
    $variant === "danger" ? colors.pink : $variant === "primary" ? colors.cyan : "var(--t-text)"};
  transition: background 0.15s ease, transform 0.05s ease;
  &:hover:not(:disabled) {
    background: ${({ $variant }) =>
      $variant === "danger"
        ? `rgba(${rgb.pink}, 0.22)`
        : $variant === "primary"
          ? `rgba(${rgb.cyan}, 0.22)`
          : "var(--t-inputBg)"};
  }
  &:active:not(:disabled) { transform: translateY(1px); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const Detail = styled.div`
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--t-textFaint);
  line-height: 1.5;
`;

const Message = styled.div`
  font-size: 0.95rem;
  color: var(--t-text);
  line-height: 1.5;
`;

export default function ConfirmModal({
  open,
  title,
  message,
  detail,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  intent = "danger",
  onConfirm,
  onCancel,
}: Props) {
  useEscapeToClose({ open, onClose: onCancel });

  if (!open) return null;

  const accent = intent === "danger" ? "pink" : "cyan";
  const titleColor = intent === "danger" ? colors.pink : colors.cyan;

  return (
    <ConfirmBackdrop onClick={onCancel}>
      <ModalContainer
        $accent={accent}
        $maxWidth="28rem"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle id="confirm-modal-title" $color={titleColor}>{title}</ModalTitle>
          </ModalHeaderLeft>
          <CloseBtn onClick={onCancel} aria-label="Cancel">×</CloseBtn>
        </ModalHeader>
        <ModalBody>
          <Message>{message}</Message>
          {detail && <Detail>{detail}</Detail>}
          <Footer>
            <Btn $variant="ghost" onClick={onCancel}>{cancelLabel}</Btn>
            <Btn $variant={intent === "danger" ? "danger" : "primary"} onClick={onConfirm} autoFocus>
              {confirmLabel}
            </Btn>
          </Footer>
        </ModalBody>
      </ModalContainer>
    </ConfirmBackdrop>
  );
}

"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { ModalBackdrop } from "../styled";

// The blessed modal primitive. Renders the shared ModalBackdrop and registers on the
// canonical Escape stack (window.__tgvEscapeStack) via useEscapeToClose, so nesting and
// focus-independent Escape "just work". New modals should render inside <ModalRoot> rather
// than wiring their own keydown listener.
type ModalRootProps = {
  open?: boolean;
  onClose: () => void;
  closeOnBackdropClick?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export default function ModalRoot({
  open = true,
  onClose,
  closeOnBackdropClick = true,
  className,
  style,
  children,
}: ModalRootProps) {
  useEscapeToClose({ open, onClose });
  if (!open) return null;
  return (
    <ModalBackdrop
      className={className}
      style={style}
      onMouseDown={
        closeOnBackdropClick
          ? (e) => {
              if (e.target === e.currentTarget) onClose();
            }
          : undefined
      }
    >
      {children}
    </ModalBackdrop>
  );
}

"use client";

/**
 * Global promise-based dialog service — the styled replacement for native
 * window.confirm / window.alert across TGV Office.
 *
 *   const ok = await askConfirm({ title: "Delete contact?", message: "…" });
 *   await showNotice({ message: "Couldn't send: …" });
 *
 * <DialogHost /> is mounted ONCE in the dashboard layout and renders the
 * shared ConfirmModal (frontdesk/ConfirmModal — z-12000, stacks above every
 * drawer/modal). Callers need no local state, so a swap from window.confirm
 * is a one-line change in any component at any depth. Requests queue: if a
 * dialog is already open the next one shows after it resolves.
 *
 * Share-ready: no tenant identity; the singleton bus is module-scoped and
 * browser-only.
 */

import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { rgb } from "../theme";
import ConfirmModal from "./frontdesk/ConfirmModal";

export type ConfirmOptions = {
  title?: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  intent?: "danger" | "primary";
};

export type NoticeOptions = {
  title?: string;
  message: string;
  detail?: string;
  intent?: "danger" | "primary";
};

export type PromptOptions = {
  title?: string;
  message: string;
  detail?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  intent?: "danger" | "primary";
};

type PendingDialog =
  | { kind: "confirm" | "notice"; opts: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: "prompt"; opts: PromptOptions; resolve: (value: string | null) => void };

const queue: PendingDialog[] = [];
let notifyHost: (() => void) | null = null;

function enqueue(d: PendingDialog): void {
  queue.push(d);
  notifyHost?.();
}

/** Styled window.confirm. Resolves true on confirm, false on cancel/escape. */
export function askConfirm(opts: ConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise<boolean>((resolve) => enqueue({ kind: "confirm", opts, resolve }));
}

/** Styled window.alert (OK-only). Resolves when dismissed. */
export function showNotice(opts: NoticeOptions): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise<void>((resolve) =>
    enqueue({ kind: "notice", opts, resolve: () => resolve() }),
  );
}

/** Styled window.prompt. Resolves the entered string on OK, null on cancel. */
export function askPrompt(opts: PromptOptions): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise<string | null>((resolve) => enqueue({ kind: "prompt", opts, resolve }));
}

const PromptInput = styled.input`
  width: 100%;
  margin-top: 0.85rem;
  padding: 0.55rem 0.75rem;
  font-size: 0.875rem;
  color: var(--t-textBase);
  background: var(--t-inputBg);
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
  outline: none;

  &:focus { border-color: rgba(${rgb.cyan}, 0.55); }
`;

export function DialogHost() {
  const [current, setCurrent] = useState<PendingDialog | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const pump = () => {
      setCurrent((cur) => cur ?? queue.shift() ?? null);
    };
    notifyHost = pump;
    pump();
    return () => {
      if (notifyHost === pump) notifyHost = null;
    };
  }, []);

  // Prompt mode: focus the input when the dialog appears (autoFocus lands on
  // the confirm button otherwise).
  useEffect(() => {
    if (current?.kind === "prompt") inputRef.current?.focus();
  }, [current]);

  const settle = (ok: boolean) => {
    if (current?.kind === "prompt") {
      current.resolve(ok ? (inputRef.current?.value ?? "") : null);
    } else {
      current?.resolve(ok);
    }
    // Show the next queued dialog (if any) after this one settles.
    setCurrent(queue.shift() ?? null);
  };

  if (!current) return null;
  const { kind, opts } = current;
  return (
    <ConfirmModal
      open
      title={opts.title ?? (kind === "notice" ? "Notice" : "Are you sure?")}
      message={opts.message}
      detail={opts.detail}
      confirmLabel={opts.confirmLabel ?? (kind === "notice" ? "OK" : kind === "prompt" ? "OK" : "Confirm")}
      cancelLabel={opts.cancelLabel ?? "Cancel"}
      intent={opts.intent ?? (kind === "prompt" ? "primary" : "danger")}
      hideCancel={kind === "notice"}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    >
      {kind === "prompt" && (
        <PromptInput
          ref={inputRef}
          defaultValue={(opts as PromptOptions).initialValue ?? ""}
          placeholder={(opts as PromptOptions).placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              settle(true);
            }
          }}
        />
      )}
    </ConfirmModal>
  );
}

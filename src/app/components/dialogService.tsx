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

import { useEffect, useState } from "react";
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

type PendingDialog = {
  kind: "confirm" | "notice";
  opts: ConfirmOptions;
  resolve: (ok: boolean) => void;
};

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

export function DialogHost() {
  const [current, setCurrent] = useState<PendingDialog | null>(null);

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

  const settle = (ok: boolean) => {
    current?.resolve(ok);
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
      confirmLabel={opts.confirmLabel ?? (kind === "notice" ? "OK" : "Confirm")}
      cancelLabel={opts.cancelLabel ?? "Cancel"}
      intent={opts.intent ?? "danger"}
      hideCancel={kind === "notice"}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );
}

/**
 * In-memory pub/sub bus for SMS events. The webhook handler emits "inbound"
 * after persisting; the SSE stream subscribes and forwards to connected
 * browser clients so the SmsTab updates without polling.
 *
 * Module-level EventEmitter survives across route invocations within a
 * single Next.js process. PM2 single-fork → one bus per Office instance,
 * which is what we want.
 */
import { EventEmitter } from "node:events";

declare global {
  // eslint-disable-next-line no-var
  var __frontdeskSmsBus: EventEmitter | undefined;
}

export const smsBus: EventEmitter =
  globalThis.__frontdeskSmsBus ??
  (globalThis.__frontdeskSmsBus = new EventEmitter().setMaxListeners(50));

export interface SmsBusInboundEvent {
  fromE164: string;
  toE164: string;
  body: string;
  receivedAt: string; // ISO
}

export function emitInbound(ev: SmsBusInboundEvent): void {
  smsBus.emit("inbound", ev);
}

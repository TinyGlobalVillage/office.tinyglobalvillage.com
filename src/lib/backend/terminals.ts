// Backend terminals: a real pty per tab (apps/tgv-desktop/remote/tgv_pty.py — no native node-pty needed),
// output fanned out over SSE, input/resize by POST. Sessions live in this process (globalThis survives
// HMR), belong to one member, keep the last 256 KB for a reconnect, and die 10 min after the last viewer.
import "server-only";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { randomBytes } from "crypto";
import path from "path";
import { helperDir } from "./server";

const PYTHON = process.env.TGV_PYTHON || "python3";
const KEEP = 256 * 1024;
const IDLE_MS = 10 * 60_000;
const MAX_PER_MEMBER = 8;

type Listener = (ev: { type: "data"; b64: string } | { type: "exit" }) => void;
export type Term = {
  id: string;
  memberId: string;
  cwd: string;
  child: ChildProcessWithoutNullStreams;
  backlog: Buffer[];
  backlogSize: number;
  listeners: Set<Listener>;
  idleTimer: NodeJS.Timeout | null;
  exited: boolean;
};

const g = globalThis as unknown as { __tgvBackendTerms?: Map<string, Term> };
const terms: Map<string, Term> = (g.__tgvBackendTerms ??= new Map());

function armIdle(t: Term) {
  if (t.idleTimer) clearTimeout(t.idleTimer);
  t.idleTimer = t.listeners.size ? null : setTimeout(() => closeTerm(t.id), IDLE_MS);
}

export function openTerm(memberId: string, cwd: string, cols: number, rows: number): Term | "too-many" {
  const mine = [...terms.values()].filter((t) => t.memberId === memberId && !t.exited);
  if (mine.length >= MAX_PER_MEMBER) return "too-many";
  const id = randomBytes(12).toString("base64url");
  const child = spawn(
    PYTHON,
    ["-I", path.join(helperDir(), "tgv_pty.py"), cwd, String(cols | 0 || 120), String(rows | 0 || 32)],
    { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, HOME: process.env.HOME ?? "/tmp" } },
  );
  const t: Term = { id, memberId, cwd, child, backlog: [], backlogSize: 0, listeners: new Set(), idleTimer: null, exited: false };
  child.stdout.on("data", (c: Buffer) => {
    t.backlog.push(c);
    t.backlogSize += c.length;
    while (t.backlogSize > KEEP && t.backlog.length > 1) t.backlogSize -= t.backlog.shift()!.length;
    const b64 = c.toString("base64");
    t.listeners.forEach((l) => l({ type: "data", b64 }));
  });
  child.on("close", () => {
    t.exited = true;
    t.listeners.forEach((l) => l({ type: "exit" }));
    setTimeout(() => terms.delete(id), 30_000);
  });
  terms.set(id, t);
  armIdle(t);
  return t;
}

export function getTerm(id: string, memberId: string): Term | null {
  const t = terms.get(id);
  return t && t.memberId === memberId ? t : null;
}

export function writeTerm(t: Term, msg: { d?: string; r?: [number, number] }) {
  if (t.exited) return;
  if (typeof msg.d === "string" && msg.d.length <= 1_000_000) t.child.stdin.write(JSON.stringify({ d: msg.d }) + "\n");
  if (Array.isArray(msg.r)) t.child.stdin.write(JSON.stringify({ r: [msg.r[0] | 0, msg.r[1] | 0] }) + "\n");
}

export function subscribe(t: Term, l: Listener): () => void {
  t.listeners.add(l);
  armIdle(t);
  return () => {
    t.listeners.delete(l);
    armIdle(t);
  };
}

export function closeTerm(id: string) {
  const t = terms.get(id);
  if (!t) return;
  try {
    t.child.stdin.write(JSON.stringify({ q: 1 }) + "\n");
    t.child.stdin.end();
  } catch {}
  setTimeout(() => t.child.kill("SIGKILL"), 2000).unref();
  terms.delete(id);
}

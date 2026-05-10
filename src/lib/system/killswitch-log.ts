// Killswitch action audit log — telephony-security Item 5 modal (2026-05-02).
//
// Records every engage/restore action triggered via the Office UI. Read by
// the Telephony modal's combined timeline so operators can see who did
// what when. Append-only; capped at 1000 rows.

import { readJson, writeJson } from "@/lib/frontdesk/store";

const FILE = "killswitch-actions.json";
const MAX_ROWS = 1000;

export type KillswitchAction = {
  id: string;
  ts: string;                         // ISO timestamp
  by: string;                         // username
  action: "engage" | "restore" | "status";
  outcome: "ok" | "fail";
  detail: string | null;              // raw stdout/error excerpt
};

type Db = { actions: KillswitchAction[] };

function shortRand(len = 6): string {
  const alpha = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alpha[Math.floor(Math.random() * alpha.length)];
  return s;
}

function read(): Db {
  return readJson<Db>(FILE, { actions: [] });
}

function write(db: Db): void {
  writeJson(FILE, db);
}

export function recordKillswitchAction(p: {
  by: string;
  action: KillswitchAction["action"];
  outcome: KillswitchAction["outcome"];
  detail?: string | null;
}): KillswitchAction {
  const row: KillswitchAction = {
    id: `ks_${Date.now()}_${shortRand()}`,
    ts: new Date().toISOString(),
    by: p.by,
    action: p.action,
    outcome: p.outcome,
    detail: p.detail ?? null,
  };
  const db = read();
  db.actions.push(row);
  if (db.actions.length > MAX_ROWS) db.actions = db.actions.slice(-MAX_ROWS);
  write(db);
  return row;
}

export function listKillswitchActions(limit = 200): KillswitchAction[] {
  return read().actions.slice().reverse().slice(0, limit);
}

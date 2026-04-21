import type { Alert, AlertSource } from "./types";
import { readJson, writeJson, shortId } from "./store";

const FILE = "alerts.json";

type Db = { alerts: Alert[] };

function read(): Db {
  return readJson<Db>(FILE, { alerts: [] });
}

function write(db: Db): void {
  writeJson(FILE, db);
}

export function listAlerts(filter?: { includeArchived?: boolean }): Alert[] {
  const rows = read().alerts;
  const base = filter?.includeArchived ? rows : rows.filter(a => !a.archivedAt);
  return base.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createAlert(params: {
  source: AlertSource;
  subject: string;
  body: string;
  fromName?: string | null;
  fromEmail?: string | null;
  fromPhone?: string | null;
  payload?: Record<string, unknown>;
}): Alert {
  const alert: Alert = {
    id: shortId("al"),
    source: params.source,
    subject: params.subject.trim().slice(0, 200),
    body: params.body.slice(0, 20_000),
    fromName: params.fromName?.trim() || null,
    fromEmail: params.fromEmail?.trim() || null,
    fromPhone: params.fromPhone?.trim() || null,
    payload: params.payload ?? {},
    createdAt: new Date().toISOString(),
    readBy: [],
    archivedAt: null,
  };
  const db = read();
  db.alerts.push(alert);
  if (db.alerts.length > 5000) db.alerts = db.alerts.slice(-5000);
  write(db);
  return alert;
}

export function markAlertRead(id: string, username: string): Alert | null {
  const db = read();
  const alert = db.alerts.find(a => a.id === id);
  if (!alert) return null;
  if (!alert.readBy.includes(username)) {
    alert.readBy.push(username);
    write(db);
  }
  return alert;
}

export function archiveAlert(id: string): Alert | null {
  const db = read();
  const alert = db.alerts.find(a => a.id === id);
  if (!alert) return null;
  alert.archivedAt = new Date().toISOString();
  write(db);
  return alert;
}

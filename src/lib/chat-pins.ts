import fs from "fs";
import path from "path";

const PINS_FILE = path.join(process.cwd(), "data", "chat-pins.json");

export type PinMenu = "users" | "groups" | "both";

export type Pin = {
  chatId: string;
  userId: string | null;
  menu: PinMenu;
  pinnedAt: string;
};

type PinsDb = { pins: Pin[] };

const TGV_GLOBAL_PIN: Pin = {
  chatId: "tgv",
  userId: null,
  menu: "both",
  pinnedAt: "2026-04-19T00:00:00.000Z",
};

function read(): PinsDb {
  try {
    if (!fs.existsSync(PINS_FILE)) return { pins: [TGV_GLOBAL_PIN] };
    const parsed = JSON.parse(fs.readFileSync(PINS_FILE, "utf8")) as PinsDb;
    const pins = Array.isArray(parsed.pins) ? parsed.pins : [];
    if (!pins.some((p) => p.chatId === "tgv" && p.userId === null)) {
      pins.push(TGV_GLOBAL_PIN);
    }
    return { pins };
  } catch {
    return { pins: [TGV_GLOBAL_PIN] };
  }
}

function write(db: PinsDb) {
  fs.mkdirSync(path.dirname(PINS_FILE), { recursive: true });
  fs.writeFileSync(PINS_FILE, JSON.stringify(db, null, 2));
}

export function listPinsFor(username: string): Pin[] {
  const { pins } = read();
  return pins.filter((p) => p.userId === null || p.userId === username);
}

export function isPinned(username: string, chatId: string, menu: "users" | "groups"): boolean {
  const visible = listPinsFor(username);
  return visible.some(
    (p) => p.chatId === chatId && (p.menu === menu || p.menu === "both"),
  );
}

export function setPin(pin: Pin): Pin {
  const db = read();
  const existingIdx = db.pins.findIndex(
    (p) => p.chatId === pin.chatId && p.userId === pin.userId,
  );
  if (existingIdx >= 0) {
    db.pins[existingIdx] = { ...db.pins[existingIdx], menu: pin.menu, pinnedAt: pin.pinnedAt };
  } else {
    db.pins.push(pin);
  }
  write(db);
  return pin;
}

export function removePin(chatId: string, userId: string | null): boolean {
  if (chatId === "tgv" && userId === null) return false;
  const db = read();
  const before = db.pins.length;
  db.pins = db.pins.filter(
    (p) => !(p.chatId === chatId && p.userId === userId),
  );
  if (db.pins.length === before) return false;
  write(db);
  return true;
}

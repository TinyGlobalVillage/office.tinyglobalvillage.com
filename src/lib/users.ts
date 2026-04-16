import { readFileSync, writeFileSync } from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "users.json");

export type WebAuthnCredential = {
  id: string;           // base64url credential ID
  publicKey: string;    // base64url encoded public key
  counter: number;
  deviceName: string;
  createdAt: string;
};

export type UserRecord = {
  displayName: string;
  email: string;
  totpSecret: string | null;
  totpEnabled: boolean;
  webauthnCredentials: WebAuthnCredential[];
};

export type UserStore = Record<string, UserRecord>;

export function readUsers(): UserStore {
  try {
    return JSON.parse(readFileSync(DATA_PATH, "utf8")) as UserStore;
  } catch {
    return {};
  }
}

export function writeUsers(store: UserStore): void {
  writeFileSync(DATA_PATH, JSON.stringify(store, null, 2), "utf8");
}

export function getUser(username: string): UserRecord | null {
  const store = readUsers();
  return store[username] ?? null;
}

export function updateUser(username: string, patch: Partial<UserRecord>): void {
  const store = readUsers();
  if (!store[username]) return;
  store[username] = { ...store[username], ...patch };
  writeUsers(store);
}

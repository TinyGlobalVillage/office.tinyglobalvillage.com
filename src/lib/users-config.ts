import fs from "fs";
import path from "path";

const USERS_FILE = path.join(process.cwd(), "data", "users.json");

type UserRecord = {
  displayName: string;
  email: string;
  [key: string]: unknown;
};

type UsersDB = Record<string, UserRecord>;

function readUsers(): UsersDB {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {
    return {};
  }
}

export function getUserEmail(username: string): string {
  const db = readUsers();
  return db[username]?.email ?? "";
}

export function getAllUserEmails(): string[] {
  const db = readUsers();
  return Object.values(db)
    .map((u) => u.email)
    .filter(Boolean);
}

export function getUserDisplayName(username: string): string {
  const db = readUsers();
  return db[username]?.displayName ?? username;
}

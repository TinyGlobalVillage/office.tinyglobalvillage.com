import fs from "fs";
import path from "path";

const STORE_PATH = "/srv/refusion-core/logs/tgv-office/email-settings.json";

export type EmailSectionVisibility = {
  mailboxPanel: boolean;
  previewPane: boolean;
  composeToolbar: boolean;
  attachmentBar: boolean;
  ccBcc: boolean;
  threadView: boolean;
};

export type EmailDisplaySettings = {
  zoom: number;           // 0.8 | 0.9 | 1.0 | 1.1 | 1.25
  splitMode: "vertical" | "horizontal" | "fullList"; // reading pane position
  defaultAccount: string; // account key
};

export type UserEmailSettings = {
  sections: EmailSectionVisibility;
  display: EmailDisplaySettings;
  updatedAt: string;
};

export type EmailSettingsStore = Record<string, UserEmailSettings>;

const DEFAULT_SETTINGS: UserEmailSettings = {
  sections: {
    mailboxPanel: true,
    previewPane: true,
    composeToolbar: true,
    attachmentBar: true,
    ccBcc: false,
    threadView: true,
  },
  display: {
    zoom: 1.0,
    splitMode: "vertical",
    defaultAccount: "admin",
  },
  updatedAt: new Date().toISOString(),
};

function readStore(): EmailSettingsStore {
  try {
    if (!fs.existsSync(STORE_PATH)) return {};
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as EmailSettingsStore;
  } catch {
    return {};
  }
}

function writeStore(store: EmailSettingsStore): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function getUserSettings(username: string): UserEmailSettings {
  const store = readStore();
  return store[username] ?? { ...DEFAULT_SETTINGS };
}

export function saveUserSettings(
  username: string,
  patch: Partial<UserEmailSettings>
): UserEmailSettings {
  const store = readStore();
  const current = store[username] ?? { ...DEFAULT_SETTINGS };
  const updated: UserEmailSettings = {
    sections: { ...current.sections, ...(patch.sections ?? {}) },
    display: { ...current.display, ...(patch.display ?? {}) },
    updatedAt: new Date().toISOString(),
  };
  store[username] = updated;
  writeStore(store);
  return updated;
}

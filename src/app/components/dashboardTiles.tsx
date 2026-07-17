"use client";
// Single source of truth for the Office dashboard tile grid AND the TgvNav
// balloon Menu "tools" section (Gio 2026-07-09: a tile added to the dashboard
// must automatically appear in the Menu). Add an entry here and both surfaces
// pick it up — the dashboard renders tiles in this order, the Menu sorts
// alphabetically with Suggest pinned last.
//
// action shapes:
//   { page: "storage" }   tile → DashboardPageModal(pageKey); Menu → /dashboard/<page>
//   { event: "open-x" }   both dispatch a window CustomEvent — the modal host
//                         must be GLOBAL (GlobalModals / ClientShell), not a
//                         page-local listener, or the Menu entry only works
//                         on the page that happens to mount it
//   { drawer: "chat" }    both dispatch tgv-drawer-open (drawers live in ClientShell)
//
// flags (default true): inTiles:false = Menu-only shortcut; inMenu:false = tile-only.

import type { ReactNode } from "react";
import { colors, type GlowColor } from "@/app/theme";
import ClaudeIcon from "./claude/ClaudeIcon";
import SandboxIcon from "./sandbox/SandboxIcon";
import LibraryIcon from "./LibraryIcon";
import {
  DatabaseIcon,
  StorageIcon,
  EditorIcon,
  UtilsIcon,
  SuggestionIcon,
  ProcessesIcon,
  DeployIcon,
  DrawerFrontDeskIcon,
  DrawerChatsIcon,
  DrawerInboxIcon,
  DrawerSessionsIcon,
  DrawerAlertsIcon,
  LogsIcon,
  MembersIcon,
  ModulesIcon,
  CashIcon,
} from "./icons";

export type OfficeTileAction =
  | { page: string }
  | { event: string }
  | { drawer: string };

export type OfficeTileDef = {
  key: string;
  title: string;
  subtitle: string;
  glow: GlowColor;
  icon: (size: number) => ReactNode;
  action: OfficeTileAction;
  /** Menu label override; defaults to title. */
  menuLabel?: string;
  inMenu?: boolean;
  inTiles?: boolean;
};

export function dispatchTileAction(action: OfficeTileAction) {
  if ("drawer" in action) {
    window.dispatchEvent(new CustomEvent("tgv-drawer-open", { detail: action.drawer }));
  } else if ("event" in action) {
    window.dispatchEvent(new CustomEvent(action.event));
  }
}

export function tileHref(action: OfficeTileAction): string | undefined {
  return "page" in action ? `/dashboard/${action.page}` : undefined;
}

export const OFFICE_TILES: OfficeTileDef[] = [
  { key: "Processes", title: "Processes", subtitle: "PM2", glow: "cyan", icon: (s) => <ProcessesIcon size={s} style={{ color: colors.cyan }} />, action: { page: "processes" } },
  { key: "Deploy", title: "Deploy", subtitle: "Projects", glow: "pink", icon: (s) => <DeployIcon size={s} style={{ color: colors.pink }} />, action: { page: "deploy" } },
  { key: "Database", title: "Database", subtitle: "PostgreSQL", glow: "gold", icon: (s) => <DatabaseIcon size={s} style={{ color: colors.gold }} />, action: { page: "database" } },
  { key: "Storage", title: "Storage", subtitle: "Files", glow: "pink", icon: (s) => <StorageIcon size={s} style={{ color: colors.pink }} />, action: { page: "storage" } },
  { key: "Editor", title: "Editor", subtitle: "Code", glow: "gold", icon: (s) => <EditorIcon size={s} style={{ color: colors.gold }} />, action: { page: "editor" } },
  { key: "Utils", title: "Utils", subtitle: "Tooling", glow: "cyan", icon: (s) => <UtilsIcon size={s} style={{ color: colors.cyan }} />, action: { page: "utils" } },
  { key: "Villagers", title: "Villagers", subtitle: "Members & wallets", glow: "gold", icon: (s) => <MembersIcon size={s} style={{ color: colors.gold }} />, action: { page: "villagers" } },
  { key: "Modules", title: "Modules", subtitle: "Platform surfaces", glow: "violet", icon: (s) => <ModulesIcon size={s} style={{ color: colors.violet }} />, action: { page: "modules" } },
  { key: "Payroll", title: "Payroll", subtitle: "Staff hours & rates", glow: "gold", icon: (s) => <CashIcon size={s} style={{ color: colors.gold }} />, action: { page: "payroll" } },
  { key: "EmailCampaigns", title: "Email Campaigns", subtitle: "Branded email templates", glow: "pink", icon: () => <span style={{ fontSize: 24 }}>✉️</span>, action: { page: "email-campaigns" } },
  { key: "Claude", title: "Claude", subtitle: "AI Assistant", glow: "orange", icon: (s) => <ClaudeIcon size={s} color={colors.orange} />, action: { event: "open-claude" } },
  { key: "Sandbox", title: "Sandbox", subtitle: "Component Lab", glow: "pink", icon: (s) => <SandboxIcon size={s} color={colors.pink} />, action: { event: "open-sandbox" } },
  { key: "Library", title: "Library", subtitle: "Catalog", glow: "violet", icon: (s) => <LibraryIcon size={s} color={colors.violet} />, action: { event: "open-library" } },
  { key: "Suggest", title: "Suggest", subtitle: "Feature ideas", glow: "pink", icon: (s) => <SuggestionIcon size={s} style={{ color: colors.pink }} />, action: { event: "open-suggestion" } },
  { key: "FrontDesk", title: "Front Desk", subtitle: "Calls / SMS / Inquiries", glow: "gold", icon: (s) => <DrawerFrontDeskIcon size={s} style={{ color: colors.gold }} />, action: { drawer: "frontdesk" } },
  { key: "Chats", title: "Chats", subtitle: "Team messaging", glow: "green", icon: (s) => <DrawerChatsIcon size={s} style={{ color: colors.green }} />, action: { drawer: "chat" } },
  { key: "Inbox", title: "Inbox", subtitle: "Email", glow: "cyan", icon: (s) => <DrawerInboxIcon size={s} style={{ color: colors.cyan }} />, action: { drawer: "inbox" } },
  { key: "Sessions", title: "Sessions", subtitle: "Video rooms", glow: "pink", icon: (s) => <DrawerSessionsIcon size={s} style={{ color: colors.pink }} />, action: { drawer: "sessions" } },
  { key: "Logs", title: "Logs", subtitle: "Recent Activity", glow: "cyan", icon: (s) => <LogsIcon size={s} style={{ color: colors.cyan }} />, action: { event: "open-activity" } },
  { key: "MyAlerts", title: "My Alerts", subtitle: "Personal reminders", glow: "gold", icon: () => <span style={{ fontSize: 24 }}>🔔</span>, action: { event: "open-my-alerts" } },
  { key: "Diary", title: "Diary", subtitle: "RCS log", glow: "violet", icon: () => <span style={{ fontSize: 24 }}>📖</span>, action: { event: "open-rcs-diary" } },

  // Menu-only shortcut — jumps straight to the Front Desk drawer's Alerts tab
  // (FrontDeskDrawer treats detail "alerts" as a legacy opener).
  { key: "Alerts", title: "Alerts", subtitle: "Front Desk alerts", glow: "gold", icon: (s) => <DrawerAlertsIcon size={s} style={{ color: colors.gold }} />, action: { drawer: "alerts" }, inTiles: false },
];

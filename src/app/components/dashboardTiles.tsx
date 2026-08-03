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

/**
 * Tile categories — what the operator is DOING, not what the code is. The
 * dashboard grid renders one sub-grid per group in this order; the TgvNav Menu
 * still reads the flat list. Order is deliberate: the things you reach for
 * daily (build, talk) come before the things you check on (infra, records).
 */
export const TILE_GROUPS = [
  "Build & Design",
  "Communication",
  "People & Money",
  "Infrastructure",
  "Records & Notes",
] as const;
export type OfficeTileGroup = (typeof TILE_GROUPS)[number];

/** Accent per group — the section heading's colour on the dashboard. */
export const TILE_GROUP_ACCENT: Record<OfficeTileGroup, GlowColor> = {
  "Build & Design": "pink",
  Communication: "green",
  "People & Money": "gold",
  Infrastructure: "cyan",
  "Records & Notes": "violet",
};

export type OfficeTileDef = {
  key: string;
  /** Which dashboard group this tile sits in. Untagged tiles fall to the end. */
  group?: OfficeTileGroup;
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

/**
 * Tile search (Gio 2026-08-02) — typing a tile's name brings up that tile,
 * and only it, while a word shared by several brings up all of them.
 *
 * Plain substring matching couldn't do that: "library" and "libr" behaved
 * identically, and a whole word buried in a subtitle never surfaced. So a
 * match is SCORED by how it matched, best tier wins, and results sort by
 * score before alphabetically:
 *
 *   100  the query IS a whole word of the title      ("library" → Library)
 *    80  a title word STARTS with the query          ("lib"     → Library)
 *    60  the query appears anywhere in the title     ("ibrar"   → Library)
 *    40  the query is a whole word of the subtitle   ("email"   → Inbox)
 *    30  a subtitle word starts with the query
 *    20  the query appears anywhere in the subtitle
 *
 * Multi-word queries must match EVERY word (each may match a different field),
 * so "front desk" narrows rather than widens. Returns null for no match.
 */
const WORDS_RE = /[^a-z0-9]+/;

function words(s: string): string[] {
  return s.toLowerCase().split(WORDS_RE).filter(Boolean);
}

function scoreToken(token: string, titleWords: string[], title: string, subWords: string[], sub: string): number {
  if (titleWords.includes(token)) return 100;
  if (titleWords.some((w) => w.startsWith(token))) return 80;
  if (title.includes(token)) return 60;
  if (subWords.includes(token)) return 40;
  if (subWords.some((w) => w.startsWith(token))) return 30;
  if (sub.includes(token)) return 20;
  return 0;
}

export function tileMatchScore(
  tile: { title: string; subtitle: string },
  query: string,
): number | null {
  const tokens = words(query);
  if (tokens.length === 0) return 0;
  const title = tile.title.toLowerCase();
  const sub = tile.subtitle.toLowerCase();
  const titleWords = words(tile.title);
  const subWords = words(tile.subtitle);

  let total = 0;
  for (const token of tokens) {
    const s = scoreToken(token, titleWords, title, subWords, sub);
    if (s === 0) return null; // every word has to land somewhere
    total += s;
  }
  return total / tokens.length;
}

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
  { key: "Processes", group: "Infrastructure", title: "Processes", subtitle: "PM2", glow: "cyan", icon: (s) => <ProcessesIcon size={s} style={{ color: colors.cyan }} />, action: { page: "processes" } },
  { key: "Deploy", group: "Infrastructure", title: "Deploy", subtitle: "Projects", glow: "pink", icon: (s) => <DeployIcon size={s} style={{ color: colors.pink }} />, action: { page: "deploy" } },
  { key: "Database", group: "Infrastructure", title: "Database", subtitle: "PostgreSQL", glow: "gold", icon: (s) => <DatabaseIcon size={s} style={{ color: colors.gold }} />, action: { page: "database" } },
  { key: "Storage", group: "Infrastructure", title: "Storage", subtitle: "Files", glow: "pink", icon: (s) => <StorageIcon size={s} style={{ color: colors.pink }} />, action: { page: "storage" } },
  { key: "Editor", group: "Build & Design", title: "Editor", subtitle: "Code", glow: "gold", icon: (s) => <EditorIcon size={s} style={{ color: colors.gold }} />, action: { page: "editor" } },
  { key: "Utils", group: "Infrastructure", title: "Utils", subtitle: "Tooling", glow: "cyan", icon: (s) => <UtilsIcon size={s} style={{ color: colors.cyan }} />, action: { page: "utils" } },
  { key: "Villagers", group: "People & Money", title: "Villagers", subtitle: "Members & wallets", glow: "gold", icon: (s) => <MembersIcon size={s} style={{ color: colors.gold }} />, action: { page: "villagers" } },
  { key: "Modules", group: "Build & Design", title: "Modules", subtitle: "Platform surfaces", glow: "violet", icon: (s) => <ModulesIcon size={s} style={{ color: colors.violet }} />, action: { page: "modules" } },
  { key: "Payroll", group: "People & Money", title: "Payroll", subtitle: "Staff hours & rates", glow: "gold", icon: (s) => <CashIcon size={s} style={{ color: colors.gold }} />, action: { page: "payroll" } },
  { key: "Wallet", group: "People & Money", title: "Wallet", subtitle: "TGV business money", glow: "gold", icon: (s) => <CashIcon size={s} style={{ color: colors.gold }} />, action: { page: "wallet" } },
  // Email Campaigns is NOT a top-level tile — it lives inside Modules (Modules tile →
  // Email Campaigns) as a platform module surface. See dashboard/modules/ModulesClient.
  { key: "Claude", group: "Build & Design", title: "Claude", subtitle: "AI Assistant", glow: "orange", icon: (s) => <ClaudeIcon size={s} color={colors.orange} />, action: { event: "open-claude" } },
  { key: "Sandbox", group: "Build & Design", title: "Sandbox", subtitle: "Component Lab", glow: "pink", icon: (s) => <SandboxIcon size={s} color={colors.pink} />, action: { event: "open-sandbox" } },
  { key: "Library", group: "Build & Design", title: "Library", subtitle: "Catalog", glow: "violet", icon: (s) => <LibraryIcon size={s} color={colors.violet} />, action: { event: "open-library" } },
  { key: "Suggest", group: "Records & Notes", title: "Suggest", subtitle: "Feature ideas", glow: "pink", icon: (s) => <SuggestionIcon size={s} style={{ color: colors.pink }} />, action: { event: "open-suggestion" } },
  { key: "FrontDesk", group: "Communication", title: "Front Desk", subtitle: "Calls / SMS / Inquiries", glow: "gold", icon: (s) => <DrawerFrontDeskIcon size={s} style={{ color: colors.gold }} />, action: { drawer: "frontdesk" } },
  { key: "Chats", group: "Communication", title: "Chats", subtitle: "Team messaging", glow: "green", icon: (s) => <DrawerChatsIcon size={s} style={{ color: colors.green }} />, action: { drawer: "chat" } },
  { key: "Inbox", group: "Communication", title: "Inbox", subtitle: "Email", glow: "cyan", icon: (s) => <DrawerInboxIcon size={s} style={{ color: colors.cyan }} />, action: { drawer: "inbox" } },
  { key: "Sessions", group: "Communication", title: "Sessions", subtitle: "Video rooms", glow: "pink", icon: (s) => <DrawerSessionsIcon size={s} style={{ color: colors.pink }} />, action: { drawer: "sessions" } },
  { key: "Logs", group: "Records & Notes", title: "Logs", subtitle: "Recent Activity", glow: "cyan", icon: (s) => <LogsIcon size={s} style={{ color: colors.cyan }} />, action: { event: "open-activity" } },
  { key: "MyAlerts", group: "Records & Notes", title: "My Alerts", subtitle: "Personal reminders", glow: "gold", icon: () => <span style={{ fontSize: 24 }}>🔔</span>, action: { event: "open-my-alerts" } },
  { key: "Diary", group: "Records & Notes", title: "Diary", subtitle: "RCS log", glow: "violet", icon: () => <span style={{ fontSize: 24 }}>📖</span>, action: { event: "open-rcs-diary" } },

  // Menu-only shortcut — jumps straight to the Front Desk drawer's Alerts tab
  // (FrontDeskDrawer treats detail "alerts" as a legacy opener).
  { key: "Alerts", group: "Communication", title: "Alerts", subtitle: "Front Desk alerts", glow: "gold", icon: (s) => <DrawerAlertsIcon size={s} style={{ color: colors.gold }} />, action: { drawer: "alerts" }, inTiles: false },
];

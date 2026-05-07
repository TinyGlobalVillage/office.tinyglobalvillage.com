"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import TopNav from "../../components/TopNav";
import { useTerminal } from "../../components/TerminalProvider";
import SettingsIcon from "../../components/icons/SettingsIcon";
import TelephonyControlModal from "../../components/hardening/telephony/TelephonyControlModal";
import BackupsControlModal from "../../components/backups/BackupsControlModal";
import {
  TinyURLGenerator,
  QRCodeGenerator,
} from "@tgv/module-editor/editor/component-library/marketing/link-tools";
import type { ShortLink } from "@tgv/module-editor/editor/component-library/marketing/link-tools";

/* ── Types ────────────────────────────────────────────────────── */

type FieldValue = string | string[];

type Field = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "select" | "chips" | "toggle";
  options?: { value: string; label: string }[];
  required?: boolean;
  default?: string;
  help?: string;
};

type Action = {
  id: string;
  label: string;
  description: string;
  script: string;
  buildArgs?: (values: Record<string, FieldValue>) => FieldValue[];
  fields?: Field[];
  danger?: boolean;
  confirm?: string;
  glow?: "pink" | "cyan" | "gold" | "red";
};

type Group = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  glow: "pink" | "cyan" | "gold";
  actions: Action[];
};

/* ── Command registry ─────────────────────────────────────────── */

const GROUPS: Group[] = [
  {
    id: "project",
    title: "New Project",
    subtitle: "Scaffold and deploy a complete new project",
    icon: "🚀",
    glow: "pink",
    actions: [
      {
        id: "new-nextjs",
        label: "Launch Next.js Project",
        description: "Full pipeline: port → repo → scaffold → SSL → webhook",
        script: "newclientproject",
        buildArgs: (v) => [v.org === "tgv" ? "-tgv" : "-refusionist", v.domain],
        fields: [
          { key: "org", label: "Organisation", type: "select", options: [{ value: "tgv", label: "TinyGlobalVillage" }, { value: "refusionist", label: "Refusionist" }], required: true },
          { key: "domain", label: "Domain", placeholder: "example.tinyglobalvillage.com", required: true },
        ],
        glow: "pink",
      },
      {
        id: "new-static",
        label: "Launch Static Site",
        description: "NGINX + SSL for a static HTML/CSS/JS site",
        script: "newclientproject-static",
        buildArgs: (v) => [v.org === "tgv" ? "-tgv" : "-refusionist", v.domain],
        fields: [
          { key: "org", label: "Organisation", type: "select", options: [{ value: "tgv", label: "TinyGlobalVillage" }, { value: "refusionist", label: "Refusionist" }], required: true },
          { key: "domain", label: "Domain", placeholder: "static.tinyglobalvillage.com", required: true },
        ],
        glow: "cyan",
      },
    ],
  },
  {
    id: "project-mgmt",
    title: "Project Management",
    subtitle: "Start, stop, or remove deployed projects",
    icon: "⚙️",
    glow: "cyan",
    actions: [
      {
        id: "start-client",
        label: "Start Project",
        description: "Start a project via PM2 on its registered port",
        script: "start-client",
        buildArgs: (v) => [v.domain],
        fields: [{ key: "domain", label: "Domain", placeholder: "project.tinyglobalvillage.com", required: true }],
        glow: "cyan",
      },
      {
        id: "erase-project",
        label: "Erase Project",
        description: "Permanently delete: PM2, NGINX, SSL, GitHub repo, local files",
        script: "erase-project",
        buildArgs: (v) => [v.domain],
        fields: [{ key: "domain", label: "Domain to erase", placeholder: "project.tinyglobalvillage.com", required: true }],
        danger: true,
        confirm: "Type the domain name again to confirm permanent deletion:",
        glow: "red",
      },
    ],
  },
  {
    id: "pm2",
    title: "PM2",
    subtitle: "Process manager — restart, stop, and configure aliases",
    icon: "⚡",
    glow: "gold",
    actions: [
      { id: "pm2-restart", label: "Restart Process", description: "Restart a named PM2 process with updated env", script: "pm2-restart", buildArgs: (v) => ["--update-env", v.name], fields: [{ key: "name", label: "Process name", placeholder: "refusionist.com", required: true }], glow: "cyan" },
      { id: "pm2-stop", label: "Stop Process", description: "Stop a running PM2 process", script: "pm2-stop", buildArgs: (v) => [v.name], fields: [{ key: "name", label: "Process name", placeholder: "refusionist.com", required: true }], glow: "gold" },
      { id: "pm2-logs", label: "View Logs", description: "Tail the last 80 lines of a PM2 process log", script: "pm2-logs", buildArgs: (v) => [v.name], fields: [{ key: "name", label: "Process name", placeholder: "refusionist.com", required: true }], glow: "cyan" },
      { id: "pm2-harden", label: "Harden PM2", description: "Install log rotation (10 MB × 5) + enable startup on reboot", script: "pm2-harden", buildArgs: () => [], glow: "gold" },
      { id: "pm2-newpm2", label: "Add PM2 Alias", description: "Append a pm2-restart shortcut alias to ~/.bashrc", script: "pm2-newpm2", buildArgs: (v) => [v.project, v.shortcut], fields: [{ key: "project", label: "PM2 process name", placeholder: "refusionist.com", required: true }, { key: "shortcut", label: "Alias shortcut", placeholder: "rr", required: true }], glow: "gold" },
      { id: "pm2-editpm2", label: "Edit PM2 Alias", description: "Rename an existing PM2 alias shortcut in ~/.bashrc", script: "pm2-editpm2", buildArgs: (v) => [v.old, v.newName], fields: [{ key: "old", label: "Current shortcut", placeholder: "rr", required: true }, { key: "newName", label: "New shortcut", placeholder: "rrs", required: true }], glow: "gold" },
    ],
  },
  {
    id: "git",
    title: "Git & GitHub",
    subtitle: "Create or remove GitHub repositories",
    icon: "🐙",
    glow: "cyan",
    actions: [
      { id: "gitrepo", label: "Create GitHub Repo", description: "Create a new repo in an org and push initial commit", script: "gitrepo", buildArgs: (v) => [v.org === "tgv" ? "-tgv" : "-u tinygvillage", v.repoName], fields: [{ key: "org", label: "Organisation", type: "select", options: [{ value: "tgv", label: "TinyGlobalVillage" }, { value: "refusionist", label: "tinygvillage" }], required: true }, { key: "repoName", label: "Repository name", placeholder: "my-project", required: true }], glow: "cyan" },
      { id: "gitdelrepo", label: "Delete GitHub Repo", description: "Permanently delete a repository from GitHub", script: "gitdelrepo", buildArgs: (v) => [v.org === "tgv" ? "-TGV" : "-tgv", v.repoName], fields: [{ key: "org", label: "Organisation", type: "select", options: [{ value: "tgv", label: "TinyGlobalVillage" }, { value: "refusionist", label: "tinygvillage" }], required: true }, { key: "repoName", label: "Repository name", placeholder: "my-project", required: true }], danger: true, confirm: "Type the repository name to confirm deletion:", glow: "red" },
    ],
  },
  {
    id: "system",
    title: "System",
    subtitle: "Server health, disk, and maintenance",
    icon: "🖥️",
    glow: "gold",
    actions: [
      { id: "diskusage", label: "Disk Usage", description: "Show disk usage for all key RCS directories", script: "diskusage", buildArgs: () => [], glow: "gold" },
    ],
  },
  {
    id: "domains",
    title: "Domains",
    subtitle: "Domain migration and registrar automation",
    icon: "🌐",
    glow: "cyan",
    actions: [
      {
        id: "domain-cf-migrate",
        label: "Migrate to Cloudflare",
        description: "Move one or more domains onto Cloudflare DNS — creates the zone, imports records, flips nameservers, polls until active. Pick the source registrar.",
        script: "domain-cf-migrate",
        buildArgs: (v) => {
          const ds = (Array.isArray(v.domains) ? v.domains : []) as string[];
          return [
            ...ds,
            "--registrar", String(v.registrar ?? "hostinger"),
            "--import-dns", String(v.importDns ?? "yes"),
            "--update-ns", String(v.updateNs ?? "yes"),
            "--proxy", String(v.proxy ?? "no"),
            "--ssl-mode", String(v.sslMode ?? "full"),
            "--always-https", String(v.alwaysHttps ?? "no"),
            "--wait", String(v.wait ?? "yes"),
          ];
        },
        fields: [
          {
            key: "registrar",
            label: "Source registrar",
            type: "select",
            default: "hostinger",
            options: [
              { value: "hostinger", label: "Hostinger (full API automation)" },
              { value: "godaddy", label: "GoDaddy (API — needs 50+ domain account)" },
              { value: "siteground", label: "SiteGround (manual instructions only)" },
              { value: "cloudflare", label: "Cloudflare Registrar (already on CF)" },
              { value: "manual", label: "Other / Manual (instructions only)" },
            ],
            help: "Hostinger and GoDaddy support automated nameserver flips. SiteGround/Other print copy-pasteable instructions instead.",
          },
          {
            key: "domains",
            label: "Domains",
            type: "chips",
            placeholder: "weartalismanic.com, sewcialarts.com",
            required: true,
            help: "Type a domain and press Enter, or paste a comma-separated list",
          },
          {
            key: "importDns",
            label: "Import DNS records from source",
            type: "toggle",
            default: "yes",
          },
          {
            key: "updateNs",
            label: "Update nameservers at source registrar",
            type: "toggle",
            default: "yes",
            help: "If the registrar has no API or your token lacks access, prints manual instructions instead.",
          },
          {
            key: "proxy",
            label: "Proxy A/AAAA/CNAME (orange cloud)",
            type: "toggle",
            default: "yes",
            help: "Recommended on for normal web domains — DDoS protection, hides origin IP, edge SSL. Off only if origin needs raw client IP or non-HTTP traffic.",
          },
          {
            key: "sslMode",
            label: "SSL/TLS mode",
            type: "select",
            default: "full",
            options: [
              { value: "off", label: "Off" },
              { value: "flexible", label: "Flexible" },
              { value: "full", label: "Full" },
              { value: "strict", label: "Full (strict)" },
            ],
          },
          {
            key: "alwaysHttps",
            label: "Always Use HTTPS",
            type: "toggle",
            default: "no",
          },
          {
            key: "wait",
            label: "Wait for activation (poll up to 10 min)",
            type: "toggle",
            default: "yes",
          },
        ],
        glow: "cyan",
      },
      {
        id: "opensrs-domain-purchase",
        label: "Buy domain (OpenSRS) — placeholder",
        description: "Look up availability + price for a domain via OpenSRS. Full purchase flow not yet implemented (use OpenSRS RCP for now). Then run Migrate to Cloudflare.",
        script: "opensrs-domain-purchase",
        buildArgs: (v) => [String(v.domain ?? ""), "--lookup-only", "yes"],
        fields: [
          {
            key: "domain",
            label: "Domain to look up",
            type: "text",
            placeholder: "example.com",
            required: true,
            help: "Returns availability + price quote. Purchase flow is stubbed — wire up contact-set + period UI to complete.",
          },
        ],
        glow: "gold",
      },
    ],
  },
  {
    id: "mail",
    title: "Mail",
    subtitle: "Mail provider domain + folder + alias setup",
    icon: "✉️",
    glow: "pink",
    actions: [
      {
        id: "mail-domain-setup",
        label: "Set up domain on Fastmail",
        description: "Auto-add Cloudflare DNS records (MX/DKIM/SPF/DMARC), create folder + send-as identity in your Fastmail account, print manual deeplinks for the steps Fastmail's API doesn't expose (add domain, filter rule).",
        script: "mail-domain-setup",
        buildArgs: (v) => {
          // Skip empty optional flags — the exec route's SAFE_ARG rejects empty
          // strings, and the script handles missing flags as defaults itself.
          const args: FieldValue[] = [String(v.domain ?? "")];
          const push = (flag: string, val: FieldValue | undefined) => {
            const s = val == null ? "" : String(val);
            if (s !== "") args.push(flag, s);
          };
          push("--provider", v.provider ?? "fastmail:gio");
          push("--primary-local", v.primaryLocal ?? "hello");
          push("--display-name", v.displayName);
          push("--folder-name", v.folderName ?? v.domain);
          push("--folder-parent", v.folderParent);
          push("--folder-color", v.folderColor ?? "default");
          push("--folder-sidebar", v.folderSidebar ?? "always");
          push("--folder-purge-days", v.folderPurgeDays ?? "0");
          push("--folder-autopurge", v.folderAutoPurge ?? "no");
          push("--folder-autolearn", v.folderAutoLearn ?? "no");
          push("--folder-learn-as", v.folderLearnAs ?? "spam");
          push("--auto-dns", v.autoDns ?? "yes");
          push("--dmarc-policy", v.dmarcPolicy ?? "none");
          push("--dmarc-rua", v.dmarcRua);
          push("--skip-folder", v.skipFolder ?? "no");
          push("--skip-identity", v.skipIdentity ?? "no");
          return args;
        },
        fields: [
          {
            key: "provider",
            label: "Mail provider + account",
            type: "select",
            default: "fastmail:gio",
            options: [
              { value: "fastmail:gio", label: "Fastmail — Gio (gio@tinyglobalvillage.com)" },
              { value: "fastmail:marmar", label: "Fastmail — Marmar" },
              { value: "oma", label: "Other Mail Account (placeholder)" },
            ],
            help: "Each FASTMAIL_TOKEN_<NAME> env var becomes a selectable account. Add new ones in .env.local to extend.",
          },
          {
            key: "domain",
            label: "Domain",
            type: "text",
            placeholder: "weartalismanic.com",
            required: true,
            help: "Must already be set up as a Cloudflare zone (run Migrate to Cloudflare first if not).",
          },
          {
            key: "primaryLocal",
            label: "Primary email — local part",
            type: "text",
            default: "hello",
            help: "Becomes the send-as identity (e.g. hello@weartalismanic.com).",
          },
          {
            key: "displayName",
            label: "Display name for identity",
            type: "text",
            placeholder: "Gio Coelho",
          },
          {
            key: "folderName",
            label: "Folder name",
            type: "text",
            placeholder: "(defaults to the domain)",
            help: "Folder to create in your mailbox. Defaults to the domain name.",
          },
          {
            key: "folderParent",
            label: "Parent folder (optional)",
            type: "text",
            placeholder: "(root)",
            help: "Name of an existing folder to nest under. Leave empty for root.",
          },
          {
            key: "folderColor",
            label: "Folder color",
            type: "select",
            default: "default",
            options: [
              { value: "default", label: "Default" },
              { value: "red", label: "Red" },
              { value: "orange", label: "Orange" },
              { value: "yellow", label: "Yellow" },
              { value: "green", label: "Green" },
              { value: "teal", label: "Teal" },
              { value: "blue", label: "Blue" },
              { value: "purple", label: "Purple" },
              { value: "pink", label: "Pink" },
              { value: "gray", label: "Gray" },
            ],
          },
          {
            key: "folderSidebar",
            label: "Show in sidebar",
            type: "select",
            default: "always",
            options: [
              { value: "always", label: "Always show" },
              { value: "ifUnread", label: "Hide if no unread" },
              { value: "ifNonEmpty", label: "Hide if empty" },
              { value: "never", label: "Always hide" },
            ],
          },
          {
            key: "folderPurgeDays",
            label: "Permanently delete unpinned messages after (days)",
            type: "text",
            default: "0",
            help: "0 = never. Common values: 31, 90, 365.",
          },
          {
            key: "folderAutopurge",
            label: "Auto-purge enabled",
            type: "toggle",
            default: "no",
          },
          {
            key: "folderAutolearn",
            label: "Scan folder daily and learn new messages",
            type: "toggle",
            default: "no",
          },
          {
            key: "folderLearnAs",
            label: "Learn-as (when scan enabled)",
            type: "select",
            default: "spam",
            options: [
              { value: "spam", label: "as spam" },
              { value: "ham", label: "as not spam" },
            ],
          },
          {
            key: "autoDns",
            label: "Auto-add DNS records to Cloudflare",
            type: "toggle",
            default: "yes",
            help: "Adds 2 MX, 3 DKIM CNAMEs, SPF TXT, DMARC TXT (7 records total).",
          },
          {
            key: "dmarcPolicy",
            label: "DMARC policy",
            type: "select",
            default: "none",
            options: [
              { value: "none", label: "p=none (collect reports only)" },
              { value: "quarantine", label: "p=quarantine" },
              { value: "reject", label: "p=reject" },
            ],
            help: "Start with p=none to verify SPF/DKIM align before tightening.",
          },
          {
            key: "dmarcRua",
            label: "DMARC report destination (rua)",
            type: "text",
            placeholder: "(defaults to postmaster@<domain>)",
          },
          {
            key: "skipFolder",
            label: "Skip folder creation",
            type: "toggle",
            default: "no",
          },
          {
            key: "skipIdentity",
            label: "Skip identity creation",
            type: "toggle",
            default: "no",
          },
        ],
        glow: "pink",
      },
    ],
  },
];

const GLOW_COLOR: Record<string, string> = {
  pink: colors.pink,
  cyan: colors.cyan,
  gold: colors.gold,
  red: colors.red,
};

/* ── Styled Components ─────────────────────────────────────────── */

const PageMain = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 7rem 1rem 8rem;
  max-width: 72rem;
  margin: 0 auto;
  width: 100%;
  gap: 1.25rem;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
`;

const PageSubtitle = styled.p`
  font-size: 0.875rem;
  color: var(--t-textGhost);

  [data-theme="light"] & {
    color: var(--t-textFaint);
  }
`;

const TerminalShortcut = styled.button<{ $running: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-family: monospace;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  background: var(--t-inputBg);
  border: 1px solid ${(p) => (p.$running ? `${colors.gold}` : `rgba(${rgb.pink}, 0.3)`)};
  color: ${(p) => (p.$running ? colors.gold : colors.pink)};

  [data-theme="light"] & {
    background: var(--t-surface);
  }
`;

const TerminalLineCount = styled.span`
  color: var(--t-textGhost);
`;

const GroupsColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const GroupWrap = styled.div<{ $color: string }>`
  border-radius: 1rem;
  overflow: hidden;
  background: linear-gradient(44deg, hsla(190, 100%, 12%, 0.4), rgba(0, 0, 0, 0.8));
  border: 1px solid ${(p) => p.$color}22;

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: ${(p) => p.$color}33;
  }
`;

const GroupHeader = styled.button<{ $color: string }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  text-align: left;
  background: transparent;
  border: none;
  cursor: pointer;
`;

const GroupIcon = styled.span`
  font-size: 1.5rem;
`;

const GroupTitle = styled.div<{ $color: string }>`
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${(p) => p.$color};
`;

const GroupSubtitle = styled.div`
  font-size: 0.75rem;
  color: var(--t-textGhost);
  margin-top: 0.125rem;
`;

const GroupToggle = styled.span<{ $open: boolean }>`
  font-size: 0.75rem;
  color: var(--t-textGhost);
  transition: transform 0.2s;
  transform: ${(p) => (p.$open ? "rotate(180deg)" : "rotate(0deg)")};
`;

const GroupBody = styled.div<{ $color: string }>`
  padding: 0 1rem 1rem;
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  border-top: 1px solid ${(p) => p.$color}18;
`;

const ActionCardWrap = styled.div<{ $danger?: boolean; $color: string }>`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border-radius: 0.75rem;
  padding: 1rem;
  margin-top: 0.75rem;
  transition: all 0.2s;
  background: ${(p) => (p.$danger ? `rgba(${rgb.red}, 0.06)` : "var(--t-inputBg)")};
  border: 1px solid ${(p) => (p.$danger ? `${colors.red}22` : `${p.$color}22`)};

  [data-theme="light"] & {
    background: ${(p) => (p.$danger ? `rgba(${rgb.red}, 0.04)` : "var(--t-surface)")};
  }
`;

const ActionLabel = styled.div<{ $danger?: boolean; $color: string }>`
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
  color: ${(p) => (p.$danger ? colors.red : p.$color)};
`;

const ActionDesc = styled.p`
  font-size: 0.75rem;
  color: var(--t-textMuted);
  line-height: 1.625;
`;

const ActionTriggerBtn = styled.button<{ $danger?: boolean; $color: string }>`
  align-self: flex-start;
  padding: 0.375rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 0.15s;
  cursor: pointer;
  border: none;
  background: ${(p) =>
    p.$danger
      ? `linear-gradient(to right, ${colors.red}, #cc0000)`
      : `linear-gradient(to right, ${p.$color}cc, ${p.$color}88)`};
  color: ${(p) => (p.$danger ? "#fff" : "#0a0a0a")};
  box-shadow: ${(p) => `0 0 10px ${p.$color}44`};

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

/* Form modal */

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: var(--t-overlay, rgba(0, 0, 0, 0.75));
`;

const ModalContent = styled.div<{ $color: string }>`
  width: 100%;
  max-width: 28rem;
  max-height: calc(100vh - 2rem);
  border-radius: 1rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: linear-gradient(44deg, hsl(190, 100%, 10%), #0a0a0a);
  border: 1px solid ${(p) => p.$color}44;
  box-shadow: 0 0 40px ${(p) => p.$color}22;

  [data-theme="light"] & {
    background: var(--t-surface);
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.15);
  }
`;

const ModalScrollBody = styled.div<{ $color: string }>`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  margin: 0 -0.5rem;
  padding: 0 0.5rem;

  /* themed thin scrollbar — accent on transparent track */
  scrollbar-width: thin;
  scrollbar-color: ${(p) => p.$color}66 transparent;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: ${(p) => p.$color}44;
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: ${(p) => p.$color}88;
  }
`;

const ModalTitle = styled.h3<{ $color: string }>`
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.25rem;
  color: ${(p) => p.$color};
`;

const ModalDesc = styled.p`
  font-size: 0.75rem;
  color: var(--t-textMuted);
`;

const FieldLabel = styled.label`
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--t-textMuted);
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const StyledInput = styled.input<{ $color: string }>`
  width: 100%;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  outline: none;
  background: var(--t-inputBg);
  border: 1px solid ${(p) => p.$color}33;
  color: var(--t-text);

  &::placeholder {
    color: var(--t-textGhost);
  }
`;

const StyledSelect = styled.select<{ $color: string }>`
  width: 100%;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  outline: none;
  background: var(--t-inputBg);
  border: 1px solid ${(p) => p.$color}33;
  color: var(--t-text);
`;

const ConfirmLabel = styled.label`
  font-size: 0.75rem;
  color: ${colors.red};
`;

const ConfirmInput = styled.input`
  width: 100%;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-family: monospace;
  outline: none;
  background: rgba(${rgb.red}, 0.08);
  border: 1px solid rgba(${rgb.red}, 0.3);
  color: var(--t-text);

  &::placeholder {
    color: var(--t-textGhost);
  }
`;

const ModalButtons = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 0.25rem;
`;

const CancelBtn = styled.button`
  flex: 1;
  padding: 0.5rem 0;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--t-textMuted);
  border: 1px solid var(--t-borderStrong);
  background: transparent;
  cursor: pointer;
  transition: color 0.15s;

  &:hover {
    color: var(--t-text);
  }
`;

const RunBtn = styled.button<{ $danger?: boolean; $color: string }>`
  flex: 1;
  padding: 0.5rem 0;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  background: ${(p) =>
    p.$danger
      ? `linear-gradient(to right, ${colors.red}, #cc0000)`
      : `linear-gradient(to right, ${p.$color}dd, ${p.$color}99)`};
  color: ${(p) => (p.$danger ? "#fff" : "#0a0a0a")};
  box-shadow: ${(p) => `0 0 12px ${p.$color}44`};

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

/* ── Chips input + Lightswitch (custom field types) ───────────── */

const ChipsRoot = styled.div<{ $color: string }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  width: 100%;
  border-radius: 0.5rem;
  padding: 0.4rem 0.5rem;
  outline: none;
  cursor: text;
  min-height: 2.25rem;
  transition: border-color 0.15s;
  background: var(--t-inputBg);
  border: 1px solid ${(p) => p.$color}33;

  &:focus-within {
    border-color: ${(p) => p.$color}77;
  }
`;

const Chip = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.5rem;
  font-size: 0.7rem;
  font-family: monospace;
  background: ${(p) => p.$color}22;
  border: 1px solid ${(p) => p.$color}55;
  color: ${(p) => p.$color};
`;

const ChipX = styled.button<{ $color: string }>`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0 0.125rem;
  font-size: 0.85rem;
  line-height: 1;
  color: ${(p) => p.$color};

  &:hover {
    color: var(--t-text);
  }
`;

const ChipsInputField = styled.input`
  flex: 1;
  min-width: 6rem;
  background: transparent;
  border: none;
  outline: none;
  padding: 0.125rem 0.25rem;
  font-size: 0.75rem;
  color: var(--t-text);

  &::placeholder {
    color: var(--t-textGhost);
  }
`;

function ChipsInput({
  values,
  color,
  placeholder,
  onChange,
}: {
  values: string[];
  color: string;
  placeholder?: string;
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const normalize = (raw: string) =>
    raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");

  const commit = (raw: string) => {
    const t = normalize(raw);
    if (!t) return;
    if (values.includes(t)) return;
    onChange([...values, t]);
  };

  const flush = () => {
    if (!input.trim()) return;
    commit(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      flush();
    } else if (e.key === "Backspace" && !input && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes(",") && !text.includes("\n") && !text.includes(" ")) return;
    e.preventDefault();
    const parts = text.split(/[,\s\n]+/);
    const next = [...values];
    for (const p of parts) {
      const t = normalize(p);
      if (t && !next.includes(t)) next.push(t);
    }
    onChange(next);
  };

  return (
    <ChipsRoot $color={color} onClick={() => inputRef.current?.focus()}>
      {values.map((v) => (
        <Chip key={v} $color={color}>
          <span>{v}</span>
          <ChipX
            $color={color}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(values.filter((x) => x !== v));
            }}
            aria-label={`Remove ${v}`}
          >
            ×
          </ChipX>
        </Chip>
      ))}
      <ChipsInputField
        ref={inputRef}
        value={input}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(",")) {
            commit(v.slice(0, -1));
            setInput("");
          } else {
            setInput(v);
          }
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={flush}
        placeholder={values.length === 0 ? placeholder : ""}
      />
    </ChipsRoot>
  );
}

const LSTrack = styled.button<{ $on: boolean; $color: string }>`
  appearance: none;
  border: none;
  cursor: pointer;
  position: relative;
  width: 38px;
  height: 20px;
  border-radius: 10px;
  flex-shrink: 0;
  transition: all 0.25s ease;
  background: ${(p) =>
    p.$on
      ? `linear-gradient(90deg, ${p.$color}55, ${p.$color}22)`
      : "rgba(120,120,120,0.2)"};
  box-shadow: ${(p) =>
    p.$on
      ? `inset 0 0 6px ${p.$color}33, 0 0 8px ${p.$color}22`
      : "inset 0 1px 3px rgba(0,0,0,0.2)"};

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${(p) => p.$color}44;
  }
`;

const LSKnob = styled.div<{ $on: boolean; $color: string }>`
  position: absolute;
  top: 2px;
  left: ${(p) => (p.$on ? "20px" : "2px")};
  width: 16px;
  height: 16px;
  border-radius: 50%;
  transition: all 0.25s ease;
  background: ${(p) =>
    p.$on
      ? `radial-gradient(circle at 40% 35%, ${p.$color}ee, ${p.$color}, ${p.$color}88)`
      : "radial-gradient(circle at 40% 35%, #888, #555)"};
  box-shadow: ${(p) =>
    p.$on
      ? `0 0 8px ${p.$color}80, 0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)`
      : "0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)"};
`;

function Lightswitch({
  on,
  color,
  onChange,
}: {
  on: boolean;
  color: string;
  onChange: (on: boolean) => void;
}) {
  return (
    <LSTrack $on={on} $color={color} type="button" onClick={() => onChange(!on)}>
      <LSKnob $on={on} $color={color} />
    </LSTrack>
  );
}

const ToggleRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.25rem 0;
`;

const ToggleLabelCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  flex: 1;
`;

const FieldHelp = styled.div`
  font-size: 0.65rem;
  color: var(--t-textGhost);
  line-height: 1.4;
`;

/* ── Group panel component ─────────────────────────────────────── */

function GroupPanel({
  group, isAdmin, overlay, onSaveDefaults,
}: {
  group: Group;
  isAdmin: boolean;
  overlay: Record<string, Record<string, FieldValue>>;
  onSaveDefaults: (actionId: string, defaults: Record<string, FieldValue>) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const color = GLOW_COLOR[group.glow];

  return (
    <GroupWrap $color={color}>
      <GroupHeader $color={color} onClick={() => setOpen((p) => !p)}>
        <GroupIcon>{group.icon}</GroupIcon>
        <div style={{ flex: 1 }}>
          <GroupTitle $color={color}>{group.title}</GroupTitle>
          <GroupSubtitle>{group.subtitle}</GroupSubtitle>
        </div>
        <GroupToggle $open={open}>▼</GroupToggle>
      </GroupHeader>

      {open && (
        <GroupBody $color={color}>
          {group.actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              isAdmin={isAdmin}
              overrides={overlay[action.id] ?? {}}
              onSaveDefaults={(d) => onSaveDefaults(action.id, d)}
            />
          ))}
        </GroupBody>
      )}
    </GroupWrap>
  );
}

/* ── Action card component ─────────────────────────────────────── */

function ActionCard({
  action, isAdmin, overrides, onSaveDefaults,
}: {
  action: Action;
  isAdmin: boolean;
  overrides: Record<string, FieldValue>;
  onSaveDefaults: (defaults: Record<string, FieldValue>) => Promise<void>;
}) {
  const { runCommand, isRunning } = useTerminal();
  const [showForm, setShowForm] = useState(false);
  const [showDefaults, setShowDefaults] = useState(false);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [confirmValue, setConfirmValue] = useState("");
  const color = GLOW_COLOR[action.glow ?? "cyan"];

  const computeDefaults = (): Record<string, FieldValue> => {
    const defaults: Record<string, FieldValue> = {};
    for (const f of action.fields ?? []) {
      if (f.key in overrides) {
        defaults[f.key] = overrides[f.key];
        continue;
      }
      if (f.type === "chips") {
        defaults[f.key] = [];
      } else if (f.default !== undefined) {
        defaults[f.key] = f.default;
      } else if (f.type === "select" && f.options?.length) {
        defaults[f.key] = f.options[0].value;
      } else if (f.type === "toggle") {
        defaults[f.key] = "no";
      } else {
        defaults[f.key] = "";
      }
    }
    return defaults;
  };

  const initDefaults = () => {
    setValues(computeDefaults());
    setConfirmValue("");
  };

  const flatten = (arr: FieldValue[]): string[] => arr.flat().map(String);

  const handleTrigger = () => {
    if (action.fields && action.fields.length > 0) {
      initDefaults();
      setShowForm(true);
    } else {
      runCommand(action.script, flatten(action.buildArgs?.({}) ?? []));
    }
  };

  const handleRun = () => {
    const args = flatten(action.buildArgs ? action.buildArgs(values) : []);
    if (action.confirm) {
      const expectedKey = Object.keys(values)[0];
      const expected = values[expectedKey];
      const expectedStr = Array.isArray(expected) ? expected.join(",") : expected;
      if (confirmValue !== expectedStr) {
        alert("Confirmation did not match. Aborted.");
        return;
      }
    }
    setShowForm(false);
    runCommand(action.script, args);
  };

  const canRun = (action.fields ?? [])
    .filter((f) => f.required)
    .every((f) => {
      const v = values[f.key];
      if (Array.isArray(v)) return v.length > 0;
      return typeof v === "string" && v.trim().length > 0;
    });

  const showGear = isAdmin && (action.fields?.length ?? 0) > 0;

  return (
    <>
      <ActionCardWrap $danger={action.danger} $color={color}>
        <ActionTopRow>
          <div>
            <ActionLabel $danger={action.danger} $color={color}>{action.label}</ActionLabel>
            <ActionDesc>{action.description}</ActionDesc>
          </div>
          {showGear && (
            <GearBtn
              $color={color}
              type="button"
              onClick={() => setShowDefaults(true)}
              title="Edit default values (admin only)"
              aria-label="Edit defaults"
            >
              <SettingsIcon size={14} />
            </GearBtn>
          )}
        </ActionTopRow>
        <ActionTriggerBtn
          $danger={action.danger}
          $color={color}
          onClick={handleTrigger}
          disabled={isRunning}
        >
          {isRunning ? "Busy…" : action.fields?.length ? "Configure →" : "Run →"}
        </ActionTriggerBtn>
      </ActionCardWrap>

      {showForm && (
        <FormModal
          action={action}
          values={values}
          confirmValue={confirmValue}
          canRun={canRun}
          onChange={(k, v) => setValues((prev) => ({ ...prev, [k]: v }))}
          onConfirmChange={setConfirmValue}
          onRun={handleRun}
          onClose={() => setShowForm(false)}
        />
      )}

      {showDefaults && (
        <DefaultsEditModal
          action={action}
          initial={computeDefaults()}
          onSave={(next) => onSaveDefaults(next)}
          onClose={() => setShowDefaults(false)}
        />
      )}
    </>
  );
}

/* ── Field renderer (shared by FormModal + DefaultsEditModal) ──── */

function renderField(
  field: Field,
  values: Record<string, FieldValue>,
  color: string,
  onChange: (k: string, v: FieldValue) => void,
) {
  const raw = values[field.key];
  if (field.type === "toggle") {
    const on = raw === "yes";
    return (
      <ToggleRow key={field.key}>
        <ToggleLabelCol>
          <FieldLabel>{field.label}</FieldLabel>
          {field.help && <FieldHelp>{field.help}</FieldHelp>}
        </ToggleLabelCol>
        <Lightswitch
          on={on}
          color={color}
          onChange={(next) => onChange(field.key, next ? "yes" : "no")}
        />
      </ToggleRow>
    );
  }
  if (field.type === "chips") {
    const arr = Array.isArray(raw) ? raw : [];
    return (
      <FieldGroup key={field.key}>
        <FieldLabel>{field.label}</FieldLabel>
        <ChipsInput
          values={arr}
          color={color}
          placeholder={field.placeholder}
          onChange={(next) => onChange(field.key, next)}
        />
        {field.help && <FieldHelp>{field.help}</FieldHelp>}
      </FieldGroup>
    );
  }
  if (field.type === "select") {
    const v = typeof raw === "string" ? raw : "";
    return (
      <FieldGroup key={field.key}>
        <FieldLabel>{field.label}</FieldLabel>
        <StyledSelect
          $color={color}
          value={v}
          onChange={(e) => onChange(field.key, e.target.value)}
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </StyledSelect>
        {field.help && <FieldHelp>{field.help}</FieldHelp>}
      </FieldGroup>
    );
  }
  const v = typeof raw === "string" ? raw : "";
  return (
    <FieldGroup key={field.key}>
      <FieldLabel>{field.label}</FieldLabel>
      <StyledInput
        $color={color}
        type="text"
        value={v}
        onChange={(e) => onChange(field.key, e.target.value)}
        placeholder={field.placeholder}
      />
      {field.help && <FieldHelp>{field.help}</FieldHelp>}
    </FieldGroup>
  );
}

/* ── Form modal component ──────────────────────────────────────── */

function FormModal({
  action, values, confirmValue, canRun, onChange, onConfirmChange, onRun, onClose,
}: {
  action: Action;
  values: Record<string, FieldValue>;
  confirmValue: string;
  canRun: boolean;
  onChange: (k: string, v: FieldValue) => void;
  onConfirmChange: (v: string) => void;
  onRun: () => void;
  onClose: () => void;
}) {
  const color = GLOW_COLOR[action.glow ?? "cyan"];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContent $color={color}>
        <div>
          <ModalTitle $color={color}>{action.label}</ModalTitle>
          <ModalDesc>{action.description}</ModalDesc>
        </div>

        <ModalScrollBody $color={color}>
          {(action.fields ?? []).map((f) => renderField(f, values, color, onChange))}

          {action.confirm && (
            <FieldGroup>
              <ConfirmLabel>{action.confirm}</ConfirmLabel>
              <ConfirmInput
                type="text"
                value={confirmValue}
                onChange={(e) => onConfirmChange(e.target.value)}
                placeholder="Type to confirm…"
              />
            </FieldGroup>
          )}
        </ModalScrollBody>

        <ModalButtons>
          <CancelBtn onClick={onClose}>Cancel</CancelBtn>
          <RunBtn $danger={action.danger} $color={color} onClick={onRun} disabled={!canRun}>
            {action.danger ? "⚠ Run Anyway" : "▶ Run"}
          </RunBtn>
        </ModalButtons>
      </ModalContent>
    </ModalOverlay>
  );
}

/* ── Defaults edit modal (admin-only) ──────────────────────────── */

function DefaultsEditModal({
  action, initial, onSave, onClose,
}: {
  action: Action;
  initial: Record<string, FieldValue>;
  onSave: (next: Record<string, FieldValue>) => Promise<void> | void;
  onClose: () => void;
}) {
  const color = GLOW_COLOR[action.glow ?? "cyan"];
  const [values, setValues] = useState<Record<string, FieldValue>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(values);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Required fields aren't relevant for defaults — admin can leave them empty
  // and per-run they'll still be required at runtime.
  const fields = (action.fields ?? []).filter((f) => f.type !== "chips");

  return (
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContent $color={color}>
        <div>
          <ModalTitle $color={color}>Edit defaults — {action.label}</ModalTitle>
          <ModalDesc>
            Admin-only. Sets the values that pre-fill this tool&apos;s form for everyone. Per-run overrides still work.
          </ModalDesc>
        </div>

        <ModalScrollBody $color={color}>
          {fields.map((f) =>
            renderField(f, values, color, (k, v) => setValues((prev) => ({ ...prev, [k]: v })))
          )}

          {error && <FieldHelp style={{ color: colors.red }}>{error}</FieldHelp>}
        </ModalScrollBody>

        <ModalButtons>
          <CancelBtn onClick={onClose} disabled={saving}>Cancel</CancelBtn>
          <RunBtn $color={color} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save defaults"}
          </RunBtn>
        </ModalButtons>
      </ModalContent>
    </ModalOverlay>
  );
}

const GearBtn = styled.button<{ $color: string }>`
  background: transparent;
  border: 1px solid ${(p) => p.$color}33;
  color: ${(p) => p.$color}cc;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.375rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;

  &:hover {
    border-color: ${(p) => p.$color}77;
    color: ${(p) => p.$color};
    box-shadow: 0 0 8px ${(p) => p.$color}33;
  }
`;

const ActionTopRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
`;

/* ── Action lookup + ADL surface component ────────────────────────────── */

const ACTIONS_BY_ID: Map<string, Action> = new Map();
for (const g of GROUPS) for (const a of g.actions) ACTIONS_BY_ID.set(a.id, a);

type UtilsAdlSurfaceProps = {
  sections: Section[];
  actionsById: Map<string, Action>;
  isAdmin: boolean;
  overlay: Record<string, Record<string, FieldValue>>;
  onSaveDefaults: (actionId: string, defaults: Record<string, FieldValue>) => Promise<void>;
  onOpenBackups: () => void;
  onOpenHardening: (kind: HardeningKind) => void;
  onOpenLinkTool: (kind: LinkTool) => void;
};

function UtilsAdlSurface({
  sections, actionsById, isAdmin, overlay, onSaveDefaults,
  onOpenBackups, onOpenHardening, onOpenLinkTool,
}: UtilsAdlSurfaceProps) {
  // Default open per ADL rule. Operator can collapse what they don't care about.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.id, true]))
  );

  // TSG Collapse-All Lightswitch — ON when every section is open.
  const allOpen = sections.every((s) => openMap[s.id] ?? true);
  const setAll = (next: boolean) => {
    setOpenMap(Object.fromEntries(sections.map((s) => [s.id, next])));
  };

  return (
    <ParentTile>
      <ParentHeader
        role="button"
        tabIndex={0}
        aria-label={allOpen ? "Collapse all sections" : "Expand all sections"}
        onClick={() => setAll(!allOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAll(!allOpen); }
        }}
      >
        <AdlSwitchTrack $on={allOpen} aria-hidden="true">
          <AdlSwitchThumb $on={allOpen} />
        </AdlSwitchTrack>
        <ParentTitle $allOpen={allOpen}>
          {allOpen ? "All sections expanded" : "All sections collapsed"}
        </ParentTitle>
        <ParentHint>click row to {allOpen ? "collapse" : "expand"} all</ParentHint>
      </ParentHeader>

      {sections.map((section) => {
        const open = openMap[section.id] ?? true;
        const accent: SectionAccent = section.accent;
        const count =
          section.kind === "actions" ? section.actionIds.length :
          section.kind === "tiles"   ? section.tiles.length :
          0;

        return (
          <AdlSectionTile key={section.id} $accent={accent} $open={open}>
            <AdlHeader
              type="button"
              $open={open}
              $accent={accent}
              aria-expanded={open}
              onClick={() => setOpenMap((p) => ({ ...p, [section.id]: !open }))}
            >
              <AdlLabel>
                <AdlLabelMain>{section.title}</AdlLabelMain>
                {section.subtitle && <AdlLabelSub>{section.subtitle}</AdlLabelSub>}
              </AdlLabel>
              {section.kind === "placeholder"
                ? <AdlCountSoon $accent={accent}>soon</AdlCountSoon>
                : <AdlCount $accent={accent}>{count}</AdlCount>}
              <AdlSwitchTrack $on={open} $accent={accent} aria-hidden="true">
                <AdlSwitchThumb $on={open} $accent={accent} />
              </AdlSwitchTrack>
            </AdlHeader>

            <AdlBody $open={open} $accent={accent}>
              {section.kind === "placeholder" && (
                <PlaceholderBody $accent={accent}>{section.hint}</PlaceholderBody>
              )}

              {section.kind === "tiles" && (
                <HardeningGrid>
                  {section.tiles.map((tile, i) => {
                    if (tile.type === "backups") return (
                      <HardeningTile key={i} type="button" onClick={onOpenBackups}>
                        <HardeningTileTop>💾 Backups</HardeningTileTop>
                        <HardeningTileSub>
                          Off-site backup pipeline — rsync.net Lifetime 1 TB Zurich, restic over
                          SFTP, GPG-encrypted secrets. Account info, connection state, last-run
                          history, snapshot count, retention policy.
                        </HardeningTileSub>
                      </HardeningTile>
                    );
                    if (tile.type === "telephony") return (
                      <HardeningTile key={i} type="button" onClick={() => onOpenHardening("telephony")}>
                        <HardeningTileTop>📞 Telephony</HardeningTileTop>
                        <HardeningTileSub>
                          SIP trunk killswitch, fail2ban jail, dialplan auth gate, ringing
                          rate-limit, SIP-attack watch, Telnyx alerts. RCS-wide UFW + fail2ban
                          views included.
                        </HardeningTileSub>
                      </HardeningTile>
                    );
                    if (tile.type === "tinyurl") return (
                      <LinkToolsTile key={i} type="button" onClick={() => onOpenLinkTool("tinyurl")}>
                        <LinkToolsTileTop>🔗 TinyURL Generator</LinkToolsTileTop>
                        <LinkToolsTileSub>
                          Create custom short links on links.tinyglobalvillage.com. Personal or shared TGV
                          Office bucket. Tags, expiry, click counts, rename, delete. Free — storage only.
                        </LinkToolsTileSub>
                      </LinkToolsTile>
                    );
                    if (tile.type === "qrcode") return (
                      <LinkToolsTile key={i} type="button" onClick={() => onOpenLinkTool("qrcode")}>
                        <LinkToolsTileTop>▦ QR Code Generator</LinkToolsTileTop>
                        <LinkToolsTileSub>
                          Live preview, multi-size PNG + vector SVG download. Shows the QR version so you
                          know when to shorten further for small flyers. Fully client-side, free.
                        </LinkToolsTileSub>
                      </LinkToolsTile>
                    );
                    return null;
                  })}
                </HardeningGrid>
              )}

              {section.kind === "actions" && (
                <ActionsGrid>
                  {section.actionIds.map((id) => {
                    const action = actionsById.get(id);
                    if (!action) return null;
                    return (
                      <ActionCard
                        key={action.id}
                        action={action}
                        isAdmin={isAdmin}
                        overrides={overlay[action.id] ?? {}}
                        onSaveDefaults={(d) => onSaveDefaults(action.id, d)}
                      />
                    );
                  })}
                </ActionsGrid>
              )}
            </AdlBody>
          </AdlSectionTile>
        );
      })}
    </ParentTile>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */

type DefaultsOverlay = Record<string, Record<string, FieldValue>>;

// ── Hardening tiles (admin-only "System Hardening" group on Utils) ────────
//
// Pattern: ~/.claude/CLAUDE.md §"Hardening UTILS Surfaces". Each tile here
// represents one defensive mechanism we've installed on RCS — clicking
// opens its HardeningControlModal. New hardenings get a new tile + a new
// `kind` value below.

type HardeningKind = "telephony";  // | "postgres" | "ssh" | "nginx" — future

// ── Link Tools (TinyURL + QR generators) ──────────────────────────────────
//
// Pattern: `packages/@tgv/module-editor/.../marketing/link-tools/`. Both
// modals are paired — the QR button on a TinyURL row hands its short URL
// straight into the QR modal so the resulting QR drops from a dense
// ~77×77 grid to a printable ~25×25.

type LinkTool = "tinyurl" | "qrcode";

const LINKS_ORIGIN =
  process.env.NEXT_PUBLIC_LINKS_ORIGIN || "https://links.tinyglobalvillage.com";

// ── ADL sections — alphabetical operator surface ─────────────────────────
//
// Vocabulary: ADL (Accordion Dropdown with Lightswitch). One accent per
// surface (pink) — individual tiles + action cards keep their own per-item
// glow inside the body. Placeholders flag categories with no live tooling
// yet so operators can see the structural roadmap.
//
// Adding a section: pick the alphabetically correct slot. Adding actions
// to an existing section: add the action to GROUPS above (preserves field
// definitions and modal wiring) then reference its id in the section's
// actionIds list.

type TileSpec =
  | { type: "backups" }
  | { type: "telephony" }
  | { type: "tinyurl" }
  | { type: "qrcode" };

type SectionAccent = "pink" | "cyan" | "gold";

type Section =
  | { id: string; title: string; subtitle?: string; accent: SectionAccent; kind: "tiles"; tiles: TileSpec[] }
  | { id: string; title: string; subtitle?: string; accent: SectionAccent; kind: "actions"; actionIds: string[] }
  | { id: string; title: string; subtitle?: string; accent: SectionAccent; kind: "placeholder"; hint: string };

// Each section's accent matches the dominant color of its content.
const SECTIONS: Section[] = [
  { id: "automations", title: "Automations", accent: "cyan", kind: "placeholder",
    hint: "Cron-driven scheduled tasks · milestone triggers · recurring announcements (coming with the tgv-automations registry)." },
  { id: "backups", title: "Backups & Disaster Recovery", accent: "cyan",
    subtitle: "off-site backup pipeline · restore drills · disaster-recovery posture",
    kind: "tiles", tiles: [{ type: "backups" }] },
  { id: "communications", title: "Communications / Relay", accent: "cyan", kind: "placeholder",
    hint: "Telegram + WhatsApp relay operator UX · sessions, decisions, recipients, billing, dispatch attempts (coming with tgv-module-connect-relay-operator-ux)." },
  { id: "database", title: "Database / Storage", accent: "cyan", kind: "placeholder",
    hint: "Postgres admin views · R2 bucket browser · CDN cache controls · Drizzle migration runner (coming)." },
  { id: "deployments", title: "Deployments", accent: "cyan",
    subtitle: "scaffold, start, and retire client projects",
    kind: "actions",
    actionIds: ["new-nextjs", "new-static", "start-client", "erase-project"] },
  { id: "domains", title: "Domains & DNS", accent: "cyan",
    subtitle: "registrar automation · Cloudflare migration",
    kind: "actions",
    actionIds: ["domain-cf-migrate", "opensrs-domain-purchase"] },
  { id: "git", title: "Git & Repositories", accent: "cyan",
    subtitle: "create or remove GitHub repositories",
    kind: "actions", actionIds: ["gitrepo", "gitdelrepo"] },
  { id: "hardening", title: "Hardening", accent: "cyan",
    subtitle: "defensive mechanisms installed on RCS — controls + status + audit log",
    kind: "tiles", tiles: [{ type: "telephony" }] },
  { id: "linktools", title: "Link Tools", accent: "cyan",
    subtitle: "shorten URLs and generate scannable QR codes — pair them for printable mini-flyers",
    kind: "tiles", tiles: [{ type: "tinyurl" }, { type: "qrcode" }] },
  { id: "mail", title: "Mail & Identity", accent: "cyan",
    subtitle: "mail provider domain + folder + alias setup",
    kind: "actions", actionIds: ["mail-domain-setup"] },
  { id: "pm2", title: "Process Manager (PM2)", accent: "cyan",
    subtitle: "process manager — restart, stop, log, harden, alias",
    kind: "actions",
    actionIds: ["pm2-restart", "pm2-stop", "pm2-logs", "pm2-harden", "pm2-newpm2", "pm2-editpm2"] },
  { id: "system", title: "System & Server Health", accent: "cyan",
    subtitle: "server health, disk, and maintenance",
    kind: "actions", actionIds: ["diskusage"] },
  { id: "franchises", title: "Tenants & Franchises", accent: "cyan", kind: "placeholder",
    hint: "Per-franchise admin surface · license issuance + revocation · per-tenant data scoping · update push (coming with tgv-franchise-rollout)." },
];

/* ── ADL styled-components ──────────────────────────────────────────────
 * Pattern: ~/.claude/vocabulary/ADL.md. Each section is its own tile, its
 * accent matching the dominant color of the content within (gold for
 * Hardening + Backups, cyan for Link Tools + Domains, etc.).
 */

const AdlSectionTile = styled.div<{ $accent: SectionAccent; $open: boolean }>`
  width: 100%;
  border: 1px solid ${(p) => (p.$open
    ? `rgba(${rgb[p.$accent]}, 0.28)`
    : `rgba(${rgb[p.$accent]}, 0.12)`)};
  border-radius: 0.625rem;
  background: ${(p) => (p.$open
    ? `rgba(${rgb[p.$accent]}, 0.04)`
    : "rgba(0,0,0,0.18)")};
  transition: border-color 0.15s, background 0.15s;
  overflow: hidden;
`;

const AdlHeader = styled.button<{ $open: boolean; $accent: SectionAccent }>`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  box-sizing: border-box;
  min-height: 2.6rem;
  padding: 0.55rem 0.875rem;
  margin: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  color: ${(p) => (p.$open
    ? colors[p.$accent]
    : `rgba(${rgb[p.$accent]}, 0.7)`)};
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: rgba(${(p) => rgb[p.$accent]}, 0.08);
    color: ${(p) => colors[p.$accent]};
  }
`;

const AdlLabel = styled.span`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  text-align: left;
`;

const AdlLabelMain = styled.span``;

const AdlLabelSub = styled.span`
  font-size: 0.625rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: none;
  color: var(--t-textFaint);
`;

const AdlCount = styled.span<{ $accent: SectionAccent }>`
  font-size: 0.625rem;
  color: rgba(${(p) => rgb[p.$accent]}, 0.55);
  font-weight: 600;
  letter-spacing: 0.06em;
`;

const AdlCountSoon = styled.span<{ $accent: SectionAccent }>`
  font-size: 0.55rem;
  color: rgba(${(p) => rgb[p.$accent]}, 0.45);
  font-style: italic;
  font-weight: 500;
  text-transform: lowercase;
  letter-spacing: 0.04em;
`;

const AdlSwitchTrack = styled.span<{ $on: boolean; $accent?: SectionAccent }>`
  position: relative;
  display: inline-block;
  width: 28px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$on
    ? `rgba(${rgb[p.$accent || "pink"]}, 0.7)`
    : "rgba(255,255,255,0.2)")};
  background: ${(p) => (p.$on
    ? `rgba(${rgb[p.$accent || "pink"]}, 0.2)`
    : "rgba(255,255,255,0.05)")};
  box-shadow: ${(p) => (p.$on
    ? `0 0 8px rgba(${rgb[p.$accent || "pink"]}, 0.45)`
    : "none")};
  transition: all 0.18s;
  flex-shrink: 0;
`;

const AdlSwitchThumb = styled.span<{ $on: boolean; $accent?: SectionAccent }>`
  position: absolute;
  top: 1px;
  left: ${(p) => (p.$on ? "15px" : "1px")};
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(p) => (p.$on
    ? colors[p.$accent || "pink"]
    : "rgba(255,255,255,0.35)")};
  box-shadow: ${(p) =>
    p.$on
      ? `0 0 8px rgba(${rgb[p.$accent || "pink"]}, 0.85), 0 0 2px rgba(${rgb[p.$accent || "pink"]}, 1)`
      : "0 1px 2px rgba(0,0,0,0.3)"};
  transition: all 0.18s;
`;

const AdlBody = styled.div<{ $open: boolean; $accent: SectionAccent }>`
  display: ${(p) => (p.$open ? "block" : "none")};
  padding: 0.5rem 0.875rem 1rem;
  border-top: 1px solid rgba(${(p) => rgb[p.$accent]}, 0.12);
`;

const PlaceholderBody = styled.div<{ $accent: SectionAccent }>`
  font-size: 0.78rem;
  line-height: 1.55;
  color: var(--t-textFaint);
  font-style: italic;
  padding: 0.5rem 0.75rem;
  border-left: 2px solid rgba(${(p) => rgb[p.$accent]}, 0.25);
`;

/* Outer parent tile — wraps all sections + houses the master Collapse-All.
 * Cyan accent matches the UTILS surface (one accent per surface rule). */

const ParentTile = styled.div`
  width: 100%;
  border: 1px solid rgba(${rgb.cyan}, 0.22);
  border-radius: 0.875rem;
  background: linear-gradient(180deg, rgba(${rgb.cyan}, 0.03), rgba(0,0,0,0.2));
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const ParentHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.625rem;
  border: 1px dashed rgba(${rgb.cyan}, 0.25);
  border-radius: 0.5rem;
  background: rgba(${rgb.cyan}, 0.04);
  cursor: pointer;
  user-select: none;
  &:hover {
    background: rgba(${rgb.cyan}, 0.08);
    border-color: rgba(${rgb.cyan}, 0.4);
  }
`;

const ParentTitle = styled.span<{ $allOpen: boolean }>`
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: ${(p) => (p.$allOpen ? colors.cyan : `rgba(${rgb.cyan}, 0.6)`)};
`;

const ParentHint = styled.span`
  font-size: 0.6rem;
  color: var(--t-textGhost);
  margin-left: auto;
  font-style: italic;
`;

const ActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.75rem;
`;

const LinkToolsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.25rem;
`;

const LinkToolsTile = styled.button`
  display: flex; flex-direction: column; gap: 0.4rem;
  padding: 1rem;
  text-align: left;
  cursor: pointer;
  background: rgba(${rgb.cyan}, 0.04);
  border: 1px solid rgba(${rgb.cyan}, 0.3);
  border-radius: 0.625rem;
  color: var(--t-text);
  transition: all 0.15s;
  &:hover {
    background: rgba(${rgb.cyan}, 0.1);
    border-color: rgba(${rgb.cyan}, 0.55);
    box-shadow: 0 0 18px rgba(${rgb.cyan}, 0.15);
  }
`;

const LinkToolsTileTop = styled.div`
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: ${colors.cyan};
  letter-spacing: 0.04em;
`;

const LinkToolsTileSub = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  line-height: 1.45;
`;

const LinkToolsGroupHeader = styled.div`
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: ${colors.cyan};
  margin: 0.25rem 0 0.625rem;
`;

const LinkToolsGroupSub = styled.span`
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--t-textFaint);
  text-transform: none;
  letter-spacing: 0.04em;
`;

const HardeningGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.25rem;
`;

const HardeningTile = styled.button`
  display: flex; flex-direction: column; gap: 0.4rem;
  padding: 1rem;
  text-align: left;
  cursor: pointer;
  background: rgba(${rgb.gold}, 0.04);
  border: 1px solid rgba(${rgb.gold}, 0.3);
  border-radius: 0.625rem;
  color: var(--t-text);
  transition: all 0.15s;
  &:hover {
    background: rgba(${rgb.gold}, 0.1);
    border-color: rgba(${rgb.gold}, 0.55);
    box-shadow: 0 0 18px rgba(${rgb.gold}, 0.15);
  }
`;

const HardeningTileTop = styled.div`
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: ${colors.gold};
  letter-spacing: 0.04em;
`;

const HardeningTileSub = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  line-height: 1.45;
`;

const HardeningGroupHeader = styled.div`
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: ${colors.gold};
  margin: 0.25rem 0 0.625rem;
`;

const HardeningGroupSub = styled.span`
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--t-textFaint);
  text-transform: none;
  letter-spacing: 0.04em;
`;

export default function UtilsPage() {
  const { isRunning, lines, toggleTerminal } = useTerminal();
  const [userRole, setUserRole] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [overlay, setOverlay] = useState<DefaultsOverlay>({});
  const [openHardening, setOpenHardening] = useState<HardeningKind | null>(null);
  const [openBackups, setOpenBackups] = useState<boolean>(false);
  const [openLinkTool, setOpenLinkTool] = useState<LinkTool | null>(null);
  const [qrSeed, setQrSeed] = useState<string>("");
  const [qrSeedName, setQrSeedName] = useState<string>("");
  const [qrFilenameStem, setQrFilenameStem] = useState<string>("qr");
  const [qrLinkedShortCode, setQrLinkedShortCode] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/users/me").then((r) => r.json()).then((d) => {
      if (d?.role) setUserRole(d.role);
      if (d?.username) setUsername(d.username);
    }).catch(() => {});
    fetch("/api/utils/defaults").then((r) => r.json()).then((d) => {
      if (d?.overlay) setOverlay(d.overlay);
    }).catch(() => {});
  }, []);

  const handleMakeQR = (shortUrl: string, link: ShortLink) => {
    setQrSeed(shortUrl);
    setQrSeedName(`QR for /${link.code}`);
    setQrFilenameStem(`qr-${link.code}`);
    setQrLinkedShortCode(link.code);
    setOpenLinkTool("qrcode");
  };

  const saveDefaults = async (actionId: string, defaults: Record<string, FieldValue>) => {
    const r = await fetch("/api/utils/defaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId, defaults }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body?.error ?? `HTTP ${r.status}`);
    }
    const body = await r.json();
    if (body?.overlay) setOverlay(body.overlay);
  };

  const isAdmin = userRole === "admin";

  return (
    <>
      <TopNav />
      <PageMain>
        <HeaderRow>
          <div>
            <PageSubtitle>
              Server scripts — grouped, configured, and streamed to your terminal
            </PageSubtitle>
          </div>

          <TerminalShortcut
            $running={isRunning}
            onClick={() => {
              // When rendered inside the dashboard popout iframe, position:fixed
              // elements can't escape the iframe — postMessage to the parent so
              // the parent's TerminalProvider opens its own CliTerminal on top
              // of the modal instead.
              if (typeof window !== "undefined" && window.parent !== window) {
                window.parent.postMessage({ type: "tgv-toggle-terminal" }, "*");
              } else {
                toggleTerminal();
              }
            }}
          >
            {isRunning ? "● running" : ">_ terminal"}
            {lines.length > 0 && (
              <TerminalLineCount>({lines.length} lines)</TerminalLineCount>
            )}
          </TerminalShortcut>
        </HeaderRow>

        <UtilsAdlSurface
          sections={SECTIONS}
          actionsById={ACTIONS_BY_ID}
          isAdmin={isAdmin}
          overlay={overlay}
          onSaveDefaults={saveDefaults}
          onOpenBackups={() => setOpenBackups(true)}
          onOpenHardening={(kind) => setOpenHardening(kind)}
          onOpenLinkTool={(kind) => {
            if (kind === "qrcode") {
              setQrSeed("");
              setQrSeedName("");
              setQrFilenameStem("qr");
              setQrLinkedShortCode(null);
            }
            setOpenLinkTool(kind);
          }}
        />
      </PageMain>

      {openHardening === "telephony" && (
        <TelephonyControlModal onClose={() => setOpenHardening(null)} />
      )}

      {openBackups && (
        <BackupsControlModal onClose={() => setOpenBackups(false)} />
      )}

      {openLinkTool === "tinyurl" && username && (
        <TinyURLGenerator
          username={username}
          origin={LINKS_ORIGIN}
          onClose={() => setOpenLinkTool(null)}
          onMakeQR={handleMakeQR}
        />
      )}

      {openLinkTool === "qrcode" && username && (
        <QRCodeGenerator
          username={username}
          initialText={qrSeed}
          initialName={qrSeedName}
          linkedShortCode={qrLinkedShortCode}
          filenameStem={qrFilenameStem}
          onClose={() => setOpenLinkTool(null)}
        />
      )}
    </>
  );
}

"use client";

import { useState, useEffect, ReactNode } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import TopNav from "../../components/TopNav";
import { useTerminal } from "../../components/TerminalProvider";

/* ── Types ────────────────────────────────────────────────────── */

type Field = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
};

type Action = {
  id: string;
  label: string;
  description: string;
  script: string;
  buildArgs?: (values: Record<string, string>) => string[];
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

/* ── Group panel component ─────────────────────────────────────── */

function GroupPanel({ group }: { group: Group }) {
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
            <ActionCard key={action.id} action={action} />
          ))}
        </GroupBody>
      )}
    </GroupWrap>
  );
}

/* ── Action card component ─────────────────────────────────────── */

function ActionCard({ action }: { action: Action }) {
  const { runCommand, isRunning } = useTerminal();
  const [showForm, setShowForm] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [confirmValue, setConfirmValue] = useState("");
  const color = GLOW_COLOR[action.glow ?? "cyan"];

  const initDefaults = () => {
    const defaults: Record<string, string> = {};
    for (const f of action.fields ?? []) {
      if (f.type === "select" && f.options?.length) {
        defaults[f.key] = f.options[0].value;
      } else {
        defaults[f.key] = "";
      }
    }
    setValues(defaults);
    setConfirmValue("");
  };

  const handleTrigger = () => {
    if (action.fields && action.fields.length > 0) {
      initDefaults();
      setShowForm(true);
    } else {
      runCommand(action.script, action.buildArgs?.({}) ?? []);
    }
  };

  const handleRun = () => {
    const args = action.buildArgs ? action.buildArgs(values) : [];
    if (action.confirm) {
      const expectedKey = Object.keys(values)[0];
      if (confirmValue !== values[expectedKey]) {
        alert("Confirmation did not match. Aborted.");
        return;
      }
    }
    setShowForm(false);
    runCommand(action.script, args);
  };

  const canRun =
    (action.fields ?? []).filter((f) => f.required).every((f) => values[f.key]?.trim());

  return (
    <>
      <ActionCardWrap $danger={action.danger} $color={color}>
        <div>
          <ActionLabel $danger={action.danger} $color={color}>{action.label}</ActionLabel>
          <ActionDesc>{action.description}</ActionDesc>
        </div>
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
    </>
  );
}

/* ── Form modal component ──────────────────────────────────────── */

function FormModal({
  action, values, confirmValue, canRun, onChange, onConfirmChange, onRun, onClose,
}: {
  action: Action;
  values: Record<string, string>;
  confirmValue: string;
  canRun: boolean;
  onChange: (k: string, v: string) => void;
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

        {(action.fields ?? []).map((field) => (
          <FieldGroup key={field.key}>
            <FieldLabel>{field.label}</FieldLabel>
            {field.type === "select" ? (
              <StyledSelect
                $color={color}
                value={values[field.key] ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
              >
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </StyledSelect>
            ) : (
              <StyledInput
                $color={color}
                type="text"
                value={values[field.key] ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
              />
            )}
          </FieldGroup>
        ))}

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

/* ── Page ──────────────────────────────────────────────────────── */

export default function UtilsPage() {
  const { isRunning, lines, toggleTerminal } = useTerminal();

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

          <TerminalShortcut $running={isRunning} onClick={toggleTerminal}>
            {isRunning ? "● running" : ">_ terminal"}
            {lines.length > 0 && (
              <TerminalLineCount>({lines.length} lines)</TerminalLineCount>
            )}
          </TerminalShortcut>
        </HeaderRow>

        <GroupsColumn>
          {GROUPS.map((group) => (
            <GroupPanel key={group.id} group={group} />
          ))}
        </GroupsColumn>
      </PageMain>
    </>
  );
}

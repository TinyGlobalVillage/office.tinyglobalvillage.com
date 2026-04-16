"use client";

import { useState, useEffect, ReactNode } from "react";
import TopNav from "../../components/TopNav";
import { useTerminal } from "../../components/TerminalProvider";

// ── Types ────────────────────────────────────────────────────────
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

// ── Command registry (mirrors /api/exec REGISTRY) ────────────────
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
        buildArgs: (v) => [
          v.org === "tgv" ? "-tgv" : "-refusionist",
          v.domain,
        ],
        fields: [
          {
            key: "org",
            label: "Organisation",
            type: "select",
            options: [
              { value: "tgv", label: "TinyGlobalVillage" },
              { value: "refusionist", label: "Refusionist" },
            ],
            required: true,
          },
          {
            key: "domain",
            label: "Domain",
            placeholder: "example.tinyglobalvillage.com",
            required: true,
          },
        ],
        glow: "pink",
      },
      {
        id: "new-static",
        label: "Launch Static Site",
        description: "NGINX + SSL for a static HTML/CSS/JS site",
        script: "newclientproject-static",
        buildArgs: (v) => [
          v.org === "tgv" ? "-tgv" : "-refusionist",
          v.domain,
        ],
        fields: [
          {
            key: "org",
            label: "Organisation",
            type: "select",
            options: [
              { value: "tgv", label: "TinyGlobalVillage" },
              { value: "refusionist", label: "Refusionist" },
            ],
            required: true,
          },
          {
            key: "domain",
            label: "Domain",
            placeholder: "static.tinyglobalvillage.com",
            required: true,
          },
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
        fields: [
          {
            key: "domain",
            label: "Domain",
            placeholder: "project.tinyglobalvillage.com",
            required: true,
          },
        ],
        glow: "cyan",
      },
      {
        id: "erase-project",
        label: "Erase Project",
        description:
          "Permanently delete: PM2, NGINX, SSL, GitHub repo, local files",
        script: "erase-project",
        buildArgs: (v) => [v.domain],
        fields: [
          {
            key: "domain",
            label: "Domain to erase",
            placeholder: "project.tinyglobalvillage.com",
            required: true,
          },
        ],
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
      {
        id: "pm2-restart",
        label: "Restart Process",
        description: "Restart a named PM2 process with updated env",
        script: "pm2-restart",
        buildArgs: (v) => ["--update-env", v.name],
        fields: [
          {
            key: "name",
            label: "Process name",
            placeholder: "refusionist.com",
            required: true,
          },
        ],
        glow: "cyan",
      },
      {
        id: "pm2-stop",
        label: "Stop Process",
        description: "Stop a running PM2 process",
        script: "pm2-stop",
        buildArgs: (v) => [v.name],
        fields: [
          {
            key: "name",
            label: "Process name",
            placeholder: "refusionist.com",
            required: true,
          },
        ],
        glow: "gold",
      },
      {
        id: "pm2-logs",
        label: "View Logs",
        description: "Tail the last 80 lines of a PM2 process log",
        script: "pm2-logs",
        buildArgs: (v) => [v.name],
        fields: [
          {
            key: "name",
            label: "Process name",
            placeholder: "refusionist.com",
            required: true,
          },
        ],
        glow: "cyan",
      },
      {
        id: "pm2-harden",
        label: "Harden PM2",
        description:
          "Install log rotation (10 MB × 5) + enable startup on reboot",
        script: "pm2-harden",
        buildArgs: () => [],
        glow: "gold",
      },
      {
        id: "pm2-newpm2",
        label: "Add PM2 Alias",
        description: "Append a pm2-restart shortcut alias to ~/.bashrc",
        script: "pm2-newpm2",
        buildArgs: (v) => [v.project, v.shortcut],
        fields: [
          {
            key: "project",
            label: "PM2 process name",
            placeholder: "refusionist.com",
            required: true,
          },
          {
            key: "shortcut",
            label: "Alias shortcut",
            placeholder: "rr",
            required: true,
          },
        ],
        glow: "gold",
      },
      {
        id: "pm2-editpm2",
        label: "Edit PM2 Alias",
        description: "Rename an existing PM2 alias shortcut in ~/.bashrc",
        script: "pm2-editpm2",
        buildArgs: (v) => [v.old, v.newName],
        fields: [
          {
            key: "old",
            label: "Current shortcut",
            placeholder: "rr",
            required: true,
          },
          {
            key: "newName",
            label: "New shortcut",
            placeholder: "rrs",
            required: true,
          },
        ],
        glow: "gold",
      },
    ],
  },
  {
    id: "git",
    title: "Git & GitHub",
    subtitle: "Create or remove GitHub repositories",
    icon: "🐙",
    glow: "cyan",
    actions: [
      {
        id: "gitrepo",
        label: "Create GitHub Repo",
        description: "Create a new repo in an org and push initial commit",
        script: "gitrepo",
        buildArgs: (v) => [
          v.org === "tgv" ? "-tgv" : "-u tinygvillage",
          v.repoName,
        ],
        fields: [
          {
            key: "org",
            label: "Organisation",
            type: "select",
            options: [
              { value: "tgv", label: "TinyGlobalVillage" },
              { value: "refusionist", label: "tinygvillage" },
            ],
            required: true,
          },
          {
            key: "repoName",
            label: "Repository name",
            placeholder: "my-project",
            required: true,
          },
        ],
        glow: "cyan",
      },
      {
        id: "gitdelrepo",
        label: "Delete GitHub Repo",
        description: "Permanently delete a repository from GitHub",
        script: "gitdelrepo",
        buildArgs: (v) => [
          v.org === "tgv" ? "-TGV" : "-tgv",
          v.repoName,
        ],
        fields: [
          {
            key: "org",
            label: "Organisation",
            type: "select",
            options: [
              { value: "tgv", label: "TinyGlobalVillage" },
              { value: "refusionist", label: "tinygvillage" },
            ],
            required: true,
          },
          {
            key: "repoName",
            label: "Repository name",
            placeholder: "my-project",
            required: true,
          },
        ],
        danger: true,
        confirm: "Type the repository name to confirm deletion:",
        glow: "red",
      },
    ],
  },
  {
    id: "system",
    title: "System",
    subtitle: "Server health, disk, and maintenance",
    icon: "🖥️",
    glow: "gold",
    actions: [
      {
        id: "diskusage",
        label: "Disk Usage",
        description: "Show disk usage for all key RCS directories",
        script: "diskusage",
        buildArgs: () => [],
        glow: "gold",
      },
    ],
  },
];

// ── Glow colors map ───────────────────────────────────────────────
const GLOW_COLOR: Record<string, string> = {
  pink: "#ff4ecb",
  cyan: "#00bfff",
  gold: "#f7b700",
  red: "#ff4444",
};

// ── Group panel ───────────────────────────────────────────────────
function GroupPanel({ group }: { group: Group }) {
  const [open, setOpen] = useState(true);
  const color = GLOW_COLOR[group.glow];

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(44deg, hsla(190,100%,12%,0.4), rgba(0,0,0,0.8))",
        border: `1px solid ${color}22`,
      }}
    >
      {/* Group header */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        <span className="text-2xl">{group.icon}</span>
        <div className="flex-1">
          <div
            className="text-sm font-bold uppercase tracking-widest"
            style={{ color }}
          >
            {group.title}
          </div>
          <div className="text-xs text-white/40 mt-0.5">{group.subtitle}</div>
        </div>
        <span
          className="text-xs text-white/30 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▼
        </span>
      </button>

      {/* Actions */}
      {open && (
        <div
          className="px-4 pb-4 grid gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            borderTop: `1px solid ${color}18`,
          }}
        >
          {group.actions.map((action) => (
            <ActionCard key={action.id} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Action card ───────────────────────────────────────────────────
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
      // No args — run directly
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
      <div
        className="flex flex-col gap-3 rounded-xl p-4 mt-3 transition-all duration-200"
        style={{
          background: action.danger
            ? "rgba(255,50,50,0.06)"
            : "rgba(255,255,255,0.03)",
          border: `1px solid ${action.danger ? "#ff444422" : color + "22"}`,
        }}
      >
        <div>
          <div
            className="text-xs font-bold uppercase tracking-wide mb-1"
            style={{ color: action.danger ? "#ff6b6b" : color }}
          >
            {action.label}
          </div>
          <p className="text-xs text-white/50 leading-relaxed">
            {action.description}
          </p>
        </div>

        <button
          onClick={handleTrigger}
          disabled={isRunning}
          className="self-start px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: action.danger
              ? "linear-gradient(to right, #ff4444, #cc0000)"
              : `linear-gradient(to right, ${color}cc, ${color}88)`,
            color: action.danger ? "#fff" : "#0a0a0a",
            boxShadow: isRunning ? "none" : `0 0 10px ${color}44`,
          }}
        >
          {isRunning ? "Busy…" : action.fields?.length ? "Configure →" : "Run →"}
        </button>
      </div>

      {/* Inline form modal */}
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

// ── Form modal ────────────────────────────────────────────────────
function FormModal({
  action,
  values,
  confirmValue,
  canRun,
  onChange,
  onConfirmChange,
  onRun,
  onClose,
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
        style={{
          background: "linear-gradient(44deg, hsl(190,100%,10%), #0a0a0a)",
          border: `1px solid ${color}44`,
          boxShadow: `0 0 40px ${color}22`,
        }}
      >
        <div>
          <h3
            className="text-sm font-bold uppercase tracking-widest mb-1"
            style={{ color }}
          >
            {action.label}
          </h3>
          <p className="text-xs text-white/50">{action.description}</p>
        </div>

        {/* Fields */}
        {(action.fields ?? []).map((field) => (
          <FieldInput
            key={field.key}
            field={field}
            value={values[field.key] ?? ""}
            onChange={(v) => onChange(field.key, v)}
            color={color}
          />
        ))}

        {/* Danger confirmation */}
        {action.confirm && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-red-400">{action.confirm}</label>
            <input
              type="text"
              value={confirmValue}
              onChange={(e) => onConfirmChange(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-xs font-mono outline-none"
              style={{
                background: "rgba(255,50,50,0.08)",
                border: "1px solid rgba(255,80,80,0.3)",
                color: "#ededed",
              }}
              placeholder="Type to confirm…"
            />
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 mt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-xs font-bold text-white/50 hover:text-white border border-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onRun}
            disabled={!canRun}
            className="flex-1 py-2 rounded-lg text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{
              background: action.danger
                ? "linear-gradient(to right, #ff4444, #cc0000)"
                : `linear-gradient(to right, ${color}dd, ${color}99)`,
              color: action.danger ? "#fff" : "#0a0a0a",
              boxShadow: canRun ? `0 0 12px ${color}44` : "none",
            }}
          >
            {action.danger ? "⚠ Run Anyway" : "▶ Run"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Field input ───────────────────────────────────────────────────
function FieldInput({
  field,
  value,
  onChange,
  color,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  color: string;
}) {
  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: `1px solid ${color}33`,
    color: "#ededed",
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-white/60">{field.label}</label>
      {field.type === "select" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-xs outline-none"
          style={inputStyle}
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full rounded-lg px-3 py-2 text-xs outline-none"
          style={inputStyle}
        />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────
export default function UtilsPage() {
  const { isRunning, lines, toggleTerminal } = useTerminal();

  return (
    <>
      <TopNav />
      <main className="flex flex-col min-h-screen pt-28 pb-32 px-4 max-w-6xl mx-auto w-full gap-5">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1
              className="text-3xl font-bold mb-1"
              style={{
                color: "#ff4ecb",
                textShadow: "0 0 8px #ff66cc, 0 0 20px #ff4ecb",
              }}
            >
              Utils
            </h1>
            <p className="text-sm text-white/40">
              Server scripts — grouped, configured, and streamed to your terminal
            </p>
          </div>

          {/* Terminal shortcut */}
          <button
            onClick={toggleTerminal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono border transition-colors"
            style={{
              borderColor: isRunning ? "#f7b700" : "rgba(255,78,203,0.3)",
              color: isRunning ? "#f7b700" : "#ff4ecb",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            {isRunning ? "● running" : `>_ terminal`}
            {lines.length > 0 && (
              <span className="text-white/30">({lines.length} lines)</span>
            )}
          </button>
        </div>

        {/* Groups */}
        <div className="flex flex-col gap-4">
          {GROUPS.map((group) => (
            <GroupPanel key={group.id} group={group} />
          ))}
        </div>
      </main>
    </>
  );
}

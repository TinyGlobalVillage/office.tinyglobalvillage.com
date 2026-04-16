"use client";

import { useState, useEffect } from "react";

type Sections = {
  mailboxPanel: boolean;
  previewPane: boolean;
  composeToolbar: boolean;
  attachmentBar: boolean;
  ccBcc: boolean;
  threadView: boolean;
};

type Display = {
  zoom: number;
  splitMode: "vertical" | "horizontal" | "fullList";
  defaultAccount: string;
};

type Settings = {
  sections: Sections;
  display: Display;
};

type AccountOption = { key: string; label: string; email: string };

type Props = {
  accounts?: AccountOption[];
  onClose: () => void;
  onSaved: (settings: Settings) => void;
};

const SECTION_LABELS: Record<keyof Sections, string> = {
  mailboxPanel: "Mailbox panel",
  previewPane: "Preview pane",
  composeToolbar: "Compose toolbar",
  attachmentBar: "Attachment bar",
  ccBcc: "Show Cc/Bcc by default",
  threadView: "Thread view",
};

const SECTION_DESCRIPTIONS: Record<keyof Sections, string> = {
  mailboxPanel: "Show the folder/mailbox sidebar",
  previewPane: "Show email reading pane alongside list",
  composeToolbar: "Show formatting toolbar in compose window",
  attachmentBar: "Show attachment preview bar in reading pane",
  ccBcc: "Show Cc and Bcc fields by default in compose",
  threadView: "Group emails by conversation thread",
};

const ZOOM_STEPS = [0.8, 0.9, 1.0, 1.1, 1.25];
const SPLIT_MODES: { value: Display["splitMode"]; label: string }[] = [
  { value: "vertical", label: "Side by side" },
  { value: "horizontal", label: "Top/bottom" },
  { value: "fullList", label: "List only" },
];

export default function EmailSettings({ accounts = [], onClose, onSaved }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/email/settings")
      .then((r) => r.json())
      .then((d: Settings) => { if (d?.sections && d?.display) setSettings(d); })
      .catch(() => {});
  }, []);

  const patchSection = (key: keyof Sections, val: boolean) => {
    if (!settings) return;
    setSettings({ ...settings, sections: { ...settings.sections, [key]: val } });
  };

  const patchDisplay = (key: keyof Display, val: Display[keyof Display]) => {
    if (!settings) return;
    setSettings({ ...settings, display: { ...settings.display, [key]: val } });
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/email/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data: Settings = await res.json();
      onSaved(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-md mx-4 rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: "rgba(10,13,18,0.99)",
          border: "1px solid rgba(0,191,255,0.18)",
          boxShadow: "0 20px 80px rgba(0,0,0,0.8)",
          maxHeight: "80vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.85)" }}>
            ⚙ Email Settings
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs hover:bg-white/10 transition-all"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-6">
          {!settings ? (
            <div className="text-center py-8 text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>
              Loading settings…
            </div>
          ) : (
            <>
              {/* ── Sections ─────────────────────────────────────────────── */}
              <section>
                <h3 className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Interface Sections
                </h3>
                <div className="flex flex-col gap-1">
                  {(Object.keys(settings.sections) as (keyof Sections)[]).map((key) => (
                    <label
                      key={key}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:bg-white/5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>
                          {SECTION_LABELS[key]}
                        </div>
                        <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                          {SECTION_DESCRIPTIONS[key]}
                        </div>
                      </div>
                      <div
                        onClick={() => patchSection(key, !settings.sections[key])}
                        className="w-9 h-5 rounded-full relative cursor-pointer flex-shrink-0 transition-all"
                        style={{
                          background: settings.sections[key] ? "rgba(0,191,255,0.4)" : "rgba(255,255,255,0.1)",
                          border: `1px solid ${settings.sections[key] ? "rgba(0,191,255,0.6)" : "rgba(255,255,255,0.15)"}`,
                        }}
                      >
                        <div
                          className="absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all"
                          style={{
                            left: settings.sections[key] ? "calc(100% - 16px)" : 2,
                            background: settings.sections[key] ? "#00bfff" : "rgba(255,255,255,0.3)",
                          }}
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </section>

              {/* ── Display ───────────────────────────────────────────────── */}
              <section>
                <h3 className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Display
                </h3>

                {/* Default compose account */}
                {accounts.length > 1 && (
                  <div className="mb-3">
                    <div className="text-[11px] font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>Default compose account</div>
                    <div className="flex flex-col gap-1">
                      {accounts.map((a) => (
                        <button
                          key={a.key}
                          onClick={() => patchDisplay("defaultAccount", a.key)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all"
                          style={{
                            background: settings!.display.defaultAccount === a.key ? "rgba(0,191,255,0.12)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${settings!.display.defaultAccount === a.key ? "rgba(0,191,255,0.35)" : "rgba(255,255,255,0.08)"}`,
                          }}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: settings!.display.defaultAccount === a.key ? "#00bfff" : "rgba(255,255,255,0.2)" }}
                          />
                          <div className="flex flex-col">
                            <span className="text-[11px] font-semibold" style={{ color: settings!.display.defaultAccount === a.key ? "#00bfff" : "rgba(255,255,255,0.6)" }}>
                              {a.label}
                            </span>
                            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{a.email}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Split mode */}
                <div className="mb-3">
                  <div className="text-[11px] font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>Reading pane</div>
                  <div className="flex gap-1.5">
                    {SPLIT_MODES.map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => patchDisplay("splitMode", value)}
                        className="flex-1 py-1.5 text-[10px] font-semibold rounded-lg transition-all"
                        style={{
                          background: settings.display.splitMode === value ? "rgba(0,191,255,0.15)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${settings.display.splitMode === value ? "rgba(0,191,255,0.35)" : "rgba(255,255,255,0.08)"}`,
                          color: settings.display.splitMode === value ? "#00bfff" : "rgba(255,255,255,0.4)",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Zoom */}
                <div>
                  <div className="text-[11px] font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>Zoom</div>
                  <div className="flex gap-1.5">
                    {ZOOM_STEPS.map((z) => (
                      <button
                        key={z}
                        onClick={() => patchDisplay("zoom", z)}
                        className="flex-1 py-1.5 text-[10px] font-mono font-bold rounded-lg transition-all"
                        style={{
                          background: settings.display.zoom === z ? "rgba(0,191,255,0.15)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${settings.display.zoom === z ? "rgba(0,191,255,0.35)" : "rgba(255,255,255,0.08)"}`,
                          color: settings.display.zoom === z ? "#00bfff" : "rgba(255,255,255,0.4)",
                        }}
                      >
                        {Math.round(z * 100)}%
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !settings}
            className="px-5 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
            style={{
              background: saved ? "rgba(0,220,100,0.15)" : "rgba(0,191,255,0.15)",
              border: `1px solid ${saved ? "rgba(0,220,100,0.35)" : "rgba(0,191,255,0.35)"}`,
              color: saved ? "rgba(0,220,100,0.9)" : "#00bfff",
            }}
          >
            {saved ? "✓ Saved" : saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

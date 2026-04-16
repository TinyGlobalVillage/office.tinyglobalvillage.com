"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { type AccountMeta } from "./AccountSwitcher";

type AddressEntry = { name?: string; email: string };

type Props = {
  fromEmail: string;
  fromLabel: string;
  account: string;
  accounts?: AccountMeta[];
  pinVerified: boolean;
  initialTo?: AddressEntry[];
  initialSubject?: string;
  initialBody?: string;
  initialCc?: AddressEntry[];
  inReplyTo?: string;
  references?: string[];
  onClose: () => void;
  onSent: () => void;
};

export default function ComposeModal({
  fromEmail, fromLabel, account, accounts = [],
  pinVerified,
  initialTo = [], initialSubject = "", initialBody = "",
  initialCc = [], inReplyTo, references,
  onClose, onSent,
}: Props) {
  const [fromKey, setFromKey] = useState(account);
  const currentFrom = accounts.find((a) => a.key === fromKey)
    ?? { key: account, email: fromEmail, label: fromLabel };

  const [to, setTo] = useState(initialTo.map((a) => a.email).join(", "));
  const [cc, setCc] = useState(initialCc.map((a) => a.email).join(", "));
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [showCc, setShowCc] = useState(initialCc.length > 0);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toRef = useRef<HTMLInputElement>(null);

  useEffect(() => { toRef.current?.focus(); }, []);

  // ESC closes compose only (capture phase, stops drawer from also closing)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose]);

  const parseAddresses = (raw: string): AddressEntry[] =>
    raw.split(/[,;]+/).map((s) => s.trim()).filter(Boolean).map((s) => ({ email: s }));

  const send = async () => {
    if (!to.trim()) { setError("Recipient required."); return; }
    if (!subject.trim()) { setError("Subject required."); return; }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: currentFrom.key,
          to: parseAddresses(to),
          cc: showCc && cc ? parseAddresses(cc) : [],
          bcc: showBcc && bcc ? parseAddresses(bcc) : [],
          subject, textBody: body, inReplyTo, references,
        }),
      });
      const data = await res.json();
      if (data.ok) { onSent(); onClose(); }
      else setError(data.error ?? "Failed to send.");
    } catch { setError("Network error."); }
    finally { setSending(false); }
  };

  const saveDraft = async () => {
    if (!subject.trim() && !body.trim() && !to.trim()) { onClose(); return; }
    setSavingDraft(true);
    setError(null);
    try {
      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: currentFrom.key,
          to: to ? parseAddresses(to) : [],
          cc: showCc && cc ? parseAddresses(cc) : [],
          bcc: showBcc && bcc ? parseAddresses(bcc) : [],
          subject, textBody: body,
        }),
      });
      const data = await res.json();
      if (data.ok) onClose();
      else setError(data.error ?? "Failed to save draft.");
    } catch { setError("Network error."); }
    finally { setSavingDraft(false); }
  };

  const scheduleEmail = async () => {
    if (!to.trim()) { setError("Recipient required."); return; }
    if (!subject.trim()) { setError("Subject required."); return; }
    if (!scheduleAt) { setError("Pick a send time."); return; }
    setScheduling(true);
    setError(null);
    try {
      const res = await fetch("/api/email/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: currentFrom.key,
          sendAt: new Date(scheduleAt).toISOString(),
          to: parseAddresses(to),
          cc: showCc && cc ? parseAddresses(cc) : [],
          bcc: showBcc && bcc ? parseAddresses(bcc) : [],
          subject, textBody: body, inReplyTo, references,
        }),
      });
      const data = await res.json();
      if (data.ok) { onClose(); }
      else setError(data.error ?? "Failed to schedule.");
    } catch { setError("Network error."); }
    finally { setScheduling(false); }
  };

  // Min datetime for the scheduler input — now + 2 min
  const minSchedule = new Date(Date.now() + 2 * 60 * 1000).toISOString().slice(0, 16);

  const multipleAccounts = accounts.length > 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full flex flex-col overflow-hidden"
        style={{
          background: "rgba(10,13,18,0.99)",
          border: "1px solid rgba(0,191,255,0.18)",
          boxShadow: "0 20px 80px rgba(0,0,0,0.8)",
          maxWidth: "min(100vw, 42rem)",
          marginLeft: "auto",
          marginRight: "auto",
          height: "calc(100dvh - 50px)",
          maxHeight: "80vh",
          borderRadius: "1rem",
          marginBottom: 0,
        }}
      >
        {/* Chrome */}
        <div
          className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>
            New Message
          </span>
          <div className="flex items-center gap-1.5">
            {/* Save draft */}
            <button
              onClick={saveDraft}
              disabled={savingDraft || sending || scheduling}
              className="hidden sm:flex px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              {savingDraft ? "Saving…" : "Save Draft"}
            </button>

            {/* Schedule */}
            <button
              onClick={() => setShowScheduler((p) => !p)}
              disabled={sending || savingDraft || scheduling}
              title="Schedule send"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
              style={{
                background: showScheduler ? "rgba(255,183,0,0.15)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${showScheduler ? "rgba(255,183,0,0.4)" : "rgba(255,255,255,0.12)"}`,
                color: showScheduler ? "#f7b700" : "rgba(255,255,255,0.45)",
              }}
            >
              {/* Clock SVG */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="hidden sm:inline">{scheduling ? "Scheduling…" : "Schedule"}</span>
            </button>

            {/* Send */}
            <button
              onClick={send}
              disabled={sending || savingDraft || scheduling}
              className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
              style={{
                background: "rgba(0,191,255,0.18)",
                border: "1px solid rgba(0,191,255,0.35)",
                color: "#00bfff",
              }}
            >
              {sending ? "Sending…" : "Send ↑"}
            </button>

            {/* Close / discard */}
            <button
              onClick={onClose}
              title="Discard (Esc)"
              className="w-7 h-7 rounded-md flex items-center justify-center text-xs hover:bg-white/10 transition-all"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className="flex flex-col flex-shrink-0">
          {/* From */}
          <div
            className="flex items-center gap-3 px-4 py-2 text-[11px]"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
          >
            <span className="font-semibold flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)", minWidth: 40 }}>From</span>
            {multipleAccounts ? (
              <select
                value={fromKey}
                onChange={(e) => setFromKey(e.target.value)}
                className="flex-1 bg-transparent outline-none text-[11px] cursor-pointer"
                style={{ color: "rgba(255,255,255,0.6)", border: "none" }}
              >
                {accounts.map((a) => (
                  <option key={a.key} value={a.key} style={{ background: "#0a0d12", color: "rgba(255,255,255,0.8)" }}>
                    {a.label} &lt;{a.email}&gt;
                  </option>
                ))}
              </select>
            ) : (
              <span style={{ color: "rgba(255,255,255,0.5)" }}>
                {currentFrom.label} &lt;{currentFrom.email}&gt;
              </span>
            )}
          </div>

          {/* To */}
          <FieldRow label="To" extra={
            <div className="flex gap-2">
              {!showCc && <button onClick={() => setShowCc(true)} className="text-[9px] hover:text-white/60 transition-all" style={{ color: "rgba(255,255,255,0.2)" }}>+Cc</button>}
              {!showBcc && <button onClick={() => setShowBcc(true)} className="text-[9px] hover:text-white/60 transition-all" style={{ color: "rgba(255,255,255,0.2)" }}>+Bcc</button>}
            </div>
          }>
            <AddressInput inputRef={toRef} value={to} onChange={setTo} account={currentFrom.key} placeholder="recipient@example.com" />
          </FieldRow>

          {showCc && (
            <FieldRow label="Cc">
              <AddressInput value={cc} onChange={setCc} account={currentFrom.key} placeholder="cc@example.com" />
            </FieldRow>
          )}
          {showBcc && (
            <FieldRow label="Bcc">
              <AddressInput value={bcc} onChange={setBcc} account={currentFrom.key} placeholder="bcc@example.com" />
            </FieldRow>
          )}

          {/* Subject */}
          <FieldRow label="Subject">
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 bg-transparent outline-none text-[12px] font-medium"
              style={{ color: "rgba(255,255,255,0.85)" }} />
          </FieldRow>
        </div>

        {/* Body */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message…"
          className="flex-1 px-4 py-3 bg-transparent outline-none resize-none text-[12px] leading-relaxed overflow-y-auto"
          style={{ color: "rgba(255,255,255,0.75)", minHeight: 120 }}
        />

        {/* Scheduler panel */}
        {showScheduler && (
          <div
            className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5"
            style={{ borderTop: "1px solid rgba(255,183,0,0.15)", background: "rgba(255,183,0,0.04)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f7b700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span className="text-[11px] flex-shrink-0" style={{ color: "rgba(255,183,0,0.7)" }}>Send at</span>
            <input
              type="datetime-local"
              value={scheduleAt}
              min={minSchedule}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[11px]"
              style={{ color: "rgba(255,255,255,0.7)", border: "none", colorScheme: "dark" }}
            />
            <button
              onClick={scheduleEmail}
              disabled={!scheduleAt || scheduling}
              className="px-3 py-1 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40 flex-shrink-0"
              style={{
                background: "rgba(255,183,0,0.18)",
                border: "1px solid rgba(255,183,0,0.4)",
                color: "#f7b700",
              }}
            >
              {scheduling ? "Scheduling…" : "Confirm"}
            </button>
          </div>
        )}

        {/* Mobile save draft (shown below body on small screens) */}
        <div className="flex-shrink-0 flex sm:hidden px-4 py-2 gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <button
            onClick={saveDraft}
            disabled={savingDraft || sending}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" }}
          >
            {savingDraft ? "Saving…" : "Save Draft"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div
            className="px-4 py-2 text-[11px] flex-shrink-0"
            style={{ background: "rgba(255,60,60,0.08)", color: "rgba(255,100,100,0.8)", borderTop: "1px solid rgba(255,60,60,0.15)" }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Address autocomplete input ────────────────────────────────────────────────

type AddressInputProps = {
  value: string;
  onChange: (v: string) => void;
  account: string;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

function AddressInput({ value, onChange, account, placeholder, inputRef }: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<{ name?: string; email: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getLastToken = (raw: string) => {
    const parts = raw.split(/[,;]/);
    return parts[parts.length - 1].trim();
  };

  const replaceLastToken = (raw: string, replacement: string) => {
    const parts = raw.split(/[,;]/);
    parts[parts.length - 1] = " " + replacement;
    return parts.join(",").replace(/^,\s*/, "") + ", ";
  };

  const fetchSuggestions = useCallback((q: string) => {
    if (!q || q.length < 1) { setSuggestions([]); setOpen(false); return; }
    fetch(`/api/email/contacts?account=${account}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d: { contacts?: { name?: string; email: string }[] }) => {
        const results = d.contacts ?? [];
        setSuggestions(results);
        setOpen(results.length > 0);
        setActiveIdx(0);
      })
      .catch(() => {});
  }, [account]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    const token = getLastToken(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(token), 120);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" || e.key === "Tab") { if (suggestions[activeIdx]) { e.preventDefault(); pick(suggestions[activeIdx]); } }
    if (e.key === "Escape") { setOpen(false); }
  };

  const pick = (contact: { name?: string; email: string }) => {
    const label = contact.name ? `${contact.name} <${contact.email}>` : contact.email;
    onChange(replaceLastToken(value, label));
    setSuggestions([]);
    setOpen(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="flex-1 relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { const t = getLastToken(value); if (t) fetchSuggestions(t); }}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none text-[12px]"
        style={{ color: "rgba(255,255,255,0.8)" }}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {open && suggestions.length > 0 && (
        <div
          className="absolute left-0 top-full z-50 rounded-xl overflow-hidden"
          style={{
            background: "rgba(10,13,20,0.98)",
            border: "1px solid rgba(0,191,255,0.18)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
            minWidth: 260,
            marginTop: 4,
          }}
        >
          {suggestions.map((c, i) => (
            <button
              key={c.email}
              onMouseDown={(e) => { e.preventDefault(); pick(c); }}
              onMouseEnter={() => setActiveIdx(i)}
              className="w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors"
              style={{
                background: i === activeIdx ? "rgba(0,191,255,0.10)" : "transparent",
                borderBottom: i < suggestions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}
            >
              {c.name && <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>{c.name}</span>}
              <span className="text-[10px]" style={{ color: "rgba(0,191,255,0.7)" }}>{c.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, children, extra }: { label: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", overflow: "visible" }}
    >
      <span className="font-semibold text-[11px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)", minWidth: 40 }}>{label}</span>
      {children}
      {extra}
    </div>
  );
}

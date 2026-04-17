"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import { ModalBackdrop, CloseBtn } from "../../styled";
import { type AccountMeta } from "./AccountSwitcher";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Styled                                                             */
/* ------------------------------------------------------------------ */

const Backdrop = styled(ModalBackdrop)`
  display: flex;
  align-items: flex-end;
  justify-content: center;
  @media (min-width: 640px) {
    align-items: center;
  }
`;

const Container = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(10, 13, 18, 0.99);
  border: 1px solid rgba(${rgb.cyan}, 0.18);
  box-shadow: 0 20px 80px rgba(0, 0, 0, 0.8);
  max-width: min(100vw, 42rem);
  margin-left: auto;
  margin-right: auto;
  height: calc(100dvh - 50px);
  max-height: 80vh;
  border-radius: 1rem;
  margin-bottom: 0;

  [data-theme="light"] & {
    background: rgba(255, 255, 255, 0.99);
    border-color: var(--t-border);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  }
`;

const Chrome = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  [data-theme="light"] & {
    border-bottom-color: var(--t-border);
  }
`;

const ChromeTitle = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: var(--t-textMuted, rgba(255, 255, 255, 0.6));
`;

const ChromeActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const GhostBtn = styled.button`
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.15s;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: var(--t-textGhost, rgba(255, 255, 255, 0.45));
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: var(--t-border);
    color: var(--t-textMuted);
  }
`;

const SaveDraftDesktop = styled(GhostBtn)`
  display: none;
  @media (min-width: 640px) {
    display: flex;
  }
`;

const ScheduleBtn = styled(GhostBtn)<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  background: ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.15)` : "rgba(255, 255, 255, 0.06)")};
  border-color: ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.4)` : "rgba(255, 255, 255, 0.12)")};
  color: ${(p) => (p.$active ? colors.gold : "rgba(255, 255, 255, 0.45)")};

  [data-theme="light"] & {
    background: ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.12)` : "var(--t-surface)")};
    border-color: ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.35)` : "var(--t-border)")};
    color: ${(p) => (p.$active ? colors.gold : "var(--t-textMuted)")};
  }
`;

const ScheduleLabel = styled.span`
  display: none;
  @media (min-width: 640px) {
    display: inline;
  }
`;

const SendBtn = styled.button`
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  transition: all 0.15s;
  background: rgba(${rgb.cyan}, 0.18);
  border: 1px solid rgba(${rgb.cyan}, 0.35);
  color: ${colors.cyan};
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  [data-theme="light"] & {
    background: rgba(${rgb.cyan}, 0.12);
    border-color: rgba(${rgb.cyan}, 0.3);
  }
`;

const CloseButton = styled(CloseBtn)`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  [data-theme="light"] & {
    color: var(--t-textFaint);
    &:hover {
      background: rgba(0, 0, 0, 0.06);
    }
  }
`;

const FieldsWrap = styled.div`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
`;

const FieldRowWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  overflow: visible;

  [data-theme="light"] & {
    border-bottom-color: var(--t-border);
  }
`;

const FieldLabel = styled.span`
  font-weight: 600;
  font-size: 11px;
  flex-shrink: 0;
  min-width: 40px;
  color: rgba(255, 255, 255, 0.25);

  [data-theme="light"] & {
    color: var(--t-textFaint);
  }
`;

const FromRow = styled(FieldRowWrap)`
  font-size: 11px;
`;

const FromSelect = styled.select`
  flex: 1;
  background: transparent;
  outline: none;
  font-size: 11px;
  cursor: pointer;
  color: var(--t-textMuted, rgba(255, 255, 255, 0.6));
  border: none;
`;

const FromOption = styled.option`
  background: #0a0d12;
  color: rgba(255, 255, 255, 0.8);

  [data-theme="light"] & {
    background: #fff;
    color: var(--t-text);
  }
`;

const FromStatic = styled.span`
  color: rgba(255, 255, 255, 0.5);

  [data-theme="light"] & {
    color: var(--t-textMuted);
  }
`;

const CcToggle = styled.button`
  font-size: 9px;
  color: rgba(255, 255, 255, 0.2);
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    color: rgba(255, 255, 255, 0.6);
  }

  [data-theme="light"] & {
    color: var(--t-textGhost);
    &:hover {
      color: var(--t-textMuted);
    }
  }
`;

const SubjectInput = styled.input`
  flex: 1;
  background: transparent;
  outline: none;
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  border: none;

  [data-theme="light"] & {
    color: var(--t-text);
  }
`;

const BodyArea = styled.textarea`
  flex: 1;
  padding: 12px 16px;
  background: transparent;
  outline: none;
  resize: none;
  font-size: 12px;
  line-height: 1.625;
  overflow-y: auto;
  color: rgba(255, 255, 255, 0.75);
  min-height: 120px;
  border: none;

  [data-theme="light"] & {
    color: var(--t-text);
  }
`;

const SchedulerBar = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-top: 1px solid rgba(${rgb.gold}, 0.15);
  background: rgba(${rgb.gold}, 0.04);

  [data-theme="light"] & {
    border-top-color: rgba(${rgb.gold}, 0.2);
    background: rgba(${rgb.gold}, 0.06);
  }
`;

const SchedulerLabel = styled.span`
  font-size: 11px;
  flex-shrink: 0;
  color: rgba(${rgb.gold}, 0.7);
`;

const SchedulerInput = styled.input`
  flex: 1;
  background: transparent;
  outline: none;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  border: none;
  color-scheme: dark;

  [data-theme="light"] & {
    color: var(--t-text);
    color-scheme: light;
  }
`;

const SchedulerConfirm = styled.button`
  padding: 4px 12px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  transition: all 0.15s;
  flex-shrink: 0;
  background: rgba(${rgb.gold}, 0.18);
  border: 1px solid rgba(${rgb.gold}, 0.4);
  color: ${colors.gold};
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

const MobileDraftBar = styled.div`
  flex-shrink: 0;
  display: flex;
  padding: 8px 16px;
  gap: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);

  @media (min-width: 640px) {
    display: none;
  }

  [data-theme="light"] & {
    border-top-color: var(--t-border);
  }
`;

const MobileDraftBtn = styled(GhostBtn)`
  flex: 1;
  padding: 8px;
`;

const ErrorBar = styled.div`
  padding: 8px 16px;
  font-size: 11px;
  flex-shrink: 0;
  background: rgba(${rgb.red}, 0.08);
  color: rgba(255, 100, 100, 0.8);
  border-top: 1px solid rgba(${rgb.red}, 0.15);

  [data-theme="light"] & {
    background: rgba(${rgb.red}, 0.06);
    color: ${colors.red};
    border-top-color: rgba(${rgb.red}, 0.2);
  }
`;

/* --- AddressInput styled --- */

const AddressWrap = styled.div`
  flex: 1;
  position: relative;
`;

const AddressField = styled.input`
  width: 100%;
  background: transparent;
  outline: none;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  border: none;

  [data-theme="light"] & {
    color: var(--t-text);
  }
`;

const SuggestionsDropdown = styled.div`
  position: absolute;
  left: 0;
  top: 100%;
  z-index: 50;
  border-radius: 12px;
  overflow: hidden;
  min-width: 260px;
  margin-top: 4px;
  background: rgba(10, 13, 20, 0.98);
  border: 1px solid rgba(${rgb.cyan}, 0.18);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);

  [data-theme="light"] & {
    background: #fff;
    border-color: var(--t-border);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  }
`;

const SuggestionItem = styled.button<{ $active: boolean; $last: boolean }>`
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: background 0.1s;
  background: ${(p) => (p.$active ? `rgba(${rgb.cyan}, 0.10)` : "transparent")};
  border: none;
  border-bottom: ${(p) => (p.$last ? "none" : "1px solid rgba(255, 255, 255, 0.04)")};
  cursor: pointer;

  [data-theme="light"] & {
    background: ${(p) => (p.$active ? `rgba(${rgb.cyan}, 0.08)` : "transparent")};
    border-bottom-color: var(--t-border);
  }
`;

const SuggestionName = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);

  [data-theme="light"] & {
    color: var(--t-text);
  }
`;

const SuggestionEmail = styled.span`
  font-size: 10px;
  color: rgba(${rgb.cyan}, 0.7);
`;

/* ------------------------------------------------------------------ */
/*  AddressInput                                                       */
/* ------------------------------------------------------------------ */

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

  const fetchSuggestions = useCallback(
    (q: string) => {
      if (!q || q.length < 1) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      fetch(`/api/email/contacts?account=${account}&q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d: { contacts?: { name?: string; email: string }[] }) => {
          const results = d.contacts ?? [];
          setSuggestions(results);
          setOpen(results.length > 0);
          setActiveIdx(0);
        })
        .catch(() => {});
    },
    [account],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    const token = getLastToken(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(token), 120);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" || e.key === "Tab") {
      if (suggestions[activeIdx]) {
        e.preventDefault();
        pick(suggestions[activeIdx]);
      }
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
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
    <AddressWrap ref={containerRef}>
      <AddressField
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          const t = getLastToken(value);
          if (t) fetchSuggestions(t);
        }}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {open && suggestions.length > 0 && (
        <SuggestionsDropdown>
          {suggestions.map((c, i) => (
            <SuggestionItem
              key={c.email}
              $active={i === activeIdx}
              $last={i === suggestions.length - 1}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              {c.name && <SuggestionName>{c.name}</SuggestionName>}
              <SuggestionEmail>{c.email}</SuggestionEmail>
            </SuggestionItem>
          ))}
        </SuggestionsDropdown>
      )}
    </AddressWrap>
  );
}

/* ------------------------------------------------------------------ */
/*  FieldRow                                                           */
/* ------------------------------------------------------------------ */

function FieldRow({
  label,
  children,
  extra,
}: {
  label: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <FieldRowWrap>
      <FieldLabel>{label}</FieldLabel>
      {children}
      {extra}
    </FieldRowWrap>
  );
}

/* ------------------------------------------------------------------ */
/*  ComposeModal                                                       */
/* ------------------------------------------------------------------ */

export default function ComposeModal({
  fromEmail,
  fromLabel,
  account,
  accounts = [],
  pinVerified,
  initialTo = [],
  initialSubject = "",
  initialBody = "",
  initialCc = [],
  inReplyTo,
  references,
  onClose,
  onSent,
}: Props) {
  const [fromKey, setFromKey] = useState(account);
  const currentFrom = accounts.find((a) => a.key === fromKey) ?? {
    key: account,
    email: fromEmail,
    label: fromLabel,
  };

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

  useEffect(() => {
    toRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose]);

  const parseAddresses = (raw: string): AddressEntry[] =>
    raw
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => ({ email: s }));

  const send = async () => {
    if (!to.trim()) {
      setError("Recipient required.");
      return;
    }
    if (!subject.trim()) {
      setError("Subject required.");
      return;
    }
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
          subject,
          textBody: body,
          inReplyTo,
          references,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        onSent();
        onClose();
      } else setError(data.error ?? "Failed to send.");
    } catch {
      setError("Network error.");
    } finally {
      setSending(false);
    }
  };

  const saveDraft = async () => {
    if (!subject.trim() && !body.trim() && !to.trim()) {
      onClose();
      return;
    }
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
          subject,
          textBody: body,
        }),
      });
      const data = await res.json();
      if (data.ok) onClose();
      else setError(data.error ?? "Failed to save draft.");
    } catch {
      setError("Network error.");
    } finally {
      setSavingDraft(false);
    }
  };

  const scheduleEmail = async () => {
    if (!to.trim()) {
      setError("Recipient required.");
      return;
    }
    if (!subject.trim()) {
      setError("Subject required.");
      return;
    }
    if (!scheduleAt) {
      setError("Pick a send time.");
      return;
    }
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
          subject,
          textBody: body,
          inReplyTo,
          references,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        onClose();
      } else setError(data.error ?? "Failed to schedule.");
    } catch {
      setError("Network error.");
    } finally {
      setScheduling(false);
    }
  };

  const minSchedule = new Date(Date.now() + 2 * 60 * 1000).toISOString().slice(0, 16);
  const multipleAccounts = accounts.length > 1;

  return (
    <Backdrop onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Container>
        {/* Chrome */}
        <Chrome>
          <ChromeTitle>New Message</ChromeTitle>
          <ChromeActions>
            <SaveDraftDesktop
              onClick={saveDraft}
              disabled={savingDraft || sending || scheduling}
            >
              {savingDraft ? "Saving\u2026" : "Save Draft"}
            </SaveDraftDesktop>
            <ScheduleBtn
              $active={showScheduler}
              onClick={() => setShowScheduler((p) => !p)}
              disabled={sending || savingDraft || scheduling}
              title="Schedule send"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <ScheduleLabel>
                {scheduling ? "Scheduling\u2026" : "Schedule"}
              </ScheduleLabel>
            </ScheduleBtn>
            <SendBtn onClick={send} disabled={sending || savingDraft || scheduling}>
              {sending ? "Sending\u2026" : "Send \u2191"}
            </SendBtn>
            <CloseButton onClick={onClose} title="Discard (Esc)">
              \u2715
            </CloseButton>
          </ChromeActions>
        </Chrome>

        {/* Fields */}
        <FieldsWrap>
          <FromRow>
            <FieldLabel>From</FieldLabel>
            {multipleAccounts ? (
              <FromSelect value={fromKey} onChange={(e) => setFromKey(e.target.value)}>
                {accounts.map((a) => (
                  <FromOption key={a.key} value={a.key}>
                    {a.label} &lt;{a.email}&gt;
                  </FromOption>
                ))}
              </FromSelect>
            ) : (
              <FromStatic>
                {currentFrom.label} &lt;{currentFrom.email}&gt;
              </FromStatic>
            )}
          </FromRow>
          <FieldRow
            label="To"
            extra={
              <div style={{ display: "flex", gap: 8 }}>
                {!showCc && (
                  <CcToggle onClick={() => setShowCc(true)}>+Cc</CcToggle>
                )}
                {!showBcc && (
                  <CcToggle onClick={() => setShowBcc(true)}>+Bcc</CcToggle>
                )}
              </div>
            }
          >
            <AddressInput
              inputRef={toRef}
              value={to}
              onChange={setTo}
              account={currentFrom.key}
              placeholder="recipient@example.com"
            />
          </FieldRow>
          {showCc && (
            <FieldRow label="Cc">
              <AddressInput
                value={cc}
                onChange={setCc}
                account={currentFrom.key}
                placeholder="cc@example.com"
              />
            </FieldRow>
          )}
          {showBcc && (
            <FieldRow label="Bcc">
              <AddressInput
                value={bcc}
                onChange={setBcc}
                account={currentFrom.key}
                placeholder="bcc@example.com"
              />
            </FieldRow>
          )}
          <FieldRow label="Subject">
            <SubjectInput
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />
          </FieldRow>
        </FieldsWrap>

        <BodyArea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message\u2026"
        />

        {showScheduler && (
          <SchedulerBar>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.gold}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <SchedulerLabel>Send at</SchedulerLabel>
            <SchedulerInput
              type="datetime-local"
              value={scheduleAt}
              min={minSchedule}
              onChange={(e) => setScheduleAt(e.target.value)}
            />
            <SchedulerConfirm
              onClick={scheduleEmail}
              disabled={!scheduleAt || scheduling}
            >
              {scheduling ? "Scheduling\u2026" : "Confirm"}
            </SchedulerConfirm>
          </SchedulerBar>
        )}

        <MobileDraftBar>
          <MobileDraftBtn onClick={saveDraft} disabled={savingDraft || sending}>
            {savingDraft ? "Saving\u2026" : "Save Draft"}
          </MobileDraftBtn>
        </MobileDraftBar>

        {error && <ErrorBar>{error}</ErrorBar>}
      </Container>
    </Backdrop>
  );
}

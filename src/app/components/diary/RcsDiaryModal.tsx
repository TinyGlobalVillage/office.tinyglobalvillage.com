"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
} from "@/app/styled";
import NeonX from "../NeonX";

type EntryType = "log" | "decision" | "observation" | "learning" | "incident";
type FilterValue = "all" | EntryType;

interface DayHeadline {
  nn: string;
  slug: string;
  time: string;
  type: EntryType;
  title: string;
  summary: string;
}

interface Day {
  date: string;
  count: number;
  headlines: DayHeadline[];
}

interface FullEntry {
  meta: { date?: string; time?: string; slug?: string; title?: string; type?: string; tags?: string[] };
  summary: string;
  body: string;
}

const TYPE_RGB: Record<EntryType, string> = {
  log: "var(--t-textFaint)",
  decision: `rgb(${rgb.gold})`,
  observation: `rgb(${rgb.cyan})`,
  learning: `rgb(${rgb.violet})`,
  incident: `rgb(${rgb.red})`,
};

const TYPE_LABEL: Record<EntryType, string> = {
  log: "log",
  decision: "decision",
  observation: "observation",
  learning: "learning",
  incident: "incident",
};

/* ── Inline QMBM (lavender popover; reads template live) ───────────── */

const QmbmTrigger = styled.button`
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  border: 1px solid rgba(167, 139, 250, 0.5);
  background: rgba(167, 139, 250, 0.1);
  color: rgb(167, 139, 250);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  &:hover {
    background: rgba(167, 139, 250, 0.22);
  }
`;

const QmbmPopover = styled.div`
  position: absolute;
  top: 2.6rem;
  left: 1.5rem;
  z-index: 110;
  width: min(480px, 70vw);
  max-height: 50vh;
  overflow-y: auto;
  border: 1px solid rgba(167, 139, 250, 0.4);
  background: var(--t-cardGrad);
  border-radius: 8px;
  padding: 1rem 1.2rem;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 24px rgba(167, 139, 250, 0.15);
  font-size: 0.78rem;
  color: var(--t-text);
  line-height: 1.55;
  pre {
    background: var(--t-inputBg);
    padding: 0.6rem 0.75rem;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 0.72rem;
  }
  h1, h2, h3 { color: rgb(167, 139, 250); margin: 0.6rem 0 0.3rem; }
`;

function Qmbm({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative" }}>
      <QmbmTrigger
        type="button"
        aria-label="Diary entry scaffolding reference"
        onClick={() => setOpen((s) => !s)}
      >
        ?
      </QmbmTrigger>
      {open && (
        <QmbmPopover onClick={(e) => e.stopPropagation()}>
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content || "Loading template…") }} />
        </QmbmPopover>
      )}
    </span>
  );
}

/* ── Markdown rendering (lightweight; mirrors Read Me's modal) ─────── */

function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^- \[ \] (.*)$/gm, '<div class="task">☐ $1</div>')
    .replace(/^- \[x\] (.*)$/gm, '<div class="task done">☑ $1</div>')
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}

/* ── Styled (cyan-themed to match Utils sections) ─────────────────── */

const MenuBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--t-border);
  align-items: center;
  background: rgba(${rgb.cyan}, 0.04);
`;

const Pill = styled.button<{ $active?: boolean }>`
  padding: 0.4rem 0.85rem;
  font-size: 0.78rem;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.cyan}, 0.6)` : "var(--t-border)")};
  background: ${(p) => (p.$active ? `rgba(${rgb.cyan}, 0.16)` : "transparent")};
  color: ${(p) => (p.$active ? `rgb(${rgb.cyan})` : "var(--t-text)")};
  cursor: pointer;
  &:hover { background: rgba(${rgb.cyan}, 0.1); }
`;

const Search = styled.input`
  flex: 1;
  min-width: 12rem;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--t-border);
  background: var(--t-inputBg);
  color: var(--t-text);
  font-size: 0.85rem;
`;

const NewBtn = styled.button`
  padding: 0.4rem 0.9rem;
  font-size: 0.85rem;
  border-radius: 6px;
  border: 1px solid rgba(${rgb.cyan}, 0.5);
  background: rgba(${rgb.cyan}, 0.12);
  color: rgb(${rgb.cyan});
  cursor: pointer;
  &:hover { background: rgba(${rgb.cyan}, 0.22); }
`;

const DayList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const AdlOuter = styled.div`
  width: 100%;
  box-sizing: border-box;
`;

const AdlOuterHeader = styled.button<{ $open: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 1rem;
  border-radius: 8px;
  border: 1px solid ${(p) => (p.$open ? `rgba(${rgb.cyan}, 0.22)` : `rgba(${rgb.cyan}, 0.08)`)};
  background: ${(p) => (p.$open ? `rgba(${rgb.cyan}, 0.06)` : "transparent")};
  color: ${(p) => (p.$open ? `rgb(${rgb.cyan})` : `rgba(${rgb.cyan}, 0.65)`)};
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-align: left;
  min-height: 2.4rem;
  &:hover {
    background: rgba(${rgb.cyan}, 0.1);
    border-color: rgba(${rgb.cyan}, 0.35);
    color: rgb(${rgb.cyan});
  }
`;

const Caret = styled.span<{ $open: boolean }>`
  display: inline-block;
  transition: transform 120ms ease;
  transform: rotate(${(p) => (p.$open ? "90deg" : "0deg")});
  font-size: 0.7rem;
  width: 0.7rem;
`;

const DayLabel = styled.span`
  flex: 1;
`;

const CountChip = styled.span`
  font-size: 0.65rem;
  font-weight: 500;
  color: rgba(${rgb.cyan}, 0.6);
`;

const Switch = styled.span<{ $on: boolean }>`
  width: 28px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.7)` : "var(--t-border)")};
  background: ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.3)` : "var(--t-inputBg)")};
  position: relative;
  flex-shrink: 0;
  &::after {
    content: "";
    position: absolute;
    top: 1px;
    left: ${(p) => (p.$on ? "15px" : "1px")};
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${(p) => (p.$on ? `rgb(${rgb.cyan})` : "var(--t-textFaint)")};
    box-shadow: ${(p) => (p.$on ? `0 0 8px rgba(${rgb.cyan}, 0.6)` : "none")};
    transition: left 120ms;
  }
`;

const AdlOuterBody = styled.div`
  padding: 0.5rem 0.5rem 0.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const AdlInner = styled.div<{ $type: EntryType }>`
  border-left: 4px solid ${(p) => TYPE_RGB[p.$type]};
  padding-left: 0;
`;

const AdlInnerHeader = styled.button<{ $open: boolean; $type: EntryType }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.8rem;
  border-radius: 0 6px 6px 0;
  border: 1px solid ${(p) => (p.$open ? "var(--t-border)" : "transparent")};
  background: ${(p) => (p.$open ? "rgba(255,255,255,0.03)" : "transparent")};
  color: var(--t-text);
  cursor: pointer;
  text-align: left;
  font-size: 0.85rem;
  &:hover { background: rgba(255,255,255,0.05); }
`;

const TimeSpan = styled.span`
  font-size: 0.72rem;
  color: var(--t-textFaint);
  font-variant-numeric: tabular-nums;
`;

const TypeChip = styled.span<{ $type: EntryType }>`
  font-size: 0.65rem;
  padding: 0.1rem 0.45rem;
  border-radius: 4px;
  border: 1px solid ${(p) => TYPE_RGB[p.$type]};
  color: ${(p) => TYPE_RGB[p.$type]};
  text-transform: lowercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
`;

const SummaryText = styled.span`
  flex: 1;
  font-size: 0.78rem;
  color: var(--t-textFaint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const EntryBody = styled.div`
  padding: 0.85rem 1rem 1rem 1rem;
  font-size: 0.85rem;
  line-height: 1.55;
  color: var(--t-text);
  h1 { font-size: 1.05rem; margin: 0.6rem 0 0.4rem; }
  h2 { font-size: 0.95rem; margin: 0.8rem 0 0.4rem; color: rgb(${rgb.cyan}); }
  h3 { font-size: 0.85rem; margin: 0.5rem 0 0.3rem; }
  blockquote {
    border-left: 3px solid rgba(${rgb.cyan}, 0.5);
    padding-left: 0.75rem;
    color: var(--t-textFaint);
    font-style: italic;
    margin: 0.5rem 0;
  }
  ul { padding-left: 1.5rem; }
  .task { margin: 0.2rem 0; }
  .task.done { color: var(--t-textFaint); text-decoration: line-through; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem; padding: 0 0.2rem; background: var(--t-inputBg); border-radius: 3px; }
`;

const Empty = styled.div`
  text-align: center;
  padding: 2rem 1rem;
  color: var(--t-textFaint);
  font-size: 0.85rem;
`;

/* ── New entry inline form ───────────────────────────────────────── */

const FormCard = styled.div`
  border: 1px solid rgba(${rgb.cyan}, 0.3);
  border-radius: 8px;
  background: rgba(${rgb.cyan}, 0.04);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: 7rem 1fr;
  gap: 0.5rem;
  align-items: start;
`;

const FormLabel = styled.label`
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--t-textFaint);
  padding-top: 0.45rem;
`;

const FormInput = styled.input`
  padding: 0.45rem 0.65rem;
  border-radius: 6px;
  border: 1px solid var(--t-border);
  background: var(--t-inputBg);
  color: var(--t-text);
  font-size: 0.85rem;
`;

const FormSelect = styled.select`
  padding: 0.45rem 0.65rem;
  border-radius: 6px;
  border: 1px solid var(--t-border);
  background: var(--t-inputBg);
  color: var(--t-text);
  font-size: 0.85rem;
`;

const FormTextarea = styled.textarea`
  padding: 0.55rem 0.7rem;
  border-radius: 6px;
  border: 1px solid var(--t-border);
  background: var(--t-inputBg);
  color: var(--t-text);
  font-size: 0.85rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  min-height: 14rem;
  line-height: 1.45;
  resize: vertical;
`;

const FormActions = styled.div`
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
`;

const SaveBtn = styled.button<{ $disabled?: boolean }>`
  padding: 0.45rem 1rem;
  font-size: 0.85rem;
  border-radius: 6px;
  border: 1px solid rgba(${rgb.cyan}, 0.6);
  background: ${(p) => (p.$disabled ? "rgba(0,0,0,0.2)" : `rgba(${rgb.cyan}, 0.18)`)};
  color: rgb(${rgb.cyan});
  cursor: ${(p) => (p.$disabled ? "not-allowed" : "pointer")};
  opacity: ${(p) => (p.$disabled ? 0.5 : 1)};
`;

const CancelBtn = styled.button`
  padding: 0.45rem 1rem;
  font-size: 0.85rem;
  border-radius: 6px;
  border: 1px solid var(--t-border);
  background: transparent;
  color: var(--t-text);
  cursor: pointer;
`;

const ENTRY_BOILERPLATE = `> One-sentence headline that the index card can quote verbatim.

## What happened

Two paragraphs at most. Be specific — file paths, commit hashes, decisions made.

## Why

The motivation. The "why" tends to fade from memory faster than the "what".

## Actionables

- [ ] First concrete follow-up
- [ ] Second concrete follow-up
`;

/* ── Modal ───────────────────────────────────────────────────────── */

interface Props {
  onClose: () => void;
}

const FILTER_OPTIONS: FilterValue[] = ["all", "log", "decision", "observation", "learning", "incident"];

export default function RcsDiaryModal({ onClose }: Props) {
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDates, setOpenDates] = useState<Set<string>>(new Set());
  const [openEntries, setOpenEntries] = useState<Map<string, FullEntry>>(new Map());
  const [filter, setFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [template, setTemplate] = useState<string>("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/diary/index").then((x) => x.json());
      const ds = (r.days ?? []) as Day[];
      setDays(ds);
      if (ds[0] && openDates.size === 0) {
        setOpenDates(new Set([ds[0].date]));
      }
    } finally {
      setLoading(false);
    }
  }, [openDates.size]);

  useEffect(() => {
    refresh();
    fetch("/api/diary/template")
      .then((r) => r.json())
      .then((d) => setTemplate(d.content ?? ""));
  }, [refresh]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.toLowerCase().trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleDate = (date: string) => {
    setOpenDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const toggleEntry = async (date: string, slug: string) => {
    const key = `${date}/${slug}`;
    setOpenEntries((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      // Defer fetch; mark as loading by inserting placeholder; replaced when fetch completes.
      next.set(key, { meta: {}, summary: "", body: "Loading…" });
      return next;
    });
    const r = await fetch(`/api/diary/${date}/${slug}`).then((x) => x.json());
    setOpenEntries((prev) => {
      const next = new Map(prev);
      if (!next.has(key)) return prev;
      next.set(key, { meta: r.meta ?? {}, summary: r.summary ?? "", body: r.body ?? "" });
      return next;
    });
  };

  const visibleDays = useMemo(() => {
    return days
      .map((d) => {
        const headlines = d.headlines.filter((h) => {
          if (filter !== "all" && h.type !== filter) return false;
          if (debouncedSearch) {
            const hay = `${h.title} ${h.summary} ${h.slug}`.toLowerCase();
            if (!hay.includes(debouncedSearch)) return false;
          }
          return true;
        });
        return { ...d, headlines, count: headlines.length };
      })
      .filter((d) => d.count > 0 || (filter === "all" && !debouncedSearch));
  }, [days, filter, debouncedSearch]);

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer
        $accent="cyan"
        $maxWidth="60rem"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle $color={colors.cyan}>RCS Diary</ModalTitle>
            <Qmbm content={template} />
          </ModalHeaderLeft>
          <NeonX onClick={onClose} accent="cyan" />
        </ModalHeader>

        <MenuBar>
          <NewBtn onClick={() => setShowForm((s) => !s)}>
            {showForm ? "× Cancel" : "+ New entry"}
          </NewBtn>
          <span style={{ fontSize: "0.72rem", color: "var(--t-textFaint)" }}>Filter:</span>
          {FILTER_OPTIONS.map((f) => (
            <Pill key={f} $active={filter === f} onClick={() => setFilter(f)}>
              {f}
            </Pill>
          ))}
          <Search
            value={search}
            placeholder="Search title / summary / slug…"
            onChange={(e) => setSearch(e.target.value)}
          />
        </MenuBar>

        <ModalBody $padding="1rem">
          {showForm && <NewEntryForm onClose={() => setShowForm(false)} onCreated={refresh} />}
          {loading && <Empty>Loading…</Empty>}
          {!loading && visibleDays.length === 0 && (
            <Empty>
              No entries match. Type a different search or filter, or click <strong>+ New entry</strong> to write one.
            </Empty>
          )}
          {!loading && (
            <DayList>
              {visibleDays.map((d) => (
                <AdlOuter key={d.date}>
                  <AdlOuterHeader $open={openDates.has(d.date)} onClick={() => toggleDate(d.date)}>
                    <Caret $open={openDates.has(d.date)}>▶</Caret>
                    <DayLabel>{d.date}</DayLabel>
                    <CountChip>
                      {d.count} {d.count === 1 ? "entry" : "entries"}
                    </CountChip>
                    <Switch $on={openDates.has(d.date)} />
                  </AdlOuterHeader>
                  {openDates.has(d.date) && (
                    <AdlOuterBody>
                      {d.headlines.map((h) => {
                        const key = `${d.date}/${h.slug}`;
                        const isOpen = openEntries.has(key);
                        const full = isOpen ? openEntries.get(key) : null;
                        return (
                          <AdlInner key={key} $type={h.type}>
                            <AdlInnerHeader
                              $open={isOpen}
                              $type={h.type}
                              onClick={() => toggleEntry(d.date, h.slug)}
                            >
                              <Caret $open={isOpen}>▶</Caret>
                              <TimeSpan>{h.time || "--:--"}</TimeSpan>
                              <TypeChip $type={h.type}>{TYPE_LABEL[h.type]}</TypeChip>
                              <SummaryText title={h.title}>
                                {h.summary || h.title}
                              </SummaryText>
                            </AdlInnerHeader>
                            {isOpen && full && (
                              <EntryBody
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(full.body) }}
                              />
                            )}
                          </AdlInner>
                        );
                      })}
                    </AdlOuterBody>
                  )}
                </AdlOuter>
              ))}
            </DayList>
          )}
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}

/* ── New entry form ──────────────────────────────────────────────── */

function NewEntryForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState<EntryType>("log");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState(ENTRY_BOILERPLATE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const slugFromTitle = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60);

  useEffect(() => {
    if (!slug && title) setSlug(slugFromTitle(title));
  }, [title, slug]);

  const submit = async () => {
    setError(null);
    if (!title.trim()) return setError("title required");
    if (!slug.trim()) return setError("slug required");
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return setError("slug must be kebab-case ([a-z0-9-]+)");
    setBusy(true);
    const r = await fetch(`/api/diary/${today}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        title: title.trim(),
        type,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        content,
      }),
    }).then((x) => x.json());
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    onCreated();
    onClose();
  };

  return (
    <FormCard style={{ marginBottom: "1rem" }}>
      <FormRow>
        <FormLabel>Title</FormLabel>
        <FormInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sentence-case, no trailing period" />
      </FormRow>
      <FormRow>
        <FormLabel>Slug</FormLabel>
        <FormInput value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="kebab-case-verb-led" />
      </FormRow>
      <FormRow>
        <FormLabel>Type</FormLabel>
        <FormSelect value={type} onChange={(e) => setType(e.target.value as EntryType)}>
          <option value="log">log — routine "we did X"</option>
          <option value="decision">decision — chose A over B because…</option>
          <option value="observation">observation — pattern, drift, hunch</option>
          <option value="learning">learning — this stuck</option>
          <option value="incident">incident — system broke, fixed by…</option>
        </FormSelect>
      </FormRow>
      <FormRow>
        <FormLabel>Tags</FormLabel>
        <FormInput value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated, optional" />
      </FormRow>
      <FormRow>
        <FormLabel>Body</FormLabel>
        <FormTextarea value={content} onChange={(e) => setContent(e.target.value)} />
      </FormRow>
      {error && <div style={{ color: `rgb(${rgb.red})`, fontSize: "0.78rem" }}>{error}</div>}
      <FormActions>
        <CancelBtn onClick={onClose}>Cancel</CancelBtn>
        <SaveBtn $disabled={busy} onClick={submit}>
          {busy ? "Saving…" : "Save entry"}
        </SaveBtn>
      </FormActions>
    </FormCard>
  );
}

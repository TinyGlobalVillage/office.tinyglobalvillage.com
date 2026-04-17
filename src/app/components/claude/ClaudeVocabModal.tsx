"use client";

import { useState, useEffect, useCallback } from "react";
import styled from "styled-components";
import ClaudeIcon from "./ClaudeIcon";
import { renderMarkdown } from "@/lib/markdown";
import { colors, rgb } from "@/app/theme";
import {
  PanelBackdrop,
  Panel,
  PanelHeader,
  PanelIconBtn,
  PanelActionBtn,
  PanelError,
  PanelEditor,
  PanelMarkdown,
  PanelEmptyState,
  PanelSidebar,
  PanelSidebarItem,
  PanelTitle,
  PanelTag,
  PanelToolbar,
  Input,
  Spacer,
} from "@/app/styled";

type FileItem = {
  kind: "root" | "vocab";
  name: string;
  bytes: number;
  mtime: number;
  exists: boolean;
  deletable: boolean;
};

const NEW_TERM_TEMPLATE = (term: string) => `---
name: ${term}
description: <one-line description used as the index hook — be specific>
---

# ${term}

<Definition: what is it?>

**Key visual / behavioral traits:**
-

**Canonical implementation (refusionist):** \`<path>\`

**Related:**
`;

/* ── Local styled ──────────────────────────────────────────────── */

const SplitLayout = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: 220px 1fr;
  overflow: hidden;
`;

const MainPane = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
  scrollbar-width: thin;
`;

const FileName = styled.span`
  font-size: 0.75rem;
  color: var(--t-textMuted);
  font-family: var(--font-geist-mono), monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
`;

const FileSize = styled.span`
  font-size: 0.625rem;
  color: var(--t-textGhost);
`;

const CreateWrap = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
`;

const CreateTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 700;
  margin: 0;
  color: ${colors.orange};
`;

const CreateHint = styled.p`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  max-width: 28rem;
  text-align: center;
  margin: 0;
`;

const CreateInput = styled(Input).attrs({ $accent: "orange" as const })`
  max-width: 16rem;
  text-align: center;
`;

const BtnRow = styled.div`
  display: flex;
  gap: 0.5rem;
`;

/* ── Component ─────────────────────────────────────────────────── */

export default function ClaudeVocabModal({ onClose }: { onClose: () => void }) {
  const [terms, setTerms] = useState<FileItem[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingTerm, setLoadingTerm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTermName, setNewTermName] = useState("");

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch("/api/claude/files");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setTerms(data.items.filter((i: FileItem) => i.kind === "vocab"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadTerm = useCallback(async (name: string) => {
    setActive(name);
    setLoadingTerm(true);
    setEditing(false);
    setCreating(false);
    setError(null);
    try {
      const res = await fetch(`/api/claude/files?file=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setContent(data.content);
      setDraft(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoadingTerm(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (fullscreen) { setFullscreen(false); return; }
        if (creating) { setCreating(false); setNewTermName(""); return; }
        if (editing) { setEditing(false); setDraft(content); return; }
        onClose();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose, fullscreen, editing, creating, content]);

  async function save() {
    if (!active) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/claude/files", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: active, content: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setContent(draft);
      setEditing(false);
      loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function createTerm() {
    const safe = newTermName.trim().replace(/[^A-Za-z0-9_-]/g, "");
    if (!safe) { setError("Name must be alphanumeric (also _ -)"); return; }
    const file = `vocabulary/${safe}.md`;
    if (terms.some((t) => t.name === file)) { setError(`${safe} already exists`); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/claude/files", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file, content: NEW_TERM_TEMPLATE(safe) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setCreating(false);
      setNewTermName("");
      await loadList();
      await loadTerm(file);
      setEditing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!active) return;
    if (!confirm(`Delete ${active}? This cannot be undone. Don't forget to also remove its entries from VOCABULARY.md and VOCABULARY-SUMMARIES.md (Files tab).`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/claude/files?file=${encodeURIComponent(active)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setActive(null);
      setContent("");
      setDraft("");
      loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  const activeItem = terms.find((i) => i.name === active);
  const displayName = (n: string) => n.replace(/^vocabulary\//, "").replace(/\.md$/, "");

  return (
    <>
      <PanelBackdrop onClick={onClose} />
      <Panel $fs={fullscreen} $accent="orange">
        <PanelHeader $accent="orange">
          <ClaudeIcon size={20} color={colors.orange} />
          <PanelTitle>Vocabulary</PanelTitle>
          <PanelTag>~/.claude/vocabulary/</PanelTag>
          <Spacer />
          <PanelActionBtn onClick={() => { setCreating(true); setActive(null); setError(null); }}>
            + New term
          </PanelActionBtn>
          <PanelIconBtn
            onClick={() => setFullscreen((p) => !p)}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? "⊑" : "⊞"}
          </PanelIconBtn>
          <PanelIconBtn onClick={onClose} title="Close (Esc)">
            ✕
          </PanelIconBtn>
        </PanelHeader>

        <SplitLayout>
          <PanelSidebar>
            {loadingList ? (
              <PanelEmptyState style={{ padding: "0.5rem" }}>Loading…</PanelEmptyState>
            ) : terms.length === 0 ? (
              <PanelEmptyState style={{ padding: "0.5rem" }}>No vocabulary terms yet.</PanelEmptyState>
            ) : (
              terms.map((t) => (
                <PanelSidebarItem
                  key={t.name}
                  $active={active === t.name}
                  onClick={() => loadTerm(t.name)}
                >
                  {displayName(t.name)}
                </PanelSidebarItem>
              ))
            )}
          </PanelSidebar>

          <MainPane>
            {creating ? (
              <CreateWrap>
                <CreateTitle>Create new vocabulary term</CreateTitle>
                <CreateHint>
                  Term name = filename. Use PascalCase or short codes (Lightswitch, QMBM, ECL). Letters, digits, underscore, hyphen only.
                </CreateHint>
                <CreateInput
                  type="text"
                  value={newTermName}
                  onChange={(e) => setNewTermName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") createTerm(); }}
                  placeholder="TermName"
                  autoFocus
                />
                {error && <PanelError>{error}</PanelError>}
                <BtnRow>
                  <PanelActionBtn
                    $variant="ghost"
                    onClick={() => { setCreating(false); setNewTermName(""); setError(null); }}
                  >
                    Cancel
                  </PanelActionBtn>
                  <PanelActionBtn onClick={createTerm} disabled={saving || !newTermName.trim()}>
                    {saving ? "Creating…" : "Create"}
                  </PanelActionBtn>
                </BtnRow>
              </CreateWrap>
            ) : !active ? (
              <PanelEmptyState>Select a term to view, or create a new one.</PanelEmptyState>
            ) : loadingTerm ? (
              <PanelEmptyState>Loading…</PanelEmptyState>
            ) : (
              <>
                <PanelToolbar>
                  <FileName>{displayName(active)}</FileName>
                  {activeItem && <FileSize>{(activeItem.bytes / 1024).toFixed(1)} KB</FileSize>}
                  {editing ? (
                    <>
                      <PanelActionBtn
                        $variant="ghost"
                        onClick={() => { setEditing(false); setDraft(content); }}
                        disabled={saving}
                      >
                        Cancel
                      </PanelActionBtn>
                      <PanelActionBtn
                        onClick={save}
                        disabled={saving || draft === content}
                      >
                        {saving ? "Saving…" : "Save"}
                      </PanelActionBtn>
                    </>
                  ) : (
                    <>
                      <PanelActionBtn onClick={() => setEditing(true)}>Edit</PanelActionBtn>
                      <PanelActionBtn $color="red" onClick={del} disabled={saving}>
                        Delete
                      </PanelActionBtn>
                    </>
                  )}
                </PanelToolbar>
                <Content>
                  {error && <PanelError style={{ marginBottom: "0.75rem" }}>{error}</PanelError>}
                  {editing ? (
                    <PanelEditor
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      spellCheck={false}
                    />
                  ) : (
                    <PanelMarkdown
                      className="md-content"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                    />
                  )}
                </Content>
              </>
            )}
          </MainPane>
        </SplitLayout>
      </Panel>
    </>
  );
}

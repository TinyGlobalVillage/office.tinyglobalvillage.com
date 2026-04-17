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
  PanelSidebarLabel,
  PanelSidebarItem,
  PanelTitle,
  PanelTag,
  PanelToolbar,
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

/* ── Local styled ──────────────────────────────────────────────── */

const SplitLayout = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: 260px 1fr;
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

const MissingTag = styled.span`
  font-size: 0.5625rem;
  color: var(--t-textFaint);
`;

const ViewToggle = styled.div`
  display: flex;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid var(--t-borderStrong);
`;

const ViewBtn = styled.button<{ $active?: boolean }>`
  padding: 0.125rem 0.5rem;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  background: ${(p) => (p.$active ? `rgba(${rgb.orange}, 0.2)` : "transparent")};
  color: ${(p) => (p.$active ? colors.orange : "var(--t-textMuted)")};

  &:disabled {
    opacity: 0.4;
  }
`;

const RawPre = styled.pre`
  font-size: 0.75rem;
  color: var(--t-text);
  opacity: 0.75;
  font-family: var(--font-geist-mono), monospace;
  white-space: pre-wrap;
  word-break: break-word;
`;

/* ── Component ─────────────────────────────────────────────────── */

export default function ClaudeFilesModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [view, setView] = useState<"rendered" | "raw">("rendered");

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch("/api/claude/files");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadFile = useCallback(async (name: string) => {
    setActive(name);
    setLoadingFile(true);
    setEditing(false);
    setError(null);
    try {
      const res = await fetch(`/api/claude/files?file=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setContent(data.content);
      setDraft(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setContent("");
      setDraft("");
    } finally {
      setLoadingFile(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (fullscreen) { setFullscreen(false); return; }
        if (editing) { setEditing(false); setDraft(content); return; }
        onClose();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose, fullscreen, editing, content]);

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

  async function del() {
    if (!active) return;
    if (!confirm(`Delete ${active}? This cannot be undone.`)) return;
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

  const activeItem = items.find((i) => i.name === active);

  return (
    <>
      <PanelBackdrop onClick={onClose} />
      <Panel $fs={fullscreen} $accent="orange">
        <PanelHeader $accent="orange">
          <ClaudeIcon size={20} color={colors.orange} />
          <PanelTitle>Global Claude Files</PanelTitle>
          <PanelTag>~/.claude/</PanelTag>
          <Spacer />
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
            ) : items.length === 0 ? (
              <PanelEmptyState style={{ padding: "0.5rem" }}>No files</PanelEmptyState>
            ) : (
              <>
                <PanelSidebarLabel>Indices</PanelSidebarLabel>
                {items.filter((i) => i.kind === "root").map((it) => (
                  <PanelSidebarItem
                    key={it.name}
                    $active={active === it.name}
                    onClick={() => loadFile(it.name)}
                  >
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {it.name}
                    </span>
                    {!it.exists && <MissingTag>missing</MissingTag>}
                  </PanelSidebarItem>
                ))}
                <PanelSidebarLabel style={{ paddingTop: "0.75rem" }}>Vocabulary</PanelSidebarLabel>
                {items.filter((i) => i.kind === "vocab").map((it) => (
                  <PanelSidebarItem
                    key={it.name}
                    $active={active === it.name}
                    onClick={() => loadFile(it.name)}
                  >
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {it.name.replace(/^vocabulary\//, "")}
                    </span>
                    {!it.exists && <MissingTag>missing</MissingTag>}
                  </PanelSidebarItem>
                ))}
              </>
            )}
          </PanelSidebar>

          <MainPane>
            {!active ? (
              <PanelEmptyState>Select a file to view or edit.</PanelEmptyState>
            ) : loadingFile ? (
              <PanelEmptyState>Loading…</PanelEmptyState>
            ) : (
              <>
                <PanelToolbar>
                  <FileName>{active}</FileName>
                  {activeItem && <FileSize>{(activeItem.bytes / 1024).toFixed(1)} KB</FileSize>}
                  <ViewToggle>
                    {(["rendered", "raw"] as const).map((v) => (
                      <ViewBtn
                        key={v}
                        $active={view === v}
                        onClick={() => setView(v)}
                        disabled={editing}
                      >
                        {v}
                      </ViewBtn>
                    ))}
                  </ViewToggle>
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
                      {activeItem?.deletable && (
                        <PanelActionBtn $color="red" onClick={del} disabled={saving}>
                          Delete
                        </PanelActionBtn>
                      )}
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
                  ) : view === "rendered" ? (
                    <PanelMarkdown
                      className="md-content"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                    />
                  ) : (
                    <RawPre>{content}</RawPre>
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

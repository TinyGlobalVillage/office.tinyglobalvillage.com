"use client";

import { useState, useEffect } from "react";
import styled from "styled-components";
import ClaudeIcon from "./ClaudeIcon";
import { renderMarkdown } from "@/lib/markdown";
import { colors } from "@/app/theme";
import {
  PanelBackdrop,
  Panel,
  PanelHeader,
  PanelIconBtn,
  PanelActionBtn,
  PanelError,
  PanelEditor,
  PanelMarkdown,
  PanelTitle,
  PanelTag,
  PanelEmptyState,
  Spacer,
} from "@/app/styled";

/* ── Local styled ──────────────────────────────────────────────── */

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
  scrollbar-width: thin;
`;

/* ── Component ─────────────────────────────────────────────────── */

export default function ClaudeGuideModal({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    fetch("/api/claude/guide")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
        setContent(d.content);
        setDraft(d.content);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, []);

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
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/claude/guide", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setContent(draft);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PanelBackdrop onClick={onClose} />
      <Panel $fs={fullscreen} $accent="orange">
        <PanelHeader $accent="orange">
          <ClaudeIcon size={20} color={colors.orange} />
          <PanelTitle>Learn Claude Guide</PanelTitle>
          <PanelTag>CLAUDE-GUIDE.md</PanelTag>
          <Spacer />
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
            <PanelActionBtn onClick={() => setEditing(true)} disabled={loading}>
              Edit
            </PanelActionBtn>
          )}
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

        <Body>
          {loading ? (
            <PanelEmptyState>Loading guide…</PanelEmptyState>
          ) : error ? (
            <PanelError>{error}</PanelError>
          ) : editing ? (
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
        </Body>
      </Panel>
    </>
  );
}

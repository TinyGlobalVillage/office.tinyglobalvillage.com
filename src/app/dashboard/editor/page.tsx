"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import TopNav from "../../components/TopNav";
import SandboxIcon from "../../components/sandbox/SandboxIcon";
import SandboxModal from "../../components/sandbox/SandboxModal";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const CLIENT_ROOT = "/srv/refusion-core/client";

/* ── Types ─────────────────────────────────────────────────────── */

type DirEntry = { name: string; path: string; isDir: boolean; size: number };
type TreeNode = DirEntry & { children?: TreeNode[]; expanded?: boolean };
type Project = { name: string; pm2Status?: string };

/* ── Helpers ────────────────────────────────────────────────────── */

function extToLang(ext: string): string {
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    json: "json", md: "markdown", css: "css", scss: "scss",
    html: "html", sh: "shell", bash: "shell", env: "shell",
    sql: "sql", yaml: "yaml", yml: "yaml", toml: "ini", txt: "plaintext",
    py: "python", rs: "rust", go: "go", rb: "ruby",
  };
  return map[ext] ?? "plaintext";
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / 1048576).toFixed(1)}MB`;
}

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const icons: Record<string, string> = {
    tsx: "⚛", ts: "𝑡𝑠", jsx: "⚛", js: "𝑗𝑠",
    json: "{}", css: "⌁", scss: "⌁", md: "✎",
    html: "<>", sh: "$", env: "⚙", sql: "⊞",
    png: "🖼", jpg: "🖼", jpeg: "🖼", svg: "⬡", gif: "🖼",
    mp4: "🎬", webm: "🎬", pdf: "📄",
    lock: "🔒", gitignore: "◌",
  };
  return icons[ext] ?? "·";
}

/* ── Styled Components ─────────────────────────────────────────── */

const EditorFrame = styled.div`
  position: fixed;
  display: flex;
  flex-direction: column;
  top: var(--nav-offset, 68px);
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(4, 6, 10, 1);

  [data-theme="light"] & {
    background: var(--t-bg);
  }
`;

const EditorRow = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

/* Sidebar */

const SidebarWrap = styled.div`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  width: 240px;
  border-right: 1px solid var(--t-border);
  background: rgba(6, 8, 12, 1);

  [data-theme="light"] & {
    background: var(--t-surface);
  }
`;

const SidebarHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.75rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--t-border);
`;

const SidebarLabel = styled.label`
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--t-textGhost);
  font-weight: 700;
`;

const ProjectSelect = styled.select`
  width: 100%;
  font-size: 0.75rem;
  padding: 0.375rem 0.625rem;
  border-radius: 0.5rem;
  outline: none;
  font-family: monospace;
  background: var(--t-inputBg);
  border: 1px solid rgba(${rgb.pink}, 0.25);
  color: ${colors.pink};

  option {
    background: #0a0c12;
  }

  [data-theme="light"] & option {
    background: var(--t-surface);
  }
`;

const BuildBtn = styled.button`
  width: 100%;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.375rem 0;
  border-radius: 0.5rem;
  transition: all 0.15s;
  cursor: pointer;
  background: rgba(${rgb.green}, 0.1);
  border: 1px solid rgba(${rgb.green}, 0.3);
  color: #00dc64;

  [data-theme="light"] & {
    background: rgba(${rgb.green}, 0.08);
  }
`;

const SandboxBtn = styled.button`
  width: 100%;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.375rem 0;
  border-radius: 0.5rem;
  transition: all 0.15s;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: rgba(${rgb.pink}, 0.1);
  border: 1px solid rgba(${rgb.pink}, 0.3);
  color: ${colors.pink};
`;

const TreeScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
  scrollbar-width: thin;
`;

/* Tree item */

const TreeItemBtn = styled.button<{ $depth: number; $selected: boolean; $isDir: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.125rem 0.5rem;
  padding-left: ${(p) => 8 + p.$depth * 14}px;
  text-align: left;
  transition: background 0.1s;
  border-radius: 0.25rem;
  font-size: 12px;
  cursor: pointer;
  border: none;
  background: ${(p) => (p.$selected ? `rgba(${rgb.cyan}, 0.15)` : "transparent")};
  color: ${(p) => (p.$selected ? colors.cyan : p.$isDir ? "var(--t-textMuted)" : "var(--t-textFaint)")};

  &:hover {
    background: ${(p) => (p.$selected ? `rgba(${rgb.cyan}, 0.15)` : "var(--t-inputBg)")};
  }
`;

const TreeIcon = styled.span<{ $isDir: boolean }>`
  flex-shrink: 0;
  font-family: monospace;
  font-size: 11px;
  color: ${(p) => (p.$isDir ? colors.gold : "var(--t-textGhost)")};
`;

const TreeName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TreeSize = styled.span`
  margin-left: auto;
  font-size: 9px;
  color: var(--t-textGhost);
  flex-shrink: 0;
`;

/* Editor area */

const EditorArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const TabBar = styled.div`
  display: flex;
  align-items: center;
  overflow-x: auto;
  flex-shrink: 0;
  min-height: 36px;
  border-bottom: 1px solid var(--t-border);
  background: rgba(4, 6, 10, 1);
  scrollbar-width: thin;

  [data-theme="light"] & {
    background: var(--t-bg);
  }
`;

const Tab = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.1s;
  font-size: 12px;
  background: ${(p) => (p.$active ? "var(--t-inputBg)" : "transparent")};
  border-right: 1px solid var(--t-border);
  border-bottom: ${(p) => (p.$active ? `1px solid ${colors.cyan}` : "1px solid transparent")};
  color: ${(p) => (p.$active ? "var(--t-text)" : "var(--t-textFaint)")};
`;

const TabIcon = styled.span`
  font-family: monospace;
`;

const TabName = styled.span`
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TabDirty = styled.span`
  color: ${colors.gold};
  font-size: 8px;
`;

const TabClose = styled.button`
  margin-left: 0.125rem;
  font-size: 10px;
  color: var(--t-textGhost);
  background: transparent;
  border: none;
  cursor: pointer;
  line-height: 1;
  transition: color 0.1s;

  &:hover {
    color: var(--t-textMuted);
  }
`;

/* Status bar */

const StatusBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1rem;
  flex-shrink: 0;
  height: 24px;
  font-size: 10px;
  border-bottom: 1px solid var(--t-border);
  background: rgba(${rgb.cyan}, 0.06);

  [data-theme="light"] & {
    background: rgba(${rgb.cyan}, 0.04);
  }
`;

const StatusPath = styled.span`
  color: var(--t-textGhost);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
`;

const StatusLang = styled.span`
  color: var(--t-textGhost);
`;

const PrettierBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  transition: all 0.15s;
  font-size: 9px;
  font-weight: 700;
  cursor: pointer;
  background: rgba(${rgb.gold}, 0.1);
  border: 1px solid rgba(${rgb.gold}, 0.25);
  color: rgba(${rgb.gold}, 0.7);

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    color: ${colors.gold};
  }
`;

const SaveStatus = styled.span<{ $status: "saved" | "saving" | "unsaved" }>`
  font-weight: 700;
  color: ${(p) =>
    p.$status === "saved" ? "#00dc64" : p.$status === "saving" ? colors.gold : colors.red};
`;

/* Editor empty & loading */

const EditorEmpty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1rem;
  color: var(--t-textGhost);
`;

const EditorEmptyIcon = styled.span`
  font-size: 3.125rem;
`;

const EditorEmptyLabel = styled.p`
  font-size: 0.875rem;
  font-weight: 700;
`;

const EditorEmptyHint = styled.p`
  font-size: 0.75rem;
`;

const EditorLoading = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--t-textGhost);
  font-size: 0.875rem;
`;

/* Build panel */

const BuildOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.8);

  [data-theme="light"] & {
    background: rgba(255, 255, 255, 0.6);
  }
`;

const BuildWrap = styled.div<{ $done: boolean; $success: boolean | null }>`
  width: 100%;
  max-width: 42rem;
  display: flex;
  flex-direction: column;
  border-radius: 1rem;
  overflow: hidden;
  max-height: 80vh;
  background: rgba(6, 8, 12, 0.99);
  border: 1px solid
    ${(p) =>
      p.$done
        ? p.$success
          ? `rgba(${rgb.green}, 0.4)`
          : `rgba(${rgb.red}, 0.4)`
        : `rgba(${rgb.gold}, 0.3)`};
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.8);

  [data-theme="light"] & {
    background: var(--t-surface);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.15);
  }
`;

const BuildHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--t-border);
`;

const BuildDot = styled.span<{ $color: string; $pulse?: boolean }>`
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background: ${(p) => p.$color};
  ${(p) =>
    p.$pulse &&
    `animation: pulse 2s ease-in-out infinite;
     @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}
`;

const BuildTitle = styled.span<{ $color: string }>`
  font-size: 0.875rem;
  font-weight: 700;
  color: ${(p) => p.$color};
`;

const BuildCloseBtn = styled.button`
  color: var(--t-textGhost);
  font-size: 0.75rem;
  font-weight: 700;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.15s;

  &:hover {
    color: var(--t-text);
  }
`;

const BuildLog = styled.div`
  flex: 1;
  overflow-y: auto;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.625;
  padding: 1rem 1.25rem;
  scrollbar-width: thin;
`;

const BuildLine = styled.div<{ $isErr?: boolean; $isOk?: boolean }>`
  margin-bottom: 1px;
  color: ${(p) =>
    p.$isErr ? colors.red : p.$isOk ? "#00dc64" : "rgba(200, 220, 200, 0.7)"};

  [data-theme="light"] & {
    color: ${(p) =>
      p.$isErr ? colors.red : p.$isOk ? "#00dc64" : "var(--t-textMuted)"};
  }
`;

/* ── Tree item component ───────────────────────────────────────── */

function TreeItem({
  node,
  depth,
  selectedPath,
  onSelect,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (node: TreeNode) => void;
  onToggle: (node: TreeNode) => void;
}) {
  const isSelected = !node.isDir && selectedPath === node.path;
  const icon = node.isDir ? (node.expanded ? "▾" : "▸") : getFileIcon(node.name);

  return (
    <>
      <TreeItemBtn
        $depth={depth}
        $selected={isSelected}
        $isDir={node.isDir}
        onClick={() => (node.isDir ? onToggle(node) : onSelect(node))}
      >
        <TreeIcon $isDir={node.isDir}>{icon}</TreeIcon>
        <TreeName>{node.name}</TreeName>
        {!node.isDir && node.size > 0 && <TreeSize>{fmtBytes(node.size)}</TreeSize>}
      </TreeItemBtn>
      {node.isDir &&
        node.expanded &&
        node.children?.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

/* ── Build panel component ─────────────────────────────────────── */

function BuildPanel({
  project,
  onClose,
}: {
  project: string;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<string[]>([`[build] Connecting to build stream for ${project}2026`]);
  const [done, setDone] = useState(false);
  const [success, setSuccess] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/editor/build", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project }),
          signal: ctrl.signal,
        });
        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done: d, value } = await reader.read();
          if (d) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
            const evtLine = part.split("\n").find((l) => l.startsWith("event: "));
            if (evtLine?.includes("done")) {
              const payload = JSON.parse(dataLine?.replace("data: ", "") ?? "{}");
              setDone(true);
              setSuccess(payload.ok);
            } else if (dataLine) {
              const text = JSON.parse(dataLine.replace("data: ", ""));
              setLines((prev) => [...prev, text]);
            }
          }
        }
      } catch (e: unknown) {
        if ((e as Error)?.name !== "AbortError") {
          setLines((prev) => [...prev, "[error] Stream disconnected"]);
          setDone(true);
          setSuccess(false);
        }
      }
    })();
    return () => ctrl.abort();
  }, [project]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const titleColor = done ? (success ? "#00dc64" : colors.red) : colors.gold;

  return (
    <BuildOverlay>
      <BuildWrap $done={done} $success={success}>
        <BuildHeader>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {!done && <BuildDot $color={colors.gold} $pulse />}
            {done && success && <BuildDot $color="#00dc64" />}
            {done && !success && <BuildDot $color={colors.red} />}
            <BuildTitle $color={titleColor}>
              {done
                ? success
                  ? "✓ Build & deploy complete"
                  : "✗ Build failed"
                : `Building ${project}2026`}
            </BuildTitle>
          </div>
          {done && <BuildCloseBtn onClick={onClose}>✕ Close</BuildCloseBtn>}
        </BuildHeader>
        <BuildLog>
          {lines.map((l, i) => {
            const isErr = l.includes("✗") || l.includes("[stderr]") || l.includes("error");
            const isOk = l.includes("✓");
            return <BuildLine key={i} $isErr={isErr} $isOk={isOk}>{l}</BuildLine>;
          })}
          <div ref={endRef} />
        </BuildLog>
      </BuildWrap>
    </BuildOverlay>
  );
}

/* ── Main editor page ──────────────────────────────────────────── */

export default function EditorPage() {
  return (
    <Suspense fallback={null}>
      <EditorPageInner />
    </Suspense>
  );
}

function EditorPageInner() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [tabContents, setTabContents] = useState<Record<string, string>>({});
  const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(new Set());
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [showBuild, setShowBuild] = useState(false);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [formatting, setFormatting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchParams = useSearchParams();
  const requestedProject = searchParams?.get("project") ?? null;

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d: Project[]) => {
        setProjects(d);
        if (d.length) {
          const match = requestedProject && d.find((p) => p.name === requestedProject);
          setActiveProject(match ? match.name : d[0].name);
        }
      })
      .catch(() => {});
  }, [requestedProject]);

  useEffect(() => {
    if (!activeProject) return;
    const dir = `${CLIENT_ROOT}/${activeProject}`;
    fetch(`/api/editor/tree?path=${encodeURIComponent(dir)}`)
      .then((r) => r.json())
      .then((d: { entries: DirEntry[] }) => {
        setTree(d.entries.map((e) => ({ ...e, expanded: false, children: undefined })));
      })
      .catch(() => {});
    setSelectedFile(null);
    setOpenTabs([]);
    setTabContents({});
    setDirtyTabs(new Set());
  }, [activeProject]);

  const toggleDir = useCallback(async (node: TreeNode) => {
    if (!node.isDir) return;

    const updateNode = (nodes: TreeNode[], targetPath: string): TreeNode[] =>
      nodes.map((n) => {
        if (n.path === targetPath) {
          if (n.expanded) return { ...n, expanded: false };
          return { ...n, expanded: true };
        }
        if (n.children) return { ...n, children: updateNode(n.children, targetPath) };
        return n;
      });

    const hasChildren = (nodes: TreeNode[], p: string): boolean => {
      for (const n of nodes) {
        if (n.path === p) return !!n.children;
        if (n.children) { if (hasChildren(n.children, p)) return true; }
      }
      return false;
    };

    if (!hasChildren(tree, node.path)) {
      const res = await fetch(`/api/editor/tree?path=${encodeURIComponent(node.path)}`);
      const d = await res.json();
      const children: TreeNode[] = (d.entries ?? []).map((e: DirEntry) => ({ ...e, expanded: false }));
      const attachChildren = (nodes: TreeNode[]): TreeNode[] =>
        nodes.map((n) => {
          if (n.path === node.path) return { ...n, expanded: true, children };
          if (n.children) return { ...n, children: attachChildren(n.children) };
          return n;
        });
      setTree((t) => attachChildren(t));
    } else {
      setTree((t) => updateNode(t, node.path));
    }
  }, [tree]);

  const openFile = useCallback(async (node: TreeNode) => {
    if (node.isDir) return;
    setSelectedFile(node.path);
    if (tabContents[node.path] !== undefined) return;

    setLoadingFile(true);
    try {
      const res = await fetch(`/api/editor/file?path=${encodeURIComponent(node.path)}`);
      const d = await res.json();
      if (d.content !== undefined) {
        setTabContents((prev) => ({ ...prev, [node.path]: d.content }));
        setOpenTabs((prev) => prev.includes(node.path) ? prev : [...prev, node.path]);
      }
    } finally {
      setLoadingFile(false);
    }
  }, [tabContents]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!selectedFile || value === undefined) return;
    setTabContents((prev) => ({ ...prev, [selectedFile]: value }));
    setDirtyTabs((prev) => new Set(prev).add(selectedFile));
    setSaveStatus("unsaved");

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await fetch("/api/editor/file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: selectedFile, content: value }),
        });
        setDirtyTabs((prev) => {
          const next = new Set(prev);
          next.delete(selectedFile);
          return next;
        });
        setSaveStatus("saved");
      } catch {
        setSaveStatus("unsaved");
      }
    }, 1200);
  }, [selectedFile]);

  const formatWithPrettier = useCallback(async () => {
    if (!selectedFile || !tabContents[selectedFile] || formatting) return;
    setFormatting(true);
    try {
      const ext = selectedFile.split(".").pop() ?? "";
      const parserMap: Record<string, string> = {
        ts: "typescript", tsx: "typescript", js: "babel", jsx: "babel",
        json: "json", css: "css", scss: "css", html: "html", md: "markdown",
      };
      const parser = parserMap[ext];
      if (!parser) { setFormatting(false); return; }

      const [{ default: prettier }, { default: prettierTs }, { default: prettierBabel }, { default: prettierEstree }, { default: prettierCss }, { default: prettierHtml }, { default: prettierMarkdown }] = await Promise.all([
        import("prettier/standalone"),
        import("prettier/plugins/typescript"),
        import("prettier/plugins/babel"),
        import("prettier/plugins/estree"),
        import("prettier/plugins/postcss"),
        import("prettier/plugins/html"),
        import("prettier/plugins/markdown"),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plugins: any[] = [prettierEstree];
      if (parser === "typescript") plugins.push(prettierTs, prettierBabel);
      else if (parser === "babel") plugins.push(prettierBabel);
      else if (parser === "css") plugins.push(prettierCss);
      else if (parser === "html") plugins.push(prettierHtml);
      else if (parser === "markdown") plugins.push(prettierMarkdown);

      const formatted = await prettier.format(tabContents[selectedFile], {
        parser,
        plugins,
        printWidth: 100,
        singleQuote: false,
        trailingComma: "es5",
        semi: true,
        tabWidth: 2,
      });

      if (editorRef.current) {
        const model = editorRef.current.getModel();
        if (model) {
          model.pushEditOperations([], [{
            range: model.getFullModelRange(),
            text: formatted,
          }], () => null);
          editorRef.current.focus();
        }
      } else {
        handleEditorChange(formatted);
      }
    } catch (err) {
      console.error("Prettier error:", err);
    } finally {
      setFormatting(false);
    }
  }, [selectedFile, tabContents, formatting, handleEditorChange]);

  const closeTab = useCallback((fp: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t !== fp);
      if (selectedFile === fp) setSelectedFile(next[next.length - 1] ?? null);
      return next;
    });
    setTabContents((prev) => { const n = { ...prev }; delete n[fp]; return n; });
    setDirtyTabs((prev) => { const n = new Set(prev); n.delete(fp); return n; });
  }, [selectedFile]);

  const currentContent = selectedFile ? tabContents[selectedFile] ?? "" : "";
  const currentExt = selectedFile ? selectedFile.split(".").pop() ?? "" : "";
  const currentLang = extToLang(currentExt);
  const fileName = selectedFile ? selectedFile.split("/").pop() : null;

  return (
    <>
      <TopNav />
      {showBuild && activeProject && (
        <BuildPanel project={activeProject} onClose={() => setShowBuild(false)} />
      )}
      {sandboxOpen && <SandboxModal onClose={() => setSandboxOpen(false)} />}

      <EditorFrame>
        <EditorRow>
          {/* Sidebar */}
          <SidebarWrap>
            <SidebarHeader>
              <SidebarLabel>Project</SidebarLabel>
              <ProjectSelect
                value={activeProject ?? ""}
                onChange={(e) => setActiveProject(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </ProjectSelect>
              {activeProject && (
                <BuildBtn onClick={() => setShowBuild(true)}>
                  ▶ Rebuild &amp; Deploy
                </BuildBtn>
              )}
              <SandboxBtn
                onClick={() => setSandboxOpen(true)}
                title="Component reference library"
              >
                <SandboxIcon size={14} color={colors.pink} />
                Sandbox
              </SandboxBtn>
            </SidebarHeader>

            <TreeScroll>
              {tree.map((node) => (
                <TreeItem
                  key={node.path}
                  node={node}
                  depth={0}
                  selectedPath={selectedFile}
                  onSelect={openFile}
                  onToggle={toggleDir}
                />
              ))}
            </TreeScroll>
          </SidebarWrap>

          {/* Editor area */}
          <EditorArea>
            {openTabs.length > 0 && (
              <TabBar>
                {openTabs.map((fp) => {
                  const name = fp.split("/").pop() ?? fp;
                  const isActive = fp === selectedFile;
                  const isDirty = dirtyTabs.has(fp);
                  return (
                    <Tab key={fp} $active={isActive} onClick={() => setSelectedFile(fp)}>
                      <TabIcon>{getFileIcon(name)}</TabIcon>
                      <TabName>{name}</TabName>
                      {isDirty && <TabDirty>●</TabDirty>}
                      <TabClose onClick={(e) => closeTab(fp, e)} title="Close tab">
                        ×
                      </TabClose>
                    </Tab>
                  );
                })}
              </TabBar>
            )}

            {selectedFile && (
              <StatusBar>
                <StatusPath>{selectedFile.replace(CLIENT_ROOT + "/", "")}</StatusPath>
                <StatusLang>{currentLang}</StatusLang>
                {["ts", "tsx", "js", "jsx", "json", "css", "scss", "html", "md"].includes(currentExt) && (
                  <PrettierBtn
                    onClick={formatWithPrettier}
                    disabled={formatting}
                    title="Format with Prettier (Shift+Alt+F)"
                  >
                    {formatting ? "↻" : "✦"} Prettier
                  </PrettierBtn>
                )}
                <SaveStatus $status={saveStatus}>
                  {saveStatus === "saved" ? "✓ Saved" : saveStatus === "saving" ? "↻ Saving2026" : "● Unsaved"}
                </SaveStatus>
              </StatusBar>
            )}

            <div style={{ flex: 1, overflow: "hidden" }}>
              {loadingFile ? (
                <EditorLoading>Loading2026</EditorLoading>
              ) : selectedFile ? (
                <MonacoEditor
                  key={selectedFile}
                  height="100%"
                  language={currentLang}
                  value={currentContent}
                  onChange={handleEditorChange}
                  onMount={(editor, monaco) => {
                    editorRef.current = editor;
                    editor.addCommand(
                      monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
                      () => formatWithPrettier()
                    );
                  }}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                    minimap: { enabled: true },
                    wordWrap: "on",
                    lineNumbers: "on",
                    renderLineHighlight: "line",
                    scrollBeyondLastLine: false,
                    tabSize: 2,
                    insertSpaces: true,
                    formatOnPaste: false,
                    smoothScrolling: true,
                    cursorSmoothCaretAnimation: "on",
                    bracketPairColorization: { enabled: true },
                    padding: { top: 12 },
                  }}
                />
              ) : (
                <EditorEmpty>
                  <EditorEmptyIcon>✎</EditorEmptyIcon>
                  <EditorEmptyLabel>Select a file to edit</EditorEmptyLabel>
                  <EditorEmptyHint>Changes auto-save after 1.2s of inactivity</EditorEmptyHint>
                </EditorEmpty>
              )}
            </div>
          </EditorArea>
        </EditorRow>
      </EditorFrame>
    </>
  );
}

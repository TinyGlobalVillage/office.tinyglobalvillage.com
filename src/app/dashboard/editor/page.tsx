"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import TopNav from "../../components/TopNav";
import SandboxIcon from "../../components/sandbox/SandboxIcon";
import SandboxModal from "../../components/sandbox/SandboxModal";

// Monaco must be loaded client-side only
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const CLIENT_ROOT = "/srv/refusion-core/client";

// ── Types ─────────────────────────────────────────────────────────────────────
type DirEntry = { name: string; path: string; isDir: boolean; size: number };
type TreeNode = DirEntry & { children?: TreeNode[]; expanded?: boolean };
type Project = { name: string; pm2Status?: string };

// ── Language detection ────────────────────────────────────────────────────────
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

// ── File tree node ────────────────────────────────────────────────────────────
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
  const icon = node.isDir
    ? (node.expanded ? "▾" : "▸")
    : getFileIcon(node.name);

  return (
    <>
      <button
        onClick={() => node.isDir ? onToggle(node) : onSelect(node)}
        className="w-full flex items-center gap-1.5 px-2 py-0.5 text-left transition-colors rounded"
        style={{
          paddingLeft: `${8 + depth * 14}px`,
          background: isSelected ? "rgba(0,191,255,0.15)" : "transparent",
          color: isSelected ? "#00bfff" : node.isDir ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.45)",
          fontSize: 12,
        }}
        onMouseEnter={(e) => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={(e) => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <span className="shrink-0 font-mono text-[11px]" style={{ color: node.isDir ? "#f7b700" : "rgba(255,255,255,0.25)" }}>
          {icon}
        </span>
        <span className="truncate">{node.name}</span>
        {!node.isDir && node.size > 0 && (
          <span className="ml-auto text-[9px] text-white/20 shrink-0">{fmtBytes(node.size)}</span>
        )}
      </button>
      {node.isDir && node.expanded && node.children?.map((child) => (
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

// ── Build panel ───────────────────────────────────────────────────────────────
function BuildPanel({
  project,
  onClose,
}: {
  project: string;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<string[]>([`[build] Connecting to build stream for ${project}…`]);
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

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.8)" }}
    >
      <div
        className="w-full max-w-2xl flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: "rgba(6,8,12,0.99)",
          border: `1px solid ${done ? (success ? "rgba(74,222,128,0.4)" : "rgba(255,107,107,0.4)") : "rgba(247,183,0,0.3)"}`,
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          maxHeight: "80vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2">
            {!done && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />}
            {done && success && <span className="w-2 h-2 rounded-full bg-green-400" />}
            {done && !success && <span className="w-2 h-2 rounded-full bg-red-400" />}
            <span className="text-sm font-bold" style={{ color: done ? (success ? "#4ade80" : "#ff6b6b") : "#f7b700" }}>
              {done ? (success ? "✓ Build & deploy complete" : "✗ Build failed") : `Building ${project}…`}
            </span>
          </div>
          {done && (
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors text-xs font-bold"
            >
              ✕ Close
            </button>
          )}
        </div>
        {/* Log output */}
        <div
          className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed px-5 py-4"
          style={{ scrollbarWidth: "thin" }}
        >
          {lines.map((l, i) => {
            const isErr = l.includes("✗") || l.includes("[stderr]") || l.includes("error");
            const isOk = l.includes("✓");
            return (
              <div
                key={i}
                style={{
                  color: isErr ? "#ff6b6b" : isOk ? "#4ade80" : "rgba(200,220,200,0.7)",
                  marginBottom: 1,
                }}
              >
                {l}
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}

// ── Main editor page ──────────────────────────────────────────────────────────
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

  // Load project list
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

  // Load top-level tree when project changes
  useEffect(() => {
    if (!activeProject) return;
    const dir = `${CLIENT_ROOT}/${activeProject}`;
    fetch(`/api/editor/tree?path=${encodeURIComponent(dir)}`)
      .then((r) => r.json())
      .then((d: { entries: DirEntry[] }) => {
        setTree(d.entries.map((e) => ({ ...e, expanded: false, children: undefined })));
      })
      .catch(() => {});
    // Reset open state when switching projects
    setSelectedFile(null);
    setOpenTabs([]);
    setTabContents({});
    setDirtyTabs(new Set());
  }, [activeProject]);

  // Expand/collapse directory
  const toggleDir = useCallback(async (node: TreeNode) => {
    if (!node.isDir) return;

    const updateNode = (nodes: TreeNode[], targetPath: string): TreeNode[] =>
      nodes.map((n) => {
        if (n.path === targetPath) {
          if (n.expanded) return { ...n, expanded: false };
          return { ...n, expanded: true }; // children loaded below
        }
        if (n.children) return { ...n, children: updateNode(n.children, targetPath) };
        return n;
      });

    // If no children loaded yet, fetch them
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

  // Open file in editor
  const openFile = useCallback(async (node: TreeNode) => {
    if (node.isDir) return;
    setSelectedFile(node.path);
    if (tabContents[node.path] !== undefined) return; // already loaded

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

  // Auto-save with debounce
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

  // Prettier format current file
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

      // Apply through Monaco so undo history is preserved
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

  // Close tab
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

      <div
        className="fixed flex flex-col editor-frame"
        style={{
          top: "var(--nav-offset, 68px)",
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(4,6,10,1)",
        }}
      >
        <div className="flex flex-1 overflow-hidden">
          {/* ── Sidebar ──────────────────────────────────── */}
          <div
            className="flex flex-col flex-shrink-0 overflow-hidden"
            style={{
              width: 240,
              borderRight: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(6,8,12,1)",
            }}
          >
            {/* Project selector */}
            <div
              className="flex flex-col gap-1.5 px-3 py-3 flex-shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <label className="text-[9px] uppercase tracking-[0.2em] text-white/25 font-bold">Project</label>
              <select
                value={activeProject ?? ""}
                onChange={(e) => setActiveProject(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg outline-none font-mono"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,78,203,0.25)",
                  color: "#ff4ecb",
                }}
              >
                {projects.map((p) => (
                  <option key={p.name} value={p.name} style={{ background: "#0a0c12" }}>
                    {p.name}
                  </option>
                ))}
              </select>
              {activeProject && (
                <button
                  onClick={() => setShowBuild(true)}
                  className="w-full text-xs font-bold py-1.5 rounded-lg transition-all"
                  style={{
                    background: "rgba(74,222,128,0.1)",
                    border: "1px solid rgba(74,222,128,0.3)",
                    color: "#4ade80",
                  }}
                >
                  ▶ Rebuild &amp; Deploy
                </button>
              )}
              <button
                onClick={() => setSandboxOpen(true)}
                className="w-full text-xs font-bold py-1.5 rounded-lg transition-all flex items-center justify-center gap-2"
                style={{
                  background: "rgba(255,78,203,0.1)",
                  border: "1px solid rgba(255,78,203,0.3)",
                  color: "#ff4ecb",
                }}
                title="Component reference library"
              >
                <SandboxIcon size={14} color="#ff4ecb" />
                Sandbox
              </button>
            </div>

            {/* File tree */}
            <div className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: "thin" }}>
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
            </div>
          </div>

          {/* ── Editor area ──────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tab bar */}
            {openTabs.length > 0 && (
              <div
                className="flex items-center overflow-x-auto flex-shrink-0"
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(4,6,10,1)",
                  scrollbarWidth: "thin",
                  minHeight: 36,
                }}
              >
                {openTabs.map((fp) => {
                  const name = fp.split("/").pop() ?? fp;
                  const isActive = fp === selectedFile;
                  const isDirty = dirtyTabs.has(fp);
                  return (
                    <div
                      key={fp}
                      onClick={() => setSelectedFile(fp)}
                      className="flex items-center gap-1.5 px-3 py-2 cursor-pointer shrink-0 transition-colors"
                      style={{
                        background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
                        borderRight: "1px solid rgba(255,255,255,0.05)",
                        borderBottom: isActive ? "1px solid #00bfff" : "1px solid transparent",
                        color: isActive ? "#e4e4e4" : "rgba(255,255,255,0.35)",
                        fontSize: 12,
                      }}
                    >
                      <span className="font-mono">{getFileIcon(name)}</span>
                      <span className="max-w-[120px] truncate">{name}</span>
                      {isDirty && <span style={{ color: "#f7b700", fontSize: 8 }}>●</span>}
                      <button
                        onClick={(e) => closeTab(fp, e)}
                        className="ml-0.5 text-[10px] text-white/25 hover:text-white/70 transition-colors leading-none"
                        title="Close tab"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Status bar */}
            {selectedFile && (
              <div
                className="flex items-center gap-3 px-4 flex-shrink-0"
                style={{
                  height: 24,
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  background: "rgba(0,191,255,0.06)",
                  fontSize: 10,
                }}
              >
                <span className="text-white/40 font-mono truncate flex-1">{selectedFile.replace(CLIENT_ROOT + "/", "")}</span>
                <span className="text-white/30">{currentLang}</span>
                {["ts","tsx","js","jsx","json","css","scss","html","md"].includes(currentExt) && (
                  <button
                    onClick={formatWithPrettier}
                    disabled={formatting}
                    title="Format with Prettier (Shift+Alt+F)"
                    className="flex items-center gap-1 px-2 py-0.5 rounded transition-all disabled:opacity-40"
                    style={{
                      background: "rgba(251,191,36,0.1)",
                      border: "1px solid rgba(251,191,36,0.25)",
                      color: formatting ? "#fbbf24" : "rgba(251,191,36,0.7)",
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    {formatting ? "↻" : "✦"} Prettier
                  </button>
                )}
                <span
                  style={{
                    color: saveStatus === "saved" ? "#4ade80" : saveStatus === "saving" ? "#f7b700" : "#ff6b6b",
                    fontWeight: 700,
                  }}
                >
                  {saveStatus === "saved" ? "✓ Saved" : saveStatus === "saving" ? "↻ Saving…" : "● Unsaved"}
                </span>
              </div>
            )}

            {/* Monaco editor */}
            <div className="flex-1 overflow-hidden">
              {loadingFile ? (
                <div className="flex items-center justify-center h-full text-white/20 text-sm">
                  Loading…
                </div>
              ) : selectedFile ? (
                <MonacoEditor
                  key={selectedFile}
                  height="100%"
                  language={currentLang}
                  value={currentContent}
                  onChange={handleEditorChange}
                  onMount={(editor, monaco) => {
                    editorRef.current = editor;
                    // Shift+Alt+F → Prettier (mirrors VS Code)
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
                <div className="flex flex-col items-center justify-center h-full gap-4 text-white/20">
                  <span className="text-5xl">✎</span>
                  <p className="text-sm font-bold">Select a file to edit</p>
                  <p className="text-xs">Changes auto-save after 1.2s of inactivity</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

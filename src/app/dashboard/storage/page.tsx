"use client";

import { useState, useEffect, useCallback, useRef, DragEvent, Suspense, KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import TopNav from "../../components/TopNav";

const CDN_BASE = "https://office.tinyglobalvillage.com/media";

type CdnFile = {
  name: string;
  url: string;
  size: number;
  type: string;
  project: string;
  modifiedAt: number;
};

type ProjectMeta = { name: string; count: number };

/* ── Helpers ───────────────────────────────────────────────────── */

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short", day: "numeric", year: "numeric",
  });
}

function isImage(type: string) { return type.startsWith("image/"); }
function isVideo(type: string) { return type.startsWith("video/"); }

function fileIcon(type: string) {
  if (isImage(type)) return "🖼";
  if (isVideo(type)) return "🎬";
  if (type.startsWith("audio/")) return "🎵";
  if (type === "application/pdf") return "📄";
  if (type.startsWith("font/")) return "🔤";
  return "📁";
}

/* ── Styled Components ─────────────────────────────────────────── */

const PageMain = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 7rem 1rem 4rem;
  max-width: 80rem;
  margin: 0 auto;
  width: 100%;
  gap: 1.5rem;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
`;

const PageTitle = styled.h1`
  font-size: 1.875rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
  color: ${colors.cyan};
  text-shadow: 0 0 8px ${colors.cyan}, 0 0 20px ${colors.cyan};

  [data-theme="light"] & {
    text-shadow: none;
  }
`;

const PageSubtitle = styled.p`
  font-size: 0.75rem;
  color: var(--t-textGhost);

  [data-theme="light"] & {
    color: var(--t-textFaint);
  }
`;

const CdnPath = styled.span`
  font-family: monospace;
  color: var(--t-textMuted);
`;

/* ── Upload zone ───────────────────────────────────────────────── */

const UploadWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const DropZone = styled.div<{ $dragging: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  border-radius: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 160px;
  border: 2px dashed ${(p) => (p.$dragging ? colors.pink : `rgba(${rgb.pink}, 0.25)`)};
  background: ${(p) => (p.$dragging ? `rgba(${rgb.pink}, 0.07)` : "var(--t-inputBg)")};

  [data-theme="light"] & {
    background: ${(p) => (p.$dragging ? `rgba(${rgb.pink}, 0.05)` : "var(--t-surface)")};
  }
`;

const DropIcon = styled.span`
  font-size: 1.875rem;
`;

const DropLabel = styled.p`
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--t-textMuted);
`;

const DropHint = styled.p`
  font-size: 0.75rem;
  color: var(--t-textGhost);
`;

const UploadingName = styled.p`
  font-size: 0.75rem;
  color: var(--t-textGhost);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 20rem;
`;

const UploadedBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  background: rgba(${rgb.green}, 0.08);
  border: 1px solid rgba(${rgb.green}, 0.25);

  [data-theme="light"] & {
    background: rgba(${rgb.green}, 0.05);
  }
`;

const UploadedLabel = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  color: #00dc64;
  flex-shrink: 0;
`;

const UploadedUrl = styled.span`
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--t-textMuted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
`;

const CopyBtn = styled.button<{ $copied: boolean }>`
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.75rem;
  border-radius: 0.5rem;
  transition: all 0.15s;
  cursor: pointer;
  background: ${(p) => (p.$copied ? `rgba(${rgb.green}, 0.25)` : "var(--t-inputBg)")};
  border: 1px solid rgba(${rgb.green}, 0.4);
  color: ${(p) => (p.$copied ? "#00dc64" : "var(--t-text)")};
`;

/* ── File card ─────────────────────────────────────────────────── */

const CardWrap = styled.div`
  display: flex;
  flex-direction: column;
  border-radius: 0.75rem;
  overflow: hidden;
  transition: all 0.15s;
  background: var(--t-inputBg);
  border: 1px solid var(--t-border);

  [data-theme="light"] & {
    background: var(--t-surface);
  }
`;

const CardPreview = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  background: rgba(0, 0, 0, 0.3);

  [data-theme="light"] & {
    background: var(--t-inputBg);
  }
`;

const CardImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const CardVideo = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const CardIconBig = styled.span`
  font-size: 2.5rem;
`;

const CardInfo = styled.div`
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const CardName = styled.p`
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--t-textMuted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CardMeta = styled.p`
  font-size: 10px;
  color: var(--t-textGhost);
`;

const CardActions = styled.div`
  padding: 0 0.75rem 0.75rem;
  display: flex;
  gap: 0.375rem;
`;

const CardCopyBtn = styled.button<{ $copied: boolean }>`
  flex: 1;
  font-size: 10px;
  font-weight: 700;
  padding: 0.25rem 0;
  border-radius: 0.5rem;
  transition: all 0.15s;
  cursor: pointer;
  background: ${(p) => (p.$copied ? `rgba(${rgb.green}, 0.15)` : `rgba(${rgb.cyan}, 0.1)`)};
  border: 1px solid ${(p) => (p.$copied ? `rgba(${rgb.green}, 0.4)` : `rgba(${rgb.cyan}, 0.3)`)};
  color: ${(p) => (p.$copied ? "#00dc64" : colors.cyan)};
`;

const CardOpenBtn = styled.a`
  font-size: 10px;
  font-weight: 700;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  text-decoration: none;
  background: var(--t-inputBg);
  border: 1px solid var(--t-borderStrong);
  color: var(--t-textGhost);
`;

const CardDeleteBtn = styled.button<{ $confirm?: boolean }>`
  font-size: 10px;
  font-weight: 700;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  transition: all 0.15s;
  cursor: pointer;
  background: ${(p) => (p.$confirm ? `rgba(${rgb.red}, 0.2)` : "var(--t-inputBg)")};
  border: 1px solid ${(p) => (p.$confirm ? `rgba(${rgb.red}, 0.5)` : "var(--t-border)")};
  color: ${(p) => (p.$confirm ? colors.red : "var(--t-textGhost)")};

  &:hover {
    color: ${colors.red};
  }
`;

/* ── Project dropdown ──────────────────────────────────────────── */

const DDMContainer = styled.div`
  position: relative;
  width: 280px;
`;

const DDMTrigger = styled.button<{ $open: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 1rem;
  border-radius: 0.75rem;
  transition: all 0.15s;
  text-align: left;
  cursor: pointer;
  background: ${(p) => (p.$open ? `rgba(${rgb.cyan}, 0.12)` : "var(--t-inputBg)")};
  border: 1px solid ${(p) => (p.$open ? `rgba(${rgb.cyan}, 0.45)` : "var(--t-borderStrong)")};
  color: ${colors.cyan};
  box-shadow: ${(p) => (p.$open ? `0 0 0 3px rgba(${rgb.cyan}, 0.08)` : "none")};

  [data-theme="light"] & {
    background: ${(p) => (p.$open ? `rgba(${rgb.cyan}, 0.08)` : "var(--t-surface)")};
  }
`;

const DDMTriggerLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
`;

const DDMBucketLabel = styled.span`
  font-size: 10px;
  color: var(--t-textGhost);
  flex-shrink: 0;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const DDMValue = styled.span`
  font-size: 0.875rem;
  font-weight: 700;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DDMFileCount = styled.span`
  font-size: 10px;
  color: var(--t-textGhost);
  flex-shrink: 0;
`;

const DDMArrow = styled.span<{ $open: boolean }>`
  flex-shrink: 0;
  font-size: 10px;
  transition: transform 0.2s;
  transform: ${(p) => (p.$open ? "rotate(180deg)" : "rotate(0deg)")};
  color: rgba(${rgb.cyan}, 0.6);
`;

const DDMPanel = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  z-index: 50;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 14px;
  max-height: 320px;
  background: rgba(8, 10, 16, 0.99);
  border: 1px solid rgba(${rgb.cyan}, 0.25);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(${rgb.cyan}, 0.06);

  [data-theme="light"] & {
    background: var(--t-surface);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
  }
`;

const DDMSearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--t-border);
`;

const DDMSearchIcon = styled.span`
  font-size: 0.75rem;
  color: var(--t-textGhost);
`;

const DDMSearchInput = styled.input`
  flex: 1;
  background: transparent;
  outline: none;
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--t-text);
  border: none;

  &::placeholder {
    color: var(--t-textGhost);
  }
`;

const DDMClearBtn = styled.button`
  font-size: 0.75rem;
  color: var(--t-textGhost);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.15s;

  &:hover {
    color: var(--t-textMuted);
  }
`;

const DDMList = styled.div`
  overflow-y: auto;
  scrollbar-width: thin;
`;

const DDMEmpty = styled.p`
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  color: var(--t-textGhost);
  text-align: center;
`;

const DDMItem = styled.button<{ $active: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 1rem;
  text-align: left;
  transition: background 0.15s;
  cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.cyan}, 0.1)` : "transparent")};
  border: none;
  border-left: 2px solid ${(p) => (p.$active ? colors.cyan : "transparent")};
  color: ${(p) => (p.$active ? colors.cyan : "var(--t-textMuted)")};

  &:hover {
    background: ${(p) => (p.$active ? `rgba(${rgb.cyan}, 0.1)` : "var(--t-inputBg)")};
  }
`;

const DDMItemName = styled.span`
  font-size: 0.875rem;
  font-family: monospace;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DDMItemRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
`;

const DDMItemCount = styled.span`
  font-size: 10px;
  color: var(--t-textGhost);
`;

const DDMItemCheck = styled.span`
  font-size: 10px;
`;

/* ── Filter + grid ─────────────────────────────────────────────── */

const FilterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const FilterInput = styled.input`
  padding: 0.375rem 0.75rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-family: monospace;
  outline: none;
  background: var(--t-inputBg);
  border: 1px solid var(--t-borderStrong);
  color: var(--t-text);

  [data-theme="light"] & {
    background: var(--t-surface);
  }
`;

const FilterCount = styled.span`
  font-size: 0.75rem;
  color: var(--t-textGhost);
`;

const FileGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;

  @media (min-width: 640px) { grid-template-columns: repeat(3, 1fr); }
  @media (min-width: 768px) { grid-template-columns: repeat(4, 1fr); }
  @media (min-width: 1024px) { grid-template-columns: repeat(6, 1fr); }
`;

const SkeletonCard = styled.div`
  height: 10rem;
  border-radius: 0.75rem;
  background: var(--t-inputBg);
  animation: pulse 2s ease-in-out infinite;

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem 0;
  border-radius: 1rem;
  background: var(--t-inputBg);
  border: 1px solid var(--t-border);

  [data-theme="light"] & {
    background: var(--t-surface);
  }
`;

const EmptyIcon = styled.span`
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
`;

const EmptyLabel = styled.p`
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--t-textGhost);
`;

const EmptyHint = styled.p`
  font-size: 0.75rem;
  color: var(--t-textGhost);
  margin-top: 0.25rem;
`;

const EmptyBucket = styled.span`
  font-family: monospace;
`;

const PaginationRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`;

const PaginationBtn = styled.button`
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  border: 1px solid var(--t-borderStrong);
  color: var(--t-textGhost);
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    border-color: rgba(${rgb.cyan}, 0.4);
    color: ${colors.cyan};
  }
`;

const PaginationLabel = styled.span`
  font-size: 0.75rem;
  color: var(--t-textGhost);
`;

/* ── Upload zone component ─────────────────────────────────────── */

function UploadZone({
  project,
  onUploaded,
}: {
  project: string;
  onUploaded: (f: CdnFile) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      setUploading(list.map((f) => f.name));

      for (const file of list) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("project", project);
        try {
          const res = await fetch("/api/cdn/upload", { method: "POST", body: fd });
          if (res.ok) {
            const data: CdnFile = await res.json();
            onUploaded(data);
            setLastUrl(data.url);
          }
        } catch { /* skip */ }
      }
      setUploading([]);
    },
    [project, onUploaded]
  );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  const copy = () => {
    if (!lastUrl) return;
    navigator.clipboard.writeText(lastUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <UploadWrap>
      <DropZone
        $dragging={dragging}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <DropIcon>{uploading.length ? "⏳" : "☁️"}</DropIcon>
        {uploading.length ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
            <DropLabel>Uploading…</DropLabel>
            {uploading.map((n) => <UploadingName key={n}>{n}</UploadingName>)}
          </div>
        ) : (
          <>
            <DropLabel>Drop files here or click to browse</DropLabel>
            <DropHint>Images, videos, PDFs, fonts — up to 100 MB each</DropHint>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }}
        />
      </DropZone>

      {lastUrl && (
        <UploadedBar>
          <UploadedLabel>✓ Uploaded</UploadedLabel>
          <UploadedUrl>{lastUrl}</UploadedUrl>
          <CopyBtn $copied={copied} onClick={copy}>
            {copied ? "Copied!" : "Copy Link"}
          </CopyBtn>
        </UploadedBar>
      )}
    </UploadWrap>
  );
}

/* ── File card component ───────────────────────────────────────── */

function FileCard({ file, onDelete }: { file: CdnFile; onDelete: () => void }) {
  const [copied, setCopied] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(file.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const del = async () => {
    setDeleting(true);
    await fetch(`/api/cdn/files?project=${file.project}&name=${encodeURIComponent(file.name)}`, {
      method: "DELETE",
    });
    onDelete();
  };

  return (
    <CardWrap>
      <CardPreview>
        {isImage(file.type) ? (
          <CardImg src={file.url} alt={file.name} loading="lazy" />
        ) : isVideo(file.type) ? (
          <CardVideo src={file.url} muted />
        ) : (
          <CardIconBig>{fileIcon(file.type)}</CardIconBig>
        )}
      </CardPreview>

      <CardInfo>
        <CardName title={file.name}>{file.name}</CardName>
        <CardMeta>{fmtBytes(file.size)} · {fmtDate(file.modifiedAt)}</CardMeta>
      </CardInfo>

      <CardActions>
        <CardCopyBtn $copied={copied} onClick={copy} title="Copy CDN link">
          {copied ? "Copied!" : "Copy Link"}
        </CardCopyBtn>
        <CardOpenBtn href={file.url} target="_blank" rel="noopener noreferrer" title="Open in new tab">
          ↗
        </CardOpenBtn>
        {confirmDel ? (
          <CardDeleteBtn $confirm onClick={del} disabled={deleting} title="Confirm delete">
            {deleting ? "…" : "Sure?"}
          </CardDeleteBtn>
        ) : (
          <CardDeleteBtn onClick={() => setConfirmDel(true)} title="Delete file">
            ✕
          </CardDeleteBtn>
        )}
      </CardActions>
    </CardWrap>
  );
}

/* ── Project dropdown component ────────────────────────────────── */

function ProjectDropdown({
  projects,
  cdnCounts,
  value,
  onChange,
}: {
  projects: string[];
  cdnCounts: ProjectMeta[];
  value: string;
  onChange: (p: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const filtered = projects.filter((p) =>
    p.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
      setTimeout(() => activeRef.current?.scrollIntoView({ block: "nearest" }), 60);
    }
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { setOpen(false); setSearch(""); }
    if (e.key === "Enter" && filtered.length === 1) {
      onChange(filtered[0]);
      setOpen(false);
      setSearch("");
    }
  };

  const select = (p: string) => {
    onChange(p);
    setOpen(false);
    setSearch("");
  };

  const count = (p: string) => cdnCounts.find((m) => m.name === p)?.count;

  return (
    <DDMContainer ref={containerRef}>
      <DDMTrigger $open={open} onClick={() => setOpen((x) => !x)}>
        <DDMTriggerLeft>
          <DDMBucketLabel>Bucket</DDMBucketLabel>
          <DDMValue>{value}</DDMValue>
          {count(value) !== undefined && (
            <DDMFileCount>{count(value)} files</DDMFileCount>
          )}
        </DDMTriggerLeft>
        <DDMArrow $open={open}>▼</DDMArrow>
      </DDMTrigger>

      {open && (
        <DDMPanel>
          <DDMSearchRow>
            <DDMSearchIcon>⌕</DDMSearchIcon>
            <DDMSearchInput
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search projects…"
            />
            {search && (
              <DDMClearBtn onClick={() => setSearch("")}>×</DDMClearBtn>
            )}
          </DDMSearchRow>

          <DDMList>
            {filtered.length === 0 ? (
              <DDMEmpty>No projects match</DDMEmpty>
            ) : (
              filtered.map((p) => {
                const isActive = p === value;
                const n = count(p);
                return (
                  <DDMItem
                    key={p}
                    ref={isActive ? activeRef : undefined}
                    $active={isActive}
                    onClick={() => select(p)}
                  >
                    <DDMItemName>{p}</DDMItemName>
                    <DDMItemRight>
                      {n !== undefined && <DDMItemCount>{n} files</DDMItemCount>}
                      {isActive && <DDMItemCheck>✓</DDMItemCheck>}
                    </DDMItemRight>
                  </DDMItem>
                );
              })
            )}
          </DDMList>
        </DDMPanel>
      )}
    </DDMContainer>
  );
}

/* ── Main page ─────────────────────────────────────────────────── */

export default function StoragePage() {
  return (
    <Suspense fallback={null}>
      <StoragePageInner />
    </Suspense>
  );
}

function StoragePageInner() {
  const searchParams = useSearchParams();
  const [cdnProjects, setCdnProjects] = useState<ProjectMeta[]>([]);
  const [deployedProjectNames, setDeployedProjectNames] = useState<string[]>([]);
  const [activeProject, setActiveProject] = useState(searchParams.get("project") ?? "office");
  const [files, setFiles] = useState<CdnFile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/cdn/files")
      .then((r) => r.json())
      .then((d: { projects: ProjectMeta[] }) => setCdnProjects(d.projects ?? []))
      .catch(() => {});
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d: { name: string }[]) => setDeployedProjectNames(d.map((p) => p.name)))
      .catch(() => {});
  }, []);

  const loadFiles = useCallback(async (proj: string, p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cdn/files?project=${proj}&page=${p}`);
      if (res.ok) {
        const d = await res.json();
        setFiles(d.files ?? []);
        setTotal(d.total ?? 0);
        setPage(d.page ?? 1);
        setTotalPages(d.totalPages ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles(activeProject, 1);
  }, [activeProject, loadFiles]);

  const handleUploaded = (f: CdnFile) => {
    setFiles((prev) => [f, ...prev]);
    setTotal((t) => t + 1);
    setCdnProjects((prev) => {
      const idx = prev.findIndex((p) => p.name === f.project);
      if (idx === -1) return [...prev, { name: f.project, count: 1 }];
      const next = [...prev];
      next[idx] = { ...next[idx], count: next[idx].count + 1 };
      return next;
    });
  };

  const handleDelete = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setTotal((t) => Math.max(0, t - 1));
  };

  const filteredFiles = filter
    ? files.filter((f) => f.name.toLowerCase().includes(filter.toLowerCase()))
    : files;

  const allProjects = Array.from(
    new Set(["office", ...deployedProjectNames, ...cdnProjects.map((p) => p.name)])
  );

  const projects = cdnProjects;

  return (
    <>
      <TopNav />
      <PageMain>
        <HeaderRow>
          <div>
            <PageTitle>Storage</PageTitle>
            <PageSubtitle>
              Files are served at{" "}
              <CdnPath>{CDN_BASE}/&#123;project&#125;/&#123;file&#125;</CdnPath>
              {" "}— publicly accessible, immutable cache
            </PageSubtitle>
          </div>
        </HeaderRow>

        <ProjectDropdown
          projects={allProjects}
          cdnCounts={projects}
          value={activeProject}
          onChange={(p) => { setActiveProject(p); setPage(1); }}
        />

        <UploadZone project={activeProject} onUploaded={handleUploaded} />

        {total > 0 && (
          <FilterRow>
            <FilterInput
              type="text"
              placeholder="Filter files…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <FilterCount>
              {filteredFiles.length} of {total} file{total !== 1 ? "s" : ""}
            </FilterCount>
          </FilterRow>
        )}

        {loading ? (
          <FileGrid>
            {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
          </FileGrid>
        ) : filteredFiles.length === 0 ? (
          <EmptyState>
            <EmptyIcon>☁️</EmptyIcon>
            <EmptyLabel>No files yet</EmptyLabel>
            <EmptyHint>
              Drop files above to upload to the <EmptyBucket>{activeProject}</EmptyBucket> bucket
            </EmptyHint>
          </EmptyState>
        ) : (
          <FileGrid>
            {filteredFiles.map((f) => (
              <FileCard key={f.name} file={f} onDelete={() => handleDelete(f.name)} />
            ))}
          </FileGrid>
        )}

        {totalPages > 1 && (
          <PaginationRow>
            <PaginationBtn
              onClick={() => loadFiles(activeProject, page - 1)}
              disabled={page <= 1}
            >
              ← Prev
            </PaginationBtn>
            <PaginationLabel>{page} / {totalPages}</PaginationLabel>
            <PaginationBtn
              onClick={() => loadFiles(activeProject, page + 1)}
              disabled={page >= totalPages}
            >
              Next →
            </PaginationBtn>
          </PaginationRow>
        )}
      </PageMain>
    </>
  );
}

"use client";
// Media Reducer — Utils → Media & Transcription.
// Batch (or single) downsizing/re-encoding of images and videos for the web:
// drag-and-drop many files, one shared settings panel (format DDM + QMBM file-type
// explainers + quality/dimension controls), an Image|Video PillBar mirroring the
// chat Media Converter's two engines, and a destination picker — download to disk
// or upload into a tenant's CDN storage (counts toward their storage tier).
// When the batch finishes, staff are prompted to SAVE or DISCARD the whole batch.
//
// Engines are shared with MediaConverterModal (sibling tool, chat-scoped):
// images re-encode client-side via <canvas>.toBlob (GIF output falls back to the
// ffmpeg route), videos ride the existing /api/chat/convert/video job pipeline —
// sequentially, one ffmpeg at a time, because RCS is a shared box.

import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import PillBar from "@tgv/module-component-library/components/ui/PillBar";
import DdmSelect from "@tgv/module-component-library/components/ui/DdmSelect";
import { useCallback, useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { colors, rgb } from "../../theme";
import { CloudIcon } from "../icons";
import NeonX from "../NeonX";
import { useModalLifecycle } from "../../lib/drawerKnobs";
import {
  IMAGE_FORMATS, VIDEO_FORMATS, IMAGE_FORMAT_ORDER, VIDEO_FORMAT_ORDER,
  fmtBytes, type MediaKind, type ImgFormat, type VidFormat, type FormatInfo,
} from "./formats";

const ACCENT = colors.cyan;
const ACCENT_RGB = rgb.cyan;

// ── Types ─────────────────────────────────────────────────────────────────────

type ItemStatus = "queued" | "working" | "done" | "error";

type BatchItem = {
  id: string;
  file: File;
  thumbUrl: string | null;
  status: ItemStatus;
  percent: number;
  out: File | null;
  error: string | null;
  savedUrl: string | null;
  /** Live pre-convert projection of the output size (images; null = unknown). */
  estSize: number | null;
};

type Phase = "edit" | "running" | "review" | "saving" | "saved";
type Destination = "download" | "cdn";

type Tenant = { id: string; domain: string; label: string };

// Minimal File System Access API shapes (not in lib.dom yet) — the pick-a-
// folder-once batch save. Chromium-only; callers must feature-detect.
type WritableLike = { write(data: Blob): Promise<void>; close(): Promise<void> };
type DirHandleLike = {
  getFileHandle(name: string, opts: { create: boolean }): Promise<{ createWritable(): Promise<WritableLike> }>;
};

// ── Animations / chrome ───────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Modal = styled.div`
  background: #0d0f1a;
  border: 1px solid rgba(${ACCENT_RGB}, 0.22);
  border-radius: 1rem;
  box-shadow: 0 0 40px rgba(${ACCENT_RGB}, 0.12), 0 20px 60px rgba(0,0,0,0.7);
  width: 100%;
  max-width: 780px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  animation: ${fadeIn} 0.18s ease;
  overflow: hidden;
  position: relative;

  [data-theme="light"] & {
    background: #f4f4f8;
    border-color: rgba(${ACCENT_RGB}, 0.18);
  }

  @media (max-width: 768px) {
    width: 100vw;
    max-width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid rgba(${ACCENT_RGB}, 0.12);
  gap: 0.75rem;
  flex-shrink: 0;
`;

const ModalTitle = styled.h2`
  font-size: 0.875rem;
  font-weight: 700;
  color: ${ACCENT};
  text-shadow: 0 0 8px rgba(${ACCENT_RGB}, 0.8), 0 0 20px rgba(${ACCENT_RGB}, 0.4);
  margin: 0;
  flex: 1;
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  scrollbar-width: thin;
`;

const PillBarRow = styled.div`
  display: flex;
  justify-content: center;
  padding: 0.625rem 1rem 0;
  flex-shrink: 0;
`;

// ── Drop zone ─────────────────────────────────────────────────────────────────

const DropZone = styled.label<{ $active?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 0.75rem;
  border: 1.5px dashed ${(p) => p.$active ? `rgba(${ACCENT_RGB}, 0.65)` : `rgba(${ACCENT_RGB}, 0.25)`};
  background: ${(p) => p.$active ? `rgba(${ACCENT_RGB}, 0.08)` : "rgba(255,255,255,0.02)"};
  padding: 1.375rem 1rem;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;

  &:hover {
    border-color: rgba(${ACCENT_RGB}, 0.5);
    background: rgba(${ACCENT_RGB}, 0.06);
  }
`;

const DropText = styled.p`
  font-size: 0.75rem;
  color: var(--t-textMuted);
  margin: 0;
`;

const DropSub = styled.p`
  font-size: 0.625rem;
  color: var(--t-textGhost);
  margin: 0;
`;

// ── Controls ──────────────────────────────────────────────────────────────────

const ControlsCard = styled.div`
  border: 1px solid rgba(${ACCENT_RGB}, 0.14);
  border-radius: 0.75rem;
  background: rgba(${ACCENT_RGB}, 0.03);
  padding: 0.75rem 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
`;

const ControlRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-wrap: wrap;
`;

const Label = styled.label`
  font-size: 0.6875rem;
  color: var(--t-textMuted);
  white-space: nowrap;
`;

const DdmWrap = styled.div`
  flex: 1;
  min-width: 150px;
`;

const Select = styled.select`
  background: var(--t-inputBg, rgba(255,255,255,0.05));
  border: 1px solid rgba(${ACCENT_RGB}, 0.25);
  border-radius: 0.5rem;
  padding: 0.375rem 0.625rem;
  color: var(--t-text);
  font-size: 0.75rem;
  cursor: pointer;
  &:focus { outline: none; border-color: rgba(${ACCENT_RGB}, 0.5); }
`;

const TextInput = styled.input`
  flex: 1;
  min-width: 140px;
  background: var(--t-inputBg, rgba(255,255,255,0.05));
  border: 1px solid rgba(${ACCENT_RGB}, 0.25);
  border-radius: 0.5rem;
  padding: 0.375rem 0.625rem;
  color: var(--t-text);
  font-size: 0.75rem;
  &:focus { outline: none; border-color: rgba(${ACCENT_RGB}, 0.5); }
`;

const NumberInput = styled.input`
  width: 76px;
  background: var(--t-inputBg, rgba(255,255,255,0.05));
  border: 1px solid rgba(${ACCENT_RGB}, 0.25);
  border-radius: 0.5rem;
  padding: 0.375rem 0.625rem;
  color: var(--t-text);
  font-size: 0.75rem;
  &:focus { outline: none; border-color: rgba(${ACCENT_RGB}, 0.5); }
`;

const Slider = styled.input`
  flex: 1;
  min-width: 110px;
  accent-color: ${ACCENT};
`;

const SliderVal = styled.span`
  font-size: 0.6875rem;
  color: ${ACCENT};
  width: 2rem;
  text-align: right;
`;

// ── QMBM ──────────────────────────────────────────────────────────────────────

const QmbmBtn = styled.button`
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid rgba(${ACCENT_RGB}, 0.55);
  background: rgba(${ACCENT_RGB}, 0.12);
  color: ${ACCENT};
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  &:hover { background: rgba(${ACCENT_RGB}, 0.22); box-shadow: 0 0 10px rgba(${ACCENT_RGB}, 0.5); }
`;

const QmbmPanel = styled.div`
  position: absolute;
  inset: 0;
  background: #0d0f1a;
  z-index: 3;
  padding: 0.875rem 1rem 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  animation: ${fadeIn} 0.15s ease;
  [data-theme="light"] & { background: #f4f4f8; }
`;

const QmbmHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(${ACCENT_RGB}, 0.15);
`;

const QmbmTitle = styled.h3`
  font-size: 0.8125rem;
  font-weight: 700;
  color: ${ACCENT};
  text-shadow: 0 0 6px rgba(${ACCENT_RGB}, 0.6);
  margin: 0;
  flex: 1;
`;

const QmbmCard = styled.div`
  border: 1px solid rgba(${ACCENT_RGB}, 0.15);
  border-radius: 0.625rem;
  padding: 0.625rem 0.75rem;
  background: rgba(${ACCENT_RGB}, 0.03);
`;

const QmbmCardTitle = styled.h4`
  font-size: 0.75rem;
  font-weight: 700;
  color: ${ACCENT};
  margin: 0 0 0.25rem;
`;

const QmbmCardDesc = styled.p`
  font-size: 0.6875rem;
  color: var(--t-textMuted);
  margin: 0;
  line-height: 1.45;
`;

const QmbmCardUse = styled.p`
  font-size: 0.65rem;
  color: var(--t-textGhost);
  margin: 0.3rem 0 0;
  line-height: 1.4;
  b { color: rgba(${ACCENT_RGB}, 0.85); font-weight: 600; }
`;

function FormatQmbm({ kind, onClose }: { kind: MediaKind; onClose: () => void }) {
  const list: FormatInfo[] = kind === "image"
    ? IMAGE_FORMAT_ORDER.map((k) => IMAGE_FORMATS[k])
    : VIDEO_FORMAT_ORDER.map((k) => VIDEO_FORMATS[k]);
  return (
    <QmbmPanel>
      <QmbmHead>
        <QmbmTitle>{kind === "image" ? "Image" : "Video"} file types — which to pick</QmbmTitle>
        <NeonX accent="cyan" size="sm" onClick={onClose} title="Close help" />
      </QmbmHead>
      {list.map((f) => (
        <QmbmCard key={f.key}>
          <QmbmCardTitle>{f.label}</QmbmCardTitle>
          <QmbmCardDesc>{f.desc}</QmbmCardDesc>
          <QmbmCardUse><b>Use for:</b> {f.useCase}</QmbmCardUse>
        </QmbmCard>
      ))}
    </QmbmPanel>
  );
}

// ── Batch list ────────────────────────────────────────────────────────────────

const ListCard = styled.div`
  border: 1px solid rgba(${ACCENT_RGB}, 0.14);
  border-radius: 0.75rem;
  overflow-y: auto;
  /* ~6 rows, then the LIST scrolls — the controls + destination stay in view
     instead of a long batch pushing them off-screen. */
  max-height: 19rem;
  scrollbar-width: thin;
  flex-shrink: 0;
`;

const Row = styled.div<{ $status: ItemStatus }>`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.625rem;
  border-bottom: 1px solid rgba(${ACCENT_RGB}, 0.08);
  background: ${(p) =>
    p.$status === "error" ? `rgba(${rgb.red}, 0.05)` :
    p.$status === "done" ? `rgba(${ACCENT_RGB}, 0.04)` : "transparent"};
  &:last-child { border-bottom: none; }
`;

const Thumb = styled.div`
  width: 44px;
  height: 33px;
  border-radius: 0.375rem;
  background: rgba(0,0,0,0.4);
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  img { width: 100%; height: 100%; object-fit: cover; }
`;

const RowName = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 0.6875rem;
  color: var(--t-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RowSizes = styled.span`
  font-size: 0.625rem;
  color: var(--t-textMuted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  b { color: ${ACCENT}; font-weight: 700; }
  i { color: ${colors.green}; font-style: normal; font-weight: 600; }
`;

const RowStatus = styled.span<{ $status: ItemStatus }>`
  font-size: 0.625rem;
  font-weight: 700;
  white-space: nowrap;
  color: ${(p) =>
    p.$status === "done" ? colors.green :
    p.$status === "error" ? colors.red :
    p.$status === "working" ? ACCENT : "var(--t-textGhost)"};
`;

const RowErr = styled.span`
  font-size: 0.5625rem;
  color: ${colors.red};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 10rem;
`;

const MiniBar = styled.div<{ $pct: number }>`
  width: 64px;
  height: 6px;
  border-radius: 3px;
  background: rgba(${ACCENT_RGB}, 0.15);
  overflow: hidden;
  &::after {
    content: "";
    display: block;
    height: 100%;
    width: ${(p) => p.$pct}%;
    background: ${ACCENT};
    transition: width 0.3s ease;
  }
`;

// ── Destination ───────────────────────────────────────────────────────────────

const DestCard = styled(ControlsCard)``;

const DestHint = styled.p`
  font-size: 0.625rem;
  color: var(--t-textGhost);
  margin: 0;
  line-height: 1.45;
`;

// ── Footer / actions ──────────────────────────────────────────────────────────

const Footer = styled.div`
  border-top: 1px solid rgba(${ACCENT_RGB}, 0.12);
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex-shrink: 0;
`;

const Totals = styled.div`
  font-size: 0.6875rem;
  color: var(--t-textMuted);
  text-align: center;
  b { color: ${ACCENT}; }
  i { color: ${colors.green}; font-style: normal; font-weight: 700; }
`;

const BtnRow = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionBtn = styled.button<{ $tone?: "accent" | "danger" | "ghost" }>`
  flex: 1;
  padding: 0.625rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  background: ${(p) =>
    p.$tone === "danger" ? `rgba(${rgb.red}, 0.1)` :
    p.$tone === "ghost" ? "rgba(255,255,255,0.04)" : `rgba(${ACCENT_RGB}, 0.14)`};
  border: 1px solid ${(p) =>
    p.$tone === "danger" ? `rgba(${rgb.red}, 0.35)` :
    p.$tone === "ghost" ? "rgba(255,255,255,0.12)" : `rgba(${ACCENT_RGB}, 0.4)`};
  color: ${(p) =>
    p.$tone === "danger" ? colors.red :
    p.$tone === "ghost" ? "var(--t-textMuted)" : ACCENT};

  &:hover:not(:disabled) {
    box-shadow: 0 0 14px ${(p) =>
    p.$tone === "danger" ? `rgba(${rgb.red}, 0.35)` : `rgba(${ACCENT_RGB}, 0.35)`};
  }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const ErrorBox = styled.div`
  font-size: 0.6875rem;
  color: ${colors.red};
  background: rgba(${rgb.red}, 0.08);
  border: 1px solid rgba(${rgb.red}, 0.2);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
`;

const SavedBox = styled.div`
  font-size: 0.6875rem;
  color: ${colors.green};
  background: rgba(${rgb.green}, 0.07);
  border: 1px solid rgba(${rgb.green}, 0.25);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  line-height: 1.5;
  word-break: break-all;
`;

// ── Conversion engines (shared with MediaConverterModal's endpoints) ──────────

function encodeImageClient(
  file: File, format: ImgFormat, quality: number, maxW: number | null, maxH: number | null,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const mw = maxW ?? img.width;
      const mh = maxH ?? img.height;
      const scale = Math.min(1, mw / img.width, mh / img.height);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(src); reject(new Error("Canvas unavailable")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const info = IMAGE_FORMATS[format];
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(src);
          if (!blob || blob.type !== info.mime) {
            // Browser refused this encoder (AVIF on older engines silently
            // falls back to PNG) — surface it instead of mislabeling the file.
            reject(new Error(`${info.label} encoding not supported by this browser`));
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, "");
          resolve(new File([blob], `${baseName}${info.ext}`, { type: info.mime }));
        },
        info.mime,
        quality / 100,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error("Not a readable image")); };
    img.src = src;
  });
}

async function encodeImageGifServer(
  file: File, quality: number, maxW: number | null, maxH: number | null,
): Promise<File> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("format", "gif");
  fd.append("quality", String(quality));
  if (maxW) fd.append("maxWidth", String(maxW));
  if (maxH) fd.append("maxHeight", String(maxH));
  const res = await fetch("/api/chat/convert/image", { method: "POST", body: fd });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.gif`, { type: "image/gif" });
}

type VideoSettings = { format: VidFormat; crf: number; preset: string; maxWidth: number | null; fps: number | null };

async function convertVideoServer(
  file: File, s: VideoSettings, onPercent: (p: number) => void,
): Promise<File> {
  // Cloudflare caps request bodies (~100 MB) — chunk big files like the chat converter.
  const CHUNK_THRESHOLD = 90 * 1024 * 1024;
  const CHUNK_SIZE = 80 * 1024 * 1024;
  const fd = new FormData();
  fd.append("format", s.format);
  fd.append("crf", String(s.crf));
  fd.append("preset", s.preset);
  if (s.maxWidth) fd.append("maxWidth", String(s.maxWidth));
  if (s.fps) fd.append("fps", String(s.fps));

  if (file.size > CHUNK_THRESHOLD) {
    const uploadId = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const cfd = new FormData();
      cfd.append("uploadId", uploadId);
      cfd.append("chunkIndex", String(i));
      cfd.append("totalChunks", String(totalChunks));
      cfd.append("chunk", file.slice(start, end), `chunk-${i}`);
      if (i === 0) cfd.append("fileName", file.name);
      const cres = await fetch("/api/chat/convert/video/upload-chunk", { method: "POST", body: cfd });
      if (!cres.ok) {
        const j = await cres.json().catch(() => ({}));
        throw new Error(j.error ?? `Chunk ${i + 1}/${totalChunks} HTTP ${cres.status}`);
      }
      onPercent(Math.round(((i + 1) / totalChunks) * 10)); // upload = first 10%
    }
    fd.append("uploadId", uploadId);
    fd.append("fileName", file.name);
  } else {
    fd.append("file", file);
  }

  const res = await fetch("/api/chat/convert/video/start", { method: "POST", body: fd });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  const { jobId } = await res.json() as { jobId: string };

  await new Promise<void>((resolve, reject) => {
    const es = new EventSource(`/api/chat/convert/video/progress?jobId=${jobId}`);
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.error) { es.close(); reject(new Error(d.error)); return; }
        onPercent(10 + Math.round((d.percent ?? 0) * 0.9));
        if (d.done) { es.close(); resolve(); }
      } catch { /* ignore malformed frames */ }
    };
    es.onerror = () => { es.close(); reject(new Error("Progress stream dropped")); };
  });

  const rres = await fetch(`/api/chat/convert/video/result?jobId=${jobId}`);
  if (!rres.ok) {
    const j = await rres.json().catch(() => ({}));
    throw new Error(j.error ?? `HTTP ${rres.status}`);
  }
  const blob = await rres.blob();
  const info = VIDEO_FORMATS[s.format];
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}${info.ext}`, { type: blob.type || info.mime });
}

// ── Component ─────────────────────────────────────────────────────────────────

let nextId = 0;

export default function MediaReducerModal({ onClose }: { onClose: () => void }) {
  useModalLifecycle();
  const [kind, setKind] = useState<MediaKind>("image");
  const [helpOpen, setHelpOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Two independent batches — switching the PillBar switches the working set.
  const [imgItems, setImgItems] = useState<BatchItem[]>([]);
  const [vidItems, setVidItems] = useState<BatchItem[]>([]);
  const items = kind === "image" ? imgItems : vidItems;
  const setItems = kind === "image" ? setImgItems : setVidItems;

  // Shared batch settings.
  const [imgFormat, setImgFormat] = useState<ImgFormat>("webp");
  const [imgQuality, setImgQuality] = useState(85);
  const [imgMaxW, setImgMaxW] = useState("1600");
  const [imgMaxH, setImgMaxH] = useState("");
  const [vidFormat, setVidFormat] = useState<VidFormat>("h264");
  const [vidCrf, setVidCrf] = useState(23);
  const [vidPreset, setVidPreset] = useState("medium");
  const [vidMaxW, setVidMaxW] = useState("1280");
  const [vidFps, setVidFps] = useState("");

  // Destination.
  const [dest, setDest] = useState<Destination>("download");
  const [baseName, setBaseName] = useState("reduced");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [tenantsError, setTenantsError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("edit");
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  // Live size projection: run each pending image through the SAME canvas pass
  // the real conversion uses, so every row shows what it will reduce down to
  // before anyone clicks Convert. Debounced so slider scrubs don't thrash; a
  // run token drops stale passes; item identity (not content) drives re-runs
  // so writing estSize back doesn't loop. GIF output is server-encoded and
  // video output isn't predictable client-side — both stay unprojected.
  const imgItemsRef = useRef(imgItems);
  useEffect(() => { imgItemsRef.current = imgItems; });
  const estRun = useRef(0);
  const imgIds = imgItems.map((i) => i.id).join(",");
  useEffect(() => {
    if (kind !== "image" || imgFormat === "gif" || phase === "running" || phase === "saving") return;
    const run = ++estRun.current;
    const t = setTimeout(async () => {
      const maxW = imgMaxW.trim() ? parseInt(imgMaxW, 10) || null : null;
      const maxH = imgMaxH.trim() ? parseInt(imgMaxH, 10) || null : null;
      for (const item of imgItemsRef.current.filter((i) => i.status === "queued")) {
        if (estRun.current !== run) return;
        let est: number | null = null;
        try {
          est = (await encodeImageClient(item.file, imgFormat, imgQuality, maxW, maxH)).size;
        } catch { /* unencodable here (e.g. AVIF unsupported) — leave unprojected */ }
        if (estRun.current !== run) return;
        setImgItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, estSize: est } : i)));
      }
    }, 400);
    return () => { clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, imgIds, imgFormat, imgQuality, imgMaxW, imgMaxH, phase]);

  useEffect(() => {
    let alive = true;
    fetch("/api/media-reducer/tenants")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { tenants: Tenant[] }) => {
        if (!alive) return;
        setTenants(j.tenants);
        if (j.tenants.length && !tenantId) setTenantId(j.tenants[0].id);
      })
      .catch(() => { if (alive) setTenantsError("Tenant list unavailable — download-only for now."); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEscapeToClose({
    open: true,
    onClose: () => { if (helpOpen) setHelpOpen(false); else onClose(); },
  });

  // ── intake ──
  const addFiles = useCallback((list: FileList | File[]) => {
    const wanted = kind === "image" ? "image/" : "video/";
    const fresh: BatchItem[] = [];
    for (const f of Array.from(list)) {
      if (!f.type.startsWith(wanted)) continue;
      const item: BatchItem = {
        id: `mr${++nextId}`,
        file: f,
        thumbUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
        status: "queued",
        percent: 0,
        out: null,
        error: null,
        savedUrl: null,
        estSize: null,
      };
      fresh.push(item);
    }
    if (fresh.length) {
      setItems((prev) => [...prev, ...fresh]);
      setPhase("edit");
    }
  }, [kind, setItems]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone?.thumbUrl) URL.revokeObjectURL(gone.thumbUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, [setItems]);

  const patchItem = useCallback((id: string, patch: Partial<BatchItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, [setItems]);

  // ── convert-all runner (sequential — one ffmpeg at a time on the shared box) ──
  const runBatch = useCallback(async () => {
    if (!items.length || phase === "running") return;
    setError(null);
    setPhase("running");
    cancelRef.current = false;
    const maxW = (s: string) => (s.trim() ? parseInt(s, 10) || null : null);

    for (const item of items) {
      if (cancelRef.current) break;
      if (item.status === "done") continue;
      patchItem(item.id, { status: "working", percent: 0, error: null });
      try {
        let out: File;
        if (kind === "image") {
          out = imgFormat === "gif"
            ? await encodeImageGifServer(item.file, imgQuality, maxW(imgMaxW), maxW(imgMaxH))
            : await encodeImageClient(item.file, imgFormat, imgQuality, maxW(imgMaxW), maxW(imgMaxH));
        } else {
          out = await convertVideoServer(
            item.file,
            { format: vidFormat, crf: vidCrf, preset: vidPreset, maxWidth: maxW(vidMaxW), fps: maxW(vidFps) },
            (p) => patchItem(item.id, { percent: p }),
          );
        }
        patchItem(item.id, { status: "done", percent: 100, out });
      } catch (e) {
        patchItem(item.id, { status: "error", error: e instanceof Error ? e.message : "Conversion failed" });
      }
    }
    setPhase("review");
  }, [items, phase, kind, imgFormat, imgQuality, imgMaxW, imgMaxH, vidFormat, vidCrf, vidPreset, vidMaxW, vidFps, patchItem]);

  // ── save / discard ──
  const doneItems = items.filter((i) => i.status === "done" && i.out);

  const saveBatch = useCallback(async () => {
    if (!doneItems.length) return;
    setError(null);
    if (dest === "download") {
      // One folder prompt for the WHOLE batch (File System Access API), files
      // named from the chosen stem with an auto-incrementing counter. Browsers
      // block the old N-anchor-clicks approach after the first download
      // ("multiple automatic downloads"), which is why only one save dialog
      // ever appeared.
      const stem = (baseName.trim() || "reduced").replace(/[/\\:*?"<>|]/g, "-");
      const named = doneItems.map((item, idx) => {
        const out = item.out as File;
        const ext = out.name.match(/\.[^.]+$/)?.[0] ?? "";
        return { item, out, name: doneItems.length === 1 ? `${stem}${ext}` : `${stem}-${idx + 1}${ext}` };
      });
      const picker = (window as unknown as {
        showDirectoryPicker?: (o?: { mode?: string }) => Promise<DirHandleLike>;
      }).showDirectoryPicker;
      if (picker) {
        let dir: DirHandleLike;
        try {
          dir = await picker({ mode: "readwrite" });
        } catch {
          return; // folder prompt dismissed — stay on the review screen
        }
        setPhase("saving");
        let failed = 0;
        for (const { item, out, name } of named) {
          try {
            const fh = await dir.getFileHandle(name, { create: true });
            const ws = await fh.createWritable();
            await ws.write(out);
            await ws.close();
            patchItem(item.id, { savedUrl: name });
          } catch (e) {
            failed++;
            patchItem(item.id, { status: "error", error: e instanceof Error ? e.message : "Save failed" });
          }
        }
        if (failed) setError(`${failed} file${failed === 1 ? "" : "s"} failed to save — the rest are in the folder.`);
        setPhase("saved");
        return;
      }
      // No File System Access API (Safari/Firefox) — numbered sequential
      // downloads; the browser asks once to allow multiple downloads.
      setPhase("saving");
      for (const { item, out, name } of named) {
        const url = URL.createObjectURL(out);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        await new Promise((r) => setTimeout(r, 350));
        URL.revokeObjectURL(url);
        patchItem(item.id, { savedUrl: name });
      }
      setPhase("saved");
      return;
    }
    // CDN path — one request per file so a single failure doesn't sink the batch.
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) { setError("Pick a tenant to upload to."); return; }
    setPhase("saving");
    let failed = 0;
    for (const item of doneItems) {
      try {
        const fd = new FormData();
        fd.append("site", tenant.id);
        fd.append("file", item.out as File);
        const res = await fetch("/api/media-reducer/upload", { method: "POST", body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
        patchItem(item.id, { savedUrl: j.url ?? null });
      } catch (e) {
        failed++;
        patchItem(item.id, { status: "error", error: e instanceof Error ? e.message : "Upload failed" });
      }
    }
    if (failed) setError(`${failed} file${failed === 1 ? "" : "s"} failed to upload — the rest are saved.`);
    setPhase("saved");
  }, [doneItems, dest, baseName, tenants, tenantId, patchItem]);

  const discardBatch = useCallback(() => {
    items.forEach((i) => { if (i.thumbUrl) URL.revokeObjectURL(i.thumbUrl); });
    setItems([]);
    setPhase("edit");
    setError(null);
  }, [items, setItems]);

  // ── totals ──
  const beforeTotal = items.reduce((n, i) => n + i.file.size, 0);
  const afterTotal = doneItems.reduce((n, i) => n + (i.out?.size ?? 0), 0);
  const savingsPct = beforeTotal && afterTotal ? Math.max(0, Math.round((1 - afterTotal / beforeTotal) * 100)) : 0;
  // Projection before conversion: real out sizes where done, estimates for the rest.
  const projTotal = items.reduce((n, i) => n + (i.out?.size ?? i.estSize ?? 0), 0);
  const projCovered = items.length > 0 && items.every((i) => i.out || i.estSize != null);
  const projPct = beforeTotal && projTotal ? Math.max(0, Math.round((1 - projTotal / beforeTotal) * 100)) : 0;
  const running = phase === "running" || phase === "saving";
  const formatInfo = kind === "image" ? IMAGE_FORMATS[imgFormat] : VIDEO_FORMATS[vidFormat];

  const formatOptions = kind === "image"
    ? IMAGE_FORMAT_ORDER.map((k) => ({ key: k, label: IMAGE_FORMATS[k].label }))
    : VIDEO_FORMAT_ORDER.map((k) => ({ key: k, label: VIDEO_FORMATS[k].label }));

  const savedCdnUrls = items.filter((i) => i.savedUrl);

  return (
    <Overlay onClick={(e) => { if (e.target === e.currentTarget && !running) onClose(); }}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>Media Reducer</ModalTitle>
          <QmbmBtn onClick={() => setHelpOpen((v) => !v)} title="File types explained">?</QmbmBtn>
          <NeonX accent="cyan" size="sm" onClick={onClose} title="Close" />
        </ModalHeader>

        <PillBarRow>
          <PillBar
            segments={[
              { key: "image", label: "Image", count: imgItems.length || undefined },
              { key: "video", label: "Video", count: vidItems.length || undefined },
            ]}
            active={kind}
            onChange={(k) => { if (!running) { setKind(k as MediaKind); setPhase("edit"); setError(null); } }}
            accent={ACCENT_RGB}
            ariaLabel="Media kind"
          />
        </PillBarRow>

        <Body>
          <DropZone
            $active={dragOver}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!running) addFiles(e.dataTransfer.files); }}
          >
            <input
              type="file"
              multiple
              accept={kind === "image" ? "image/*" : "video/*"}
              style={{ display: "none" }}
              disabled={running}
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
            />
            <CloudIcon size={30} style={{ color: ACCENT }} />
            <DropText>Drop {kind === "image" ? "images" : "videos"} here — one or a whole batch — or click to browse</DropText>
            <DropSub>{items.length ? `${items.length} file${items.length === 1 ? "" : "s"} · ${fmtBytes(beforeTotal)}` : "Files convert with the shared settings below"}</DropSub>
          </DropZone>

          <ControlsCard>
            <ControlRow>
              <Label>Format</Label>
              <DdmWrap>
                <DdmSelect
                  value={kind === "image" ? imgFormat : vidFormat}
                  onChange={(v) => (kind === "image" ? setImgFormat(v as ImgFormat) : setVidFormat(v as VidFormat))}
                  options={formatOptions}
                  ariaLabel="Output format"
                  accent={ACCENT}
                  accentRgb={ACCENT_RGB}
                />
              </DdmWrap>
              <QmbmBtn onClick={() => setHelpOpen(true)} title="File types explained">?</QmbmBtn>
              {kind === "video" && (
                <>
                  <Label>Preset</Label>
                  <Select value={vidPreset} onChange={(e) => setVidPreset(e.target.value)} disabled={running}>
                    {["ultrafast", "veryfast", "fast", "medium", "slow", "veryslow"].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </Select>
                </>
              )}
            </ControlRow>

            {kind === "image" && (imgFormat === "webp" || imgFormat === "jpeg" || imgFormat === "avif") && (
              <ControlRow>
                <Label>Quality</Label>
                <Slider type="range" min={1} max={100} value={imgQuality}
                  onChange={(e) => setImgQuality(parseInt(e.target.value))} disabled={running} />
                <SliderVal>{imgQuality}</SliderVal>
              </ControlRow>
            )}
            {kind === "video" && vidFormat !== "gif" && (
              <ControlRow>
                <Label>CRF (quality)</Label>
                <Slider type="range" min={0} max={51} value={vidCrf}
                  onChange={(e) => setVidCrf(parseInt(e.target.value))} disabled={running} />
                <SliderVal>{vidCrf}</SliderVal>
              </ControlRow>
            )}

            <ControlRow>
              <Label>Max width</Label>
              <NumberInput type="number" placeholder="px"
                value={kind === "image" ? imgMaxW : vidMaxW}
                onChange={(e) => (kind === "image" ? setImgMaxW(e.target.value) : setVidMaxW(e.target.value))}
                disabled={running} />
              {kind === "image" ? (
                <>
                  <Label>Max height</Label>
                  <NumberInput type="number" placeholder="px" value={imgMaxH}
                    onChange={(e) => setImgMaxH(e.target.value)} disabled={running} />
                </>
              ) : (
                <>
                  <Label>FPS</Label>
                  <NumberInput type="number" placeholder="auto" value={vidFps}
                    onChange={(e) => setVidFps(e.target.value)} disabled={running} />
                </>
              )}
            </ControlRow>
          </ControlsCard>

          {items.length > 0 && (
            <ListCard>
              {items.map((item) => (
                <Row key={item.id} $status={item.status}>
                  <Thumb>
                    {item.thumbUrl ? <img src={item.thumbUrl} alt="" /> : "🎬"}
                  </Thumb>
                  <RowName title={item.file.name}>{item.file.name}</RowName>
                  {item.status === "error" && <RowErr title={item.error ?? ""}>{item.error}</RowErr>}
                  {item.status === "working" && kind === "video" && <MiniBar $pct={item.percent} />}
                  <RowSizes>
                    {fmtBytes(item.file.size)}
                    {item.out ? (
                      <> → <b>{fmtBytes(item.out.size)}</b>{" "}
                        <i>−{Math.max(0, Math.round((1 - item.out.size / item.file.size) * 100))}%</i></>
                    ) : item.estSize != null ? (
                      <> → ~{fmtBytes(item.estSize)}{" "}
                        <i>−{Math.max(0, Math.round((1 - item.estSize / item.file.size) * 100))}%</i></>
                    ) : null}
                  </RowSizes>
                  <RowStatus $status={item.status}>
                    {item.status === "queued" ? "queued"
                      : item.status === "working" ? (kind === "video" ? `${item.percent}%` : "…")
                      : item.status === "done" ? (item.savedUrl ? "saved ✓" : "done ✓")
                      : "failed"}
                  </RowStatus>
                  {!running && (
                    <NeonX accent="cyan" size="sm" onClick={() => removeItem(item.id)} title="Remove from batch" />
                  )}
                </Row>
              ))}
            </ListCard>
          )}

          <DestCard>
            <ControlRow>
              <Label>Destination</Label>
              <PillBar
                segments={[
                  { key: "download", label: "Download to disk" },
                  { key: "cdn", label: "Tenant storage (CDN)" },
                ]}
                active={dest}
                onChange={(k) => { if (!running) setDest(k as Destination); }}
                accent={ACCENT_RGB}
                ariaLabel="Destination"
              />
            </ControlRow>
            {dest === "cdn" && (
              <>
                <ControlRow>
                  <Label>Tenant</Label>
                  <DdmWrap>
                    <DdmSelect
                      value={tenantId}
                      onChange={setTenantId}
                      options={tenants.map((t) => ({ key: t.id, label: t.label }))}
                      ariaLabel="Tenant"
                      placeholder={tenantsError ?? "Loading tenants…"}
                      accent={ACCENT}
                      accentRgb={ACCENT_RGB}
                    />
                  </DdmWrap>
                </ControlRow>
                <DestHint>
                  Uploads land in the selected tenant&apos;s media library on the ecosystem CDN and
                  count toward their storage tier. URLs are returned after saving.
                </DestHint>
              </>
            )}
            {dest === "download" && (
              <>
                <ControlRow>
                  <Label>Filename</Label>
                  <TextInput
                    type="text"
                    value={baseName}
                    onChange={(e) => setBaseName(e.target.value)}
                    placeholder="reduced"
                    disabled={running}
                  />
                </ControlRow>
                <DestHint>
                  Save batch asks for a folder ONCE, then every file lands there as{" "}
                  {(baseName.trim() || "reduced")}-1, {(baseName.trim() || "reduced")}-2, … Nothing
                  is uploaded. (Browsers without folder access fall back to numbered downloads.)
                </DestHint>
              </>
            )}
          </DestCard>

          {error && <ErrorBox>{error}</ErrorBox>}
          {phase === "saved" && dest === "cdn" && savedCdnUrls.length > 0 && (
            <SavedBox>
              Saved to {tenants.find((t) => t.id === tenantId)?.label}:{"\n"}
              {savedCdnUrls.map((i) => <div key={i.id}>{i.savedUrl}</div>)}
            </SavedBox>
          )}
        </Body>

        <Footer>
          {items.length > 0 && (
            <Totals>
              <b>{items.length}</b> file{items.length === 1 ? "" : "s"} · {fmtBytes(beforeTotal)}
              {doneItems.length === items.length && doneItems.length > 0 ? (
                <> → <b>{fmtBytes(afterTotal)}</b> <i>−{savingsPct}%</i></>
              ) : projCovered ? (
                <> → ~<b>{fmtBytes(projTotal)}</b> <i>−{projPct}%</i> projected</>
              ) : null}
              {formatInfo && <> · {formatInfo.label}</>}
            </Totals>
          )}
          {phase === "review" || phase === "saved" ? (
            <BtnRow>
              {phase === "review" && (
                <ActionBtn onClick={saveBatch} disabled={!doneItems.length}>
                  {dest === "download" ? "Save batch to disk" : "Save batch to CDN"}
                </ActionBtn>
              )}
              <ActionBtn $tone={phase === "saved" ? "ghost" : "danger"} onClick={discardBatch}>
                {phase === "saved" ? "Clear & start another" : "Discard batch"}
              </ActionBtn>
            </BtnRow>
          ) : (
            <BtnRow>
              <ActionBtn
                onClick={runBatch}
                disabled={!items.length || running}
              >
                {phase === "running" ? "Converting…" : phase === "saving" ? "Saving…"
                  : `Convert ${items.length || ""} ${kind === "image" ? "image" : "video"}${items.length === 1 ? "" : "s"}`}
              </ActionBtn>
              {phase === "running" && (
                <ActionBtn $tone="danger" onClick={() => { cancelRef.current = true; }}>
                  Stop after current
                </ActionBtn>
              )}
            </BtnRow>
          )}
        </Footer>

        {helpOpen && <FormatQmbm kind={kind} onClose={() => setHelpOpen(false)} />}
      </Modal>
    </Overlay>
  );
}

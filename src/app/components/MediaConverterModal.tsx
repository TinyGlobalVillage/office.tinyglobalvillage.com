"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import styled, { keyframes } from "styled-components";
import { colors, rgb } from "../theme";

export type MediaConverterModalProps = {
  defaultTab?: "image" | "video";
  onClose: () => void;
  onFileConverted: (file: File) => void;
};

// ── Animations ────────────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
`;

// ── Overlay + Modal ───────────────────────────────────────────────────────────

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
  border: 1px solid rgba(${rgb.green}, 0.22);
  border-radius: 1rem;
  box-shadow: 0 0 40px rgba(${rgb.green}, 0.12), 0 20px 60px rgba(0,0,0,0.7);
  width: 100%;
  max-width: 640px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  animation: ${fadeIn} 0.18s ease;
  overflow: hidden;

  [data-theme="light"] & {
    background: #f4f4f8;
    border-color: rgba(${rgb.green}, 0.18);
  }
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid rgba(${rgb.green}, 0.12);
  gap: 0.75rem;
  flex-shrink: 0;
`;

const ModalTitle = styled.h2`
  font-size: 0.875rem;
  font-weight: 700;
  color: ${colors.green};
  text-shadow: 0 0 8px rgba(${rgb.green}, 0.8), 0 0 20px rgba(${rgb.green}, 0.4);
  margin: 0;
  flex: 1;
`;

const CloseBtn = styled.button`
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  background: rgba(${rgb.green}, 0.08);
  border: 1px solid rgba(${rgb.green}, 0.2);
  color: ${colors.green};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(${rgb.green}, 0.15);
    box-shadow: 0 0 14px rgba(${rgb.green}, 0.6);
  }
`;

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TabBar = styled.div`
  display: flex;
  padding: 0.5rem 1rem 0;
  gap: 0.25rem;
  flex-shrink: 0;
`;

const Tab = styled.button<{ $active?: boolean }>`
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.375rem 0.875rem;
  border-radius: 0.5rem 0.5rem 0 0;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
  border-bottom: none;
  background: ${(p) => p.$active ? `rgba(${rgb.green}, 0.12)` : "transparent"};
  color: ${(p) => p.$active ? colors.green : "var(--t-textGhost)"};
  border-color: ${(p) => p.$active ? `rgba(${rgb.green}, 0.25)` : "transparent"};

  &:hover {
    color: ${(p) => p.$active ? colors.green : "var(--t-textMuted)"};
    background: rgba(${rgb.green}, 0.07);
  }
`;

// ── Body ──────────────────────────────────────────────────────────────────────

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  scrollbar-width: thin;
`;

// ── Drop zone ─────────────────────────────────────────────────────────────────

const DropZone = styled.label<{ $hasFile?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 0.75rem;
  border: 1.5px dashed ${(p) => p.$hasFile ? `rgba(${rgb.green}, 0.5)` : `rgba(${rgb.green}, 0.25)`};
  background: ${(p) => p.$hasFile ? `rgba(${rgb.green}, 0.06)` : "rgba(255,255,255,0.02)"};
  padding: 1.5rem 1rem;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;

  &:hover {
    border-color: rgba(${rgb.green}, 0.5);
    background: rgba(${rgb.green}, 0.06);
  }
`;

const DropIcon = styled.span`
  font-size: 1.75rem;
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

const ControlRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const Label = styled.label`
  font-size: 0.6875rem;
  color: var(--t-textMuted);
  white-space: nowrap;
`;

const Select = styled.select`
  flex: 1;
  min-width: 100px;
  background: var(--t-inputBg, rgba(255,255,255,0.05));
  border: 1px solid rgba(${rgb.green}, 0.25);
  border-radius: 0.5rem;
  padding: 0.375rem 0.625rem;
  color: var(--t-text);
  font-size: 0.75rem;
  cursor: pointer;

  &:focus { outline: none; border-color: rgba(${rgb.green}, 0.5); }
`;

const NumberInput = styled.input`
  width: 80px;
  background: var(--t-inputBg, rgba(255,255,255,0.05));
  border: 1px solid rgba(${rgb.green}, 0.25);
  border-radius: 0.5rem;
  padding: 0.375rem 0.625rem;
  color: var(--t-text);
  font-size: 0.75rem;

  &:focus { outline: none; border-color: rgba(${rgb.green}, 0.5); }
`;

const SliderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const Slider = styled.input`
  flex: 1;
  accent-color: ${colors.green};
`;

const SliderVal = styled.span`
  font-size: 0.6875rem;
  color: ${colors.green};
  width: 2rem;
  text-align: right;
`;

// ── Preview area ──────────────────────────────────────────────────────────────

const PreviewRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
`;

const PreviewBox = styled.div`
  border-radius: 0.75rem;
  border: 1px solid rgba(${rgb.green}, 0.15);
  background: rgba(0,0,0,0.3);
  overflow: hidden;
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
`;

const PreviewLabel = styled.span`
  font-size: 0.5625rem;
  color: var(--t-textGhost);
  position: absolute;
  top: 0.375rem;
  left: 0.5rem;
  z-index: 1;
  background: rgba(0,0,0,0.5);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
`;

const PreviewImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

const PreviewPlaceholder = styled.span`
  font-size: 0.625rem;
  color: var(--t-textGhost);
`;

// ── Progress + errors ─────────────────────────────────────────────────────────

const ProgressBar = styled.div<{ $pct: number }>`
  height: 6px;
  border-radius: 3px;
  background: rgba(${rgb.green}, 0.15);
  overflow: hidden;

  &::after {
    content: "";
    display: block;
    height: 100%;
    width: ${(p) => p.$pct}%;
    background: ${colors.green};
    box-shadow: 0 0 8px rgba(${rgb.green}, 0.6);
    transition: width 0.3s ease;
    border-radius: 3px;
  }
`;

const ProgressText = styled.p`
  font-size: 0.6875rem;
  color: ${colors.green};
  margin: 0;
  text-align: center;
`;

const ErrorBox = styled.div`
  font-size: 0.6875rem;
  color: ${colors.red};
  background: rgba(${rgb.red}, 0.08);
  border: 1px solid rgba(${rgb.red}, 0.2);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
`;

// ── Action buttons ────────────────────────────────────────────────────────────

const ActionBtn = styled.button<{ $disabled?: boolean }>`
  width: 100%;
  padding: 0.625rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: ${(p) => p.$disabled ? "not-allowed" : "pointer"};
  opacity: ${(p) => p.$disabled ? 0.4 : 1};
  background: rgba(${rgb.green}, 0.12);
  border: 1px solid rgba(${rgb.green}, 0.35);
  color: ${colors.green};
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: rgba(${rgb.green}, 0.2);
    box-shadow: 0 0 14px rgba(${rgb.green}, 0.35);
  }
`;

const AttachBtn = styled.button`
  width: 100%;
  padding: 0.625rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  background: rgba(${rgb.green}, 0.2);
  border: 1px solid rgba(${rgb.green}, 0.5);
  color: ${colors.green};
  text-shadow: 0 0 8px rgba(${rgb.green}, 0.6);
  transition: all 0.15s;

  &:hover {
    background: rgba(${rgb.green}, 0.28);
    box-shadow: 0 0 18px rgba(${rgb.green}, 0.45);
  }
`;

// ── Minimized float ───────────────────────────────────────────────────────────

const MinimizedFloat = styled.button`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 10500;
  background: rgba(${rgb.green}, 0.15);
  border: 1px solid rgba(${rgb.green}, 0.4);
  border-radius: 2rem;
  padding: 0.5rem 1rem;
  color: ${colors.green};
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 0 20px rgba(${rgb.green}, 0.3);
  transition: all 0.15s;

  &:hover {
    background: rgba(${rgb.green}, 0.25);
    box-shadow: 0 0 28px rgba(${rgb.green}, 0.5);
  }
`;

// ── Canvas helpers ────────────────────────────────────────────────────────────

function makeTestPattern(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#1a0033");
  grad.addColorStop(0.5, "#003318");
  grad.addColorStop(1, "#001a33");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(74,222,128,${Math.random() * 0.6 + 0.2})`;
    ctx.fill();
  }
  ctx.font = "bold 14px monospace";
  ctx.fillStyle = colors.green;
  ctx.textAlign = "center";
  ctx.fillText("After preview", W / 2, H / 2);
}

// ── Image Tab ─────────────────────────────────────────────────────────────────

function ImageTab({ onFileConverted }: { onFileConverted: (f: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<"webp" | "jpeg" | "png" | "gif">("webp");
  const [quality, setQuality] = useState(85);
  const [maxWidth, setMaxWidth] = useState("");
  const [maxHeight, setMaxHeight] = useState("");
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const afterCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [file]);

  useEffect(() => {
    if (afterCanvasRef.current) {
      makeTestPattern(afterCanvasRef.current);
    }
  }, []);

  const convert = async () => {
    if (!file || converting) return;
    setError(null);
    setConverting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("format", format);
      fd.append("quality", String(quality));
      if (maxWidth) fd.append("maxWidth", maxWidth);
      if (maxHeight) fd.append("maxHeight", maxHeight);

      const res = await fetch("/api/chat/convert/image", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const ext = format === "jpeg" ? ".jpg" : `.${format}`;
      const baseName = file.name.replace(/\.[^.]+$/, "");
      const outFile = new File([blob], `${baseName}-converted${ext}`, { type: blob.type });
      onFileConverted(outFile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed");
    } finally {
      setConverting(false);
    }
  };

  return (
    <>
      <DropZone $hasFile={!!file}>
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); }}
        />
        <DropIcon>{file ? "🖼️" : "📁"}</DropIcon>
        <DropText>{file ? file.name : "Drop an image or click to browse"}</DropText>
        {file && <DropSub>{(file.size / 1024).toFixed(1)} KB</DropSub>}
      </DropZone>

      <ControlRow>
        <Label>Format</Label>
        <Select value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
          <option value="webp">WebP</option>
          <option value="jpeg">JPEG</option>
          <option value="png">PNG</option>
          <option value="gif">GIF</option>
        </Select>
      </ControlRow>

      {(format === "webp" || format === "jpeg") && (
        <SliderRow>
          <Label>Quality</Label>
          <Slider
            type="range" min={1} max={100} value={quality}
            onChange={(e) => setQuality(parseInt(e.target.value))}
          />
          <SliderVal>{quality}</SliderVal>
        </SliderRow>
      )}

      <ControlRow>
        <Label>Max width</Label>
        <NumberInput
          type="number" placeholder="px" value={maxWidth}
          onChange={(e) => setMaxWidth(e.target.value)}
        />
        <Label>Max height</Label>
        <NumberInput
          type="number" placeholder="px" value={maxHeight}
          onChange={(e) => setMaxHeight(e.target.value)}
        />
      </ControlRow>

      <PreviewRow>
        <PreviewBox>
          <PreviewLabel>Before</PreviewLabel>
          {previewUrl
            ? <PreviewImg src={previewUrl} alt="before" />
            : <PreviewPlaceholder>No file selected</PreviewPlaceholder>
          }
        </PreviewBox>
        <PreviewBox>
          <PreviewLabel>After (preview)</PreviewLabel>
          <canvas
            ref={afterCanvasRef}
            width={240}
            height={135}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </PreviewBox>
      </PreviewRow>

      {error && <ErrorBox>{error}</ErrorBox>}

      <ActionBtn onClick={convert} disabled={!file || converting} $disabled={!file || converting}>
        {converting ? "Converting…" : "Convert & Attach"}
      </ActionBtn>
    </>
  );
}

// ── Video Tab ─────────────────────────────────────────────────────────────────

function VideoTab({ onFileConverted }: { onFileConverted: (f: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<"h264" | "h265" | "vp9" | "gif">("h264");
  const [crf, setCrf] = useState(23);
  const [maxWidth, setMaxWidth] = useState("");
  const [fps, setFps] = useState("");
  const [vidStarting, setVidStarting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [gifPreviewUrl, setGifPreviewUrl] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const thumbVideoRef = useRef<HTMLVideoElement>(null);

  // Generate thumbnail when file changes
  useEffect(() => {
    if (!file) { setThumbUrl(null); return; }
    const url = URL.createObjectURL(file);
    const vid = document.createElement("video");
    vid.src = url;
    vid.muted = true;
    vid.currentTime = 0.15;
    vid.onloadeddata = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 135;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(vid, 0, 0, 240, 135);
      setThumbUrl(canvas.toDataURL());
      URL.revokeObjectURL(url);
    };
    vid.onerror = () => { URL.revokeObjectURL(url); };
  }, [file]);

  // Generate GIF preview when file changes
  useEffect(() => {
    if (!file) { setGifPreviewUrl(null); return; }
    let cancelled = false;
    const doPreview = async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("format", "gif");
        fd.append("preview", "true");
        fd.append("previewSecs", "3");
        const res = await fetch("/api/chat/convert/video", { method: "POST", body: fd });
        if (cancelled || !res.ok) return;
        const blob = await res.blob();
        if (!cancelled) setGifPreviewUrl(URL.createObjectURL(blob));
      } catch { /* ignore */ }
    };
    doPreview();
    return () => { cancelled = true; };
  }, [file]);

  const startConversion = async () => {
    if (!file || vidStarting || jobId) return;
    setError(null);
    setVidStarting(true);
    setPercent(0);
    setDone(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("format", format);
      fd.append("crf", String(crf));
      if (maxWidth) fd.append("maxWidth", maxWidth);
      if (fps) fd.append("fps", fps);

      const res = await fetch("/api/chat/convert/video/start", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const { jobId: jid } = await res.json();
      setJobId(jid);
      setVidStarting(false);

      // Open SSE for progress
      const es = new EventSource(`/api/chat/convert/video/progress?jobId=${jid}`);
      es.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.error) { setError(d.error); setDone(true); es.close(); return; }
          setPercent(d.percent ?? 0);
          if (d.done) { setDone(true); es.close(); }
        } catch { /* ignore */ }
      };
      es.onerror = () => { es.close(); };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start conversion");
      setVidStarting(false);
    }
  };

  const attachResult = useCallback(async () => {
    if (!jobId || !done) return;
    try {
      const res = await fetch(`/api/chat/convert/video/result?jobId=${jobId}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const ext = format === "gif" ? ".gif" : format === "vp9" ? ".webm" : ".mp4";
      const baseName = (file?.name ?? "video").replace(/\.[^.]+$/, "");
      const outFile = new File([blob], `${baseName}-converted${ext}`, { type: blob.type });
      onFileConverted(outFile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to retrieve result");
    }
  }, [jobId, done, format, file, onFileConverted]);

  const reset = () => {
    setJobId(null);
    setPercent(0);
    setDone(false);
    setError(null);
    setMinimized(false);
  };

  const isRunning = !!jobId && !done;

  if (minimized && isRunning) {
    return (
      <MinimizedFloat onClick={() => setMinimized(false)}>
        Converting… {percent}%
      </MinimizedFloat>
    );
  }

  return (
    <>
      <DropZone $hasFile={!!file}>
        <input
          type="file"
          accept="video/*"
          style={{ display: "none" }}
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); reset(); }}
        />
        <DropIcon>{file ? "🎬" : "📁"}</DropIcon>
        <DropText>{file ? file.name : "Drop a video or click to browse"}</DropText>
        {file && <DropSub>{(file.size / 1048576).toFixed(1)} MB</DropSub>}
      </DropZone>

      <ControlRow>
        <Label>Format</Label>
        <Select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} disabled={isRunning}>
          <option value="h264">H.264 (MP4)</option>
          <option value="h265">H.265 (MP4)</option>
          <option value="vp9">VP9 (WebM)</option>
          <option value="gif">GIF</option>
        </Select>
      </ControlRow>

      {format !== "gif" && (
        <SliderRow>
          <Label>CRF (quality)</Label>
          <Slider
            type="range" min={0} max={51} value={crf}
            onChange={(e) => setCrf(parseInt(e.target.value))}
            disabled={isRunning}
          />
          <SliderVal>{crf}</SliderVal>
        </SliderRow>
      )}

      <ControlRow>
        <Label>Max width</Label>
        <NumberInput
          type="number" placeholder="px" value={maxWidth}
          onChange={(e) => setMaxWidth(e.target.value)}
          disabled={isRunning}
        />
        <Label>FPS</Label>
        <NumberInput
          type="number" placeholder="auto" value={fps}
          onChange={(e) => setFps(e.target.value)}
          disabled={isRunning}
        />
      </ControlRow>

      <PreviewRow>
        <PreviewBox>
          <PreviewLabel>Before</PreviewLabel>
          {thumbUrl
            ? <PreviewImg src={thumbUrl} alt="before" />
            : <PreviewPlaceholder>No video selected</PreviewPlaceholder>
          }
        </PreviewBox>
        <PreviewBox>
          <PreviewLabel>After (GIF preview)</PreviewLabel>
          {gifPreviewUrl
            ? <PreviewImg src={gifPreviewUrl} alt="gif preview" />
            : <PreviewPlaceholder>{file ? "Generating preview…" : "No video selected"}</PreviewPlaceholder>
          }
        </PreviewBox>
      </PreviewRow>

      {error && <ErrorBox>{error}</ErrorBox>}

      {isRunning && (
        <>
          <ProgressBar $pct={percent} />
          <ProgressText>Converting… {percent}%</ProgressText>
          <ActionBtn onClick={() => setMinimized(true)} $disabled={false}>
            Minimize
          </ActionBtn>
        </>
      )}

      {done && !error && (
        <AttachBtn onClick={attachResult}>
          Attach to Chat
        </AttachBtn>
      )}

      {!isRunning && !done && (
        <ActionBtn
          onClick={startConversion}
          disabled={!file || vidStarting}
          $disabled={!file || vidStarting}
        >
          {vidStarting ? "Starting…" : "Convert & Attach"}
        </ActionBtn>
      )}

      {done && (
        <ActionBtn onClick={reset} $disabled={false} style={{ marginTop: "0.25rem", opacity: 0.6 }}>
          Convert another
        </ActionBtn>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MediaConverterModal({
  defaultTab = "image",
  onClose,
  onFileConverted,
}: MediaConverterModalProps) {
  const [tab, setTab] = useState<"image" | "video">(defaultTab);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Overlay onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>Media Converter</ModalTitle>
          <CloseBtn onClick={onClose}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </CloseBtn>
        </ModalHeader>

        <TabBar>
          <Tab $active={tab === "image"} onClick={() => setTab("image")}>🖼 Image</Tab>
          <Tab $active={tab === "video"} onClick={() => setTab("video")}>🎬 Video</Tab>
        </TabBar>

        <Body>
          {tab === "image"
            ? <ImageTab onFileConverted={(f) => { onFileConverted(f); onClose(); }} />
            : <VideoTab onFileConverted={(f) => { onFileConverted(f); onClose(); }} />
          }
        </Body>
      </Modal>
    </Overlay>
  );
}

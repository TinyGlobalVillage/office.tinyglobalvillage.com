"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import styled, { keyframes } from "styled-components";
import { colors, rgb } from "../theme";
import { CloudIcon } from "./icons";
import NeonX from "./NeonX";
import { useModalLifecycle } from "../lib/drawerKnobs";

export type MinimizedConversionInfo = {
  jobId: string;
  format: "h264" | "h265" | "vp9" | "gif";
  fileName: string;
  thumbUrl: string | null;
  percent: number;
};

export type MediaConverterModalProps = {
  defaultTab?: "image" | "video";
  onClose: () => void;
  onFileConverted: (file: File) => void;
  onMinimizeConversion?: (info: MinimizedConversionInfo) => void;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  line-height: 1;
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

const RangeBtn = styled.button`
  flex: 1;
  min-width: 100px;
  background: rgba(${rgb.green}, 0.12);
  border: 1px solid rgba(${rgb.green}, 0.35);
  border-radius: 0.5rem;
  padding: 0.375rem 0.625rem;
  color: ${colors.green};
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: rgba(${rgb.green}, 0.22);
    border-color: rgba(${rgb.green}, 0.55);
    box-shadow: 0 0 10px rgba(${rgb.green}, 0.35);
  }

  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const RangeClearBtn = styled.button`
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.375rem;
  background: rgba(${rgb.red}, 0.12);
  border: 1px solid rgba(${rgb.red}, 0.4);
  color: ${colors.red};
  font-size: 0.875rem;
  line-height: 1;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: rgba(${rgb.red}, 0.22);
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

// ── GIF range modal ───────────────────────────────────────────────────────────

const RangeOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10050;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const RangeModal = styled.div`
  background: #0d0f1a;
  border: 1px solid rgba(${rgb.green}, 0.35);
  border-radius: 1rem;
  box-shadow: 0 0 40px rgba(${rgb.green}, 0.2), 0 20px 60px rgba(0,0,0,0.7);
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: ${fadeIn} 0.18s ease;

  [data-theme="light"] & { background: #f4f4f8; }
`;

const RangeHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(${rgb.green}, 0.18);
  gap: 0.75rem;
`;

const RangeTitle = styled.h2`
  flex: 1;
  font-size: 0.875rem;
  font-weight: 700;
  color: ${colors.green};
  margin: 0;
  text-shadow: 0 0 8px rgba(${rgb.green}, 0.6);
`;

const RangeBody = styled.div`
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
`;

const RangeVideo = styled.video`
  width: 100%;
  border-radius: 0.5rem;
  background: #000;
  aspect-ratio: 16/9;
  object-fit: contain;
`;

const RangeScrubRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const RangeScrubLabel = styled.span`
  flex: 1;
  font-size: 0.6875rem;
  color: var(--t-textMuted);
  b { color: ${colors.green}; }
`;

const RangeToggle = styled.button`
  padding: 0.25rem 0.625rem;
  background: rgba(${rgb.green}, 0.14);
  border: 1px solid rgba(${rgb.green}, 0.4);
  color: ${colors.green};
  border-radius: 0.5rem;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;

  &:hover { background: rgba(${rgb.green}, 0.24); }
`;

const RangeSliderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
`;

const RangeSliderLabel = styled.span`
  width: 6rem;
  font-size: 0.6875rem;
  color: ${colors.green};
  font-weight: 600;
`;

const RangeWarn = styled.p`
  margin: 0;
  font-size: 0.625rem;
  color: ${colors.red};
`;

const RangeApplyBtn = styled.button<{ $disabled?: boolean }>`
  padding: 0.625rem;
  background: ${(p) => (p.$disabled ? "rgba(255,255,255,0.05)" : `rgba(${rgb.green}, 0.2)`)};
  border: 1px solid ${(p) => (p.$disabled ? "rgba(255,255,255,0.1)" : `rgba(${rgb.green}, 0.5)`)};
  color: ${(p) => (p.$disabled ? "var(--t-textGhost)" : colors.green)};
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: ${(p) => (p.$disabled ? "not-allowed" : "pointer")};

  &:hover:not(:disabled) {
    background: rgba(${rgb.green}, 0.32);
    box-shadow: 0 0 12px rgba(${rgb.green}, 0.4);
  }
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

const ProgressRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ProgressBar = styled.div<{ $pct: number }>`
  flex: 1;
  height: 10px;
  border-radius: 5px;
  background: rgba(${rgb.green}, 0.15);
  overflow: hidden;
  position: relative;

  &::after {
    content: "";
    display: block;
    height: 100%;
    width: ${(p) => p.$pct}%;
    background: ${colors.green};
    box-shadow: 0 0 8px rgba(${rgb.green}, 0.6);
    transition: width 0.3s ease;
    border-radius: 5px;
  }
`;

const ProgressPct = styled.span`
  font-size: 0.6875rem;
  font-weight: 700;
  color: ${colors.green};
  font-variant-numeric: tabular-nums;
  min-width: 2.25rem;
  text-align: right;
`;

const PreviewClear = styled.span`
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
  z-index: 2;
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

// ── QMBM (Question-Mark-Bubble Modal) ─────────────────────────────────────────

const QmbmBtn = styled.button`
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  border: 1px solid rgba(${rgb.green}, 0.55);
  background: rgba(${rgb.green}, 0.12);
  color: ${colors.green};
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  &:hover { background: rgba(${rgb.green}, 0.22); box-shadow: 0 0 10px rgba(${rgb.green}, 0.5); }
`;

const QmbmPanel = styled.div`
  position: absolute;
  inset: 0;
  background: #0d0f1a;
  z-index: 2;
  padding: 0.875rem 1rem 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  animation: ${fadeIn} 0.15s ease;
  [data-theme="light"] & { background: #f4f4f8; }
`;

const QmbmHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(${rgb.green}, 0.15);
`;

const QmbmTitle = styled.h3`
  font-size: 0.8125rem;
  font-weight: 700;
  color: ${colors.green};
  text-shadow: 0 0 6px rgba(${rgb.green}, 0.6);
  margin: 0;
  flex: 1;
`;

const QmbmFeatureCard = styled.div`
  border: 1px solid rgba(${rgb.green}, 0.15);
  border-radius: 0.625rem;
  padding: 0.625rem 0.75rem;
  background: rgba(${rgb.green}, 0.03);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const QmbmFeatureTitle = styled.h4`
  font-size: 0.75rem;
  font-weight: 700;
  color: ${colors.green};
  margin: 0;
`;

const QmbmFeatureDesc = styled.p`
  font-size: 0.6875rem;
  color: var(--t-textMuted);
  margin: 0;
  line-height: 1.45;
`;

const QmbmGifRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
`;

const QmbmGifBox = styled.div`
  aspect-ratio: 16/9;
  border: 1px solid rgba(${rgb.green}, 0.15);
  border-radius: 0.5rem;
  overflow: hidden;
  background: rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
`;

const QmbmGifLabel = styled.span`
  position: absolute;
  top: 0.25rem;
  left: 0.375rem;
  z-index: 1;
  font-size: 0.5rem;
  color: var(--t-textGhost);
  background: rgba(0,0,0,0.55);
  padding: 0.125rem 0.3125rem;
  border-radius: 0.25rem;
`;

const QmbmGifImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const QmbmGifMissing = styled.span`
  font-size: 0.5625rem;
  color: var(--t-textGhost);
`;

type Feature = {
  title: string;
  desc: string;
  before?: string;
  after?: string;
};

const IMAGE_FEATURES: Feature[] = [
  {
    title: "Format conversion",
    desc: "Re-encode between WebP, JPEG, PNG, and GIF. WebP is recommended for chat — smallest files at same quality.",
    before: "/media-converter-help/image-format-before.gif",
    after: "/media-converter-help/image-format-after.gif",
  },
  {
    title: "Quality slider",
    desc: "For WebP and JPEG. Lower values = smaller file, more visible artifacts. 85 is a good default.",
    before: "/media-converter-help/image-quality-before.gif",
    after: "/media-converter-help/image-quality-after.gif",
  },
  {
    title: "Max width / height",
    desc: "Downscale on the largest side while keeping aspect ratio. Leave blank to keep the original dimensions.",
    before: "/media-converter-help/image-resize-before.gif",
    after: "/media-converter-help/image-resize-after.gif",
  },
];

const VIDEO_FEATURES: Feature[] = [
  {
    title: "Codec / format",
    desc: "H.264 for max compatibility, H.265 for smaller files at the same quality, VP9 for WebM, GIF for looping previews.",
    before: "/media-converter-help/video-codec-before.gif",
    after: "/media-converter-help/video-codec-after.gif",
  },
  {
    title: "CRF quality",
    desc: "Constant-Rate Factor. 18–23 is visually lossless; higher = smaller + more compression. Default 23.",
    before: "/media-converter-help/video-crf-before.gif",
    after: "/media-converter-help/video-crf-after.gif",
  },
  {
    title: "Live GIF preview",
    desc: "A 3-second GIF is generated from the start of your video so you can preview before committing to the full conversion.",
    before: "/media-converter-help/video-gifpreview-before.gif",
    after: "/media-converter-help/video-gifpreview-after.gif",
  },
];

function QmbmHelp({ tab, onClose }: { tab: "image" | "video"; onClose: () => void }) {
  const features = tab === "image" ? IMAGE_FEATURES : VIDEO_FEATURES;
  return (
    <QmbmPanel>
      <QmbmHead>
        <QmbmTitle>Media Converter — how it works</QmbmTitle>
        <CloseBtn onClick={onClose} title="Close help">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </CloseBtn>
      </QmbmHead>
      {features.map((f) => (
        <QmbmFeatureCard key={f.title}>
          <QmbmFeatureTitle>{f.title}</QmbmFeatureTitle>
          <QmbmFeatureDesc>{f.desc}</QmbmFeatureDesc>
          <QmbmGifRow>
            <QmbmGifBox>
              <QmbmGifLabel>Before</QmbmGifLabel>
              {f.before
                ? <QmbmGifImg src={f.before} alt="before" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                : <QmbmGifMissing>preview coming soon</QmbmGifMissing>}
            </QmbmGifBox>
            <QmbmGifBox>
              <QmbmGifLabel>After</QmbmGifLabel>
              {f.after
                ? <QmbmGifImg src={f.after} alt="after" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                : <QmbmGifMissing>preview coming soon</QmbmGifMissing>}
            </QmbmGifBox>
          </QmbmGifRow>
        </QmbmFeatureCard>
      ))}
    </QmbmPanel>
  );
}

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
  const [afterPreviewUrl, setAfterPreviewUrl] = useState<string | null>(null);
  const [afterSize, setAfterSize] = useState<number | null>(null);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Real client-side "After" preview: re-encode via <canvas>.toBlob using the
  // selected format + quality + max dims. Gives the user instant visual +
  // size feedback without a server round-trip. GIF falls back to PNG preview
  // (browsers can't encode GIF via canvas.toBlob).
  useEffect(() => {
    if (!file) { setAfterPreviewUrl(null); setAfterSize(null); return; }
    let cancelled = false;
    let blobUrl: string | null = null;
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      if (cancelled) { URL.revokeObjectURL(src); return; }
      const maxW = maxWidth ? parseInt(maxWidth) : img.width;
      const maxH = maxHeight ? parseInt(maxHeight) : img.height;
      const scale = Math.min(1, maxW / img.width, maxH / img.height);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(src); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const mime =
        format === "webp" ? "image/webp" :
        format === "jpeg" ? "image/jpeg" :
        format === "png"  ? "image/png"  :
        "image/png";
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(src);
          if (cancelled || !blob) return;
          blobUrl = URL.createObjectURL(blob);
          setAfterPreviewUrl(blobUrl);
          setAfterSize(blob.size);
        },
        mime,
        quality / 100,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(src); };
    img.src = src;
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [file, format, quality, maxWidth, maxHeight]);

  // Canvas can natively encode webp/jpeg/png — no server round-trip needed.
  // Only GIF still requires ffmpeg on the server.
  const encodeClientSide = async (): Promise<File | null> => {
    if (!file || format === "gif") return null;
    return new Promise((resolve) => {
      const img = new Image();
      const src = URL.createObjectURL(file);
      img.onload = () => {
        const maxW = maxWidth ? parseInt(maxWidth) : img.width;
        const maxH = maxHeight ? parseInt(maxHeight) : img.height;
        const scale = Math.min(1, maxW / img.width, maxH / img.height);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { URL.revokeObjectURL(src); resolve(null); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const mime =
          format === "webp" ? "image/webp" :
          format === "jpeg" ? "image/jpeg" :
          "image/png";
        const ext = format === "jpeg" ? ".jpg" : `.${format}`;
        const baseName = file.name.replace(/\.[^.]+$/, "");
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(src);
            if (!blob) { resolve(null); return; }
            resolve(new File([blob], `${baseName}-converted${ext}`, { type: mime }));
          },
          mime,
          quality / 100,
        );
      };
      img.onerror = () => { URL.revokeObjectURL(src); resolve(null); };
      img.src = src;
    });
  };

  const convert = async () => {
    if (!file || converting) return;
    setError(null);
    setConverting(true);
    try {
      const local = await encodeClientSide();
      if (local) { onFileConverted(local); return; }

      // GIF path — fall back to ffmpeg server route.
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
        <DropIcon>
          {file ? "🖼️" : <CloudIcon size={30} style={{ color: colors.green }} />}
        </DropIcon>
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
          <PreviewLabel>Before{file ? ` · ${(file.size / 1024).toFixed(0)} KB` : ""}</PreviewLabel>
          {previewUrl
            ? <PreviewImg src={previewUrl} alt="before" />
            : <PreviewPlaceholder>No file selected</PreviewPlaceholder>
          }
        </PreviewBox>
        <PreviewBox>
          <PreviewLabel>After{afterSize != null ? ` · ${(afterSize / 1024).toFixed(0)} KB` : ""}</PreviewLabel>
          {file && (
            <PreviewClear>
              <NeonX accent="green" size="sm" onClick={() => { setFile(null); setError(null); }} title="Clear upload" />
            </PreviewClear>
          )}
          {afterPreviewUrl
            ? <PreviewImg src={afterPreviewUrl} alt="after" />
            : <PreviewPlaceholder>{file ? "Rendering preview…" : "No file selected"}</PreviewPlaceholder>
          }
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

function VideoTab({ onFileConverted, onHandoff, setIsRunningRef }: {
  onFileConverted: (f: File) => void;
  onHandoff?: (info: MinimizedConversionInfo) => void;
  setIsRunningRef?: (cb: () => MinimizedConversionInfo | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<"h264" | "h265" | "vp9" | "gif">("h264");
  const [crf, setCrf] = useState(23);
  const [preset, setPreset] = useState<"ultrafast" | "veryfast" | "fast" | "medium" | "slow" | "veryslow">("medium");
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
  const [gifRangeOpen, setGifRangeOpen] = useState(false);
  const [gifStartSecs, setGifStartSecs] = useState<number | null>(null);
  const [gifEndSecs, setGifEndSecs] = useState<number | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const thumbVideoRef = useRef<HTMLVideoElement>(null);

  // Generate thumbnail + capture duration when file changes
  useEffect(() => {
    if (!file) {
      setThumbUrl(null);
      setVideoDuration(0);
      setGifStartSecs(null);
      setGifEndSecs(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const vid = document.createElement("video");
    vid.src = url;
    vid.muted = true;
    vid.preload = "metadata";
    vid.onloadedmetadata = () => {
      if (isFinite(vid.duration) && vid.duration > 0) setVideoDuration(vid.duration);
      vid.currentTime = 0.15;
    };
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

  // Generate GIF preview when file or selected range changes
  useEffect(() => {
    if (!file) { setGifPreviewUrl(null); return; }
    let cancelled = false;
    const doPreview = async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("format", "gif");
        fd.append("preview", "true");
        if (gifStartSecs !== null && gifEndSecs !== null && gifEndSecs > gifStartSecs) {
          fd.append("startSecs", String(gifStartSecs));
          fd.append("previewSecs", String(Math.min(6, gifEndSecs - gifStartSecs)));
        } else {
          fd.append("previewSecs", "3");
        }
        const res = await fetch("/api/chat/convert/video", { method: "POST", body: fd });
        if (cancelled || !res.ok) return;
        const blob = await res.blob();
        if (!cancelled) setGifPreviewUrl(URL.createObjectURL(blob));
      } catch { /* ignore */ }
    };
    doPreview();
    return () => { cancelled = true; };
  }, [file, gifStartSecs, gifEndSecs]);

  const startConversion = async () => {
    if (!file || vidStarting || jobId) return;
    setError(null);
    setVidStarting(true);
    setPercent(0);
    setDone(false);
    try {
      // Cloudflare caps request bodies at ~100 MB on free plans, so anything
      // larger has to be split client-side and reassembled by the start route.
      const CHUNK_THRESHOLD = 90 * 1024 * 1024;
      const CHUNK_SIZE = 80 * 1024 * 1024;
      const fd = new FormData();
      fd.append("format", format);
      fd.append("crf", String(crf));
      fd.append("preset", preset);
      if (maxWidth) fd.append("maxWidth", maxWidth);
      if (fps) fd.append("fps", fps);
      if (format === "gif" && gifStartSecs !== null) fd.append("startSecs", String(gifStartSecs));
      if (format === "gif" && gifEndSecs !== null) fd.append("endSecs", String(gifEndSecs));

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

  const reset = useCallback(() => {
    setJobId(null);
    setPercent(0);
    setDone(false);
    setError(null);
    setMinimized(false);
  }, []);

  const cancelConversion = useCallback(async () => {
    if (!jobId) { reset(); return; }
    try {
      await fetch(`/api/chat/convert/video/cancel?jobId=${jobId}`, { method: "POST" });
    } catch { /* ignore */ }
    reset();
  }, [jobId, reset]);

  const clearFile = useCallback(() => {
    if (jobId && !done) { void cancelConversion(); }
    setFile(null);
    setGifPreviewUrl(null);
    setThumbUrl(null);
    reset();
  }, [jobId, done, cancelConversion, reset]);

  const isRunning = !!jobId && !done;

  useEffect(() => {
    if (!setIsRunningRef) return;
    setIsRunningRef(() => {
      if (!isRunning || !jobId) return null;
      return {
        jobId,
        format,
        fileName: file?.name ?? "video",
        thumbUrl,
        percent,
      };
    });
  }, [setIsRunningRef, isRunning, jobId, format, file, thumbUrl, percent]);

  const handoffMinimize = useCallback(() => {
    if (!isRunning || !jobId || !onHandoff) { setMinimized(true); return; }
    onHandoff({
      jobId,
      format,
      fileName: file?.name ?? "video",
      thumbUrl,
      percent,
    });
  }, [isRunning, jobId, format, file, thumbUrl, percent, onHandoff]);

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
        <DropIcon>
          {file ? "🎬" : <CloudIcon size={30} style={{ color: colors.green }} />}
        </DropIcon>
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
        <Label>Preset</Label>
        <Select value={preset} onChange={(e) => setPreset(e.target.value as typeof preset)} disabled={isRunning}>
          <option value="ultrafast">ultrafast</option>
          <option value="veryfast">veryfast</option>
          <option value="fast">fast</option>
          <option value="medium">medium</option>
          <option value="slow">slow</option>
          <option value="veryslow">veryslow</option>
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

      {format === "gif" && file && videoDuration > 0 && (
        <ControlRow>
          <Label>GIF range</Label>
          <RangeBtn type="button" onClick={() => setGifRangeOpen(true)} disabled={isRunning}>
            {gifStartSecs !== null && gifEndSecs !== null
              ? `${gifStartSecs.toFixed(1)}s – ${gifEndSecs.toFixed(1)}s`
              : "Select range…"}
          </RangeBtn>
          {gifStartSecs !== null && (
            <RangeClearBtn
              type="button"
              onClick={() => { setGifStartSecs(null); setGifEndSecs(null); }}
              title="Clear range"
              disabled={isRunning}
            >
              ✕
            </RangeClearBtn>
          )}
        </ControlRow>
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
          {file && (
            <PreviewClear>
              <NeonX accent="green" size="sm" onClick={clearFile} title="Clear upload" />
            </PreviewClear>
          )}
          {gifPreviewUrl
            ? <PreviewImg src={gifPreviewUrl} alt="gif preview" />
            : <PreviewPlaceholder>{file ? "Generating preview…" : "No video selected"}</PreviewPlaceholder>
          }
        </PreviewBox>
      </PreviewRow>

      {error && <ErrorBox>{error}</ErrorBox>}

      {isRunning && (
        <>
          <ProgressRow>
            <ProgressBar $pct={percent} />
            <ProgressPct>{percent}%</ProgressPct>
            <NeonX accent="green" size="sm" onClick={cancelConversion} title="Cancel conversion" />
          </ProgressRow>
          <ActionBtn onClick={handoffMinimize} $disabled={false}>
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

      {gifRangeOpen && file && videoDuration > 0 && (
        <GifRangeModal
          file={file}
          duration={videoDuration}
          initialStart={gifStartSecs ?? 0}
          initialEnd={gifEndSecs ?? Math.min(videoDuration, 3)}
          onClose={() => setGifRangeOpen(false)}
          onApply={(s, e) => {
            setGifStartSecs(s);
            setGifEndSecs(e);
            setGifRangeOpen(false);
          }}
        />
      )}
    </>
  );
}

// ── GIF range-select modal ──────────────────────────────────────────────────

function GifRangeModal({
  file,
  duration,
  initialStart,
  initialEnd,
  onClose,
  onApply,
}: {
  file: File;
  duration: number;
  initialStart: number;
  initialEnd: number;
  onClose: () => void;
  onApply: (start: number, end: number) => void;
}) {
  useModalLifecycle();
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [scrubTarget, setScrubTarget] = useState<"start" | "end">("start");
  const videoRef = useRef<HTMLVideoElement>(null);
  const urlRef = useRef<string>("");

  useEffect(() => {
    urlRef.current = URL.createObjectURL(file);
    if (videoRef.current) {
      videoRef.current.src = urlRef.current;
      videoRef.current.currentTime = initialStart;
    }
    return () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); };
  }, [file, initialStart]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const t = scrubTarget === "start" ? start : end;
    if (Math.abs(v.currentTime - t) > 0.05) v.currentTime = t;
  }, [start, end, scrubTarget]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopImmediatePropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const maxClip = Math.min(30, duration);
  const clipLen = Math.max(0, end - start);
  const tooLong = clipLen > maxClip;
  const invalid = clipLen <= 0.1 || tooLong;

  return (
    <RangeOverlay onClick={onClose}>
      <RangeModal onClick={(e) => e.stopPropagation()}>
        <RangeHeader>
          <RangeTitle>GIF range</RangeTitle>
          <NeonX accent="green" size="sm" onClick={onClose} title="Close" />
        </RangeHeader>
        <RangeBody>
          <RangeVideo ref={videoRef} muted controls={false} playsInline />
          <RangeScrubRow>
            <RangeScrubLabel>
              Scrubbing: <b>{scrubTarget === "start" ? "start" : "end"}</b> · clip {clipLen.toFixed(2)}s
            </RangeScrubLabel>
            <RangeToggle
              type="button"
              onClick={() => setScrubTarget((t) => (t === "start" ? "end" : "start"))}
            >
              Scrub {scrubTarget === "start" ? "end" : "start"}
            </RangeToggle>
          </RangeScrubRow>
          <RangeSliderRow>
            <RangeSliderLabel>Start {start.toFixed(2)}s</RangeSliderLabel>
            <Slider
              type="range"
              min={0}
              max={duration}
              step={0.05}
              value={start}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setStart(Math.min(v, end - 0.1));
                setScrubTarget("start");
              }}
            />
          </RangeSliderRow>
          <RangeSliderRow>
            <RangeSliderLabel>End {end.toFixed(2)}s</RangeSliderLabel>
            <Slider
              type="range"
              min={0}
              max={duration}
              step={0.05}
              value={end}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setEnd(Math.max(v, start + 0.1));
                setScrubTarget("end");
              }}
            />
          </RangeSliderRow>
          {tooLong && (
            <RangeWarn>Max GIF clip is {maxClip.toFixed(0)}s. Trim to avoid huge files.</RangeWarn>
          )}
          <RangeApplyBtn
            type="button"
            onClick={() => onApply(start, end)}
            disabled={invalid}
            $disabled={invalid}
          >
            Apply range
          </RangeApplyBtn>
        </RangeBody>
      </RangeModal>
    </RangeOverlay>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MediaConverterModal({
  defaultTab = "image",
  onClose,
  onFileConverted,
  onMinimizeConversion,
}: MediaConverterModalProps) {
  useModalLifecycle();
  const [tab, setTab] = useState<"image" | "video">(defaultTab);
  const [helpOpen, setHelpOpen] = useState(false);
  const runningSnapshotRef = useRef<(() => MinimizedConversionInfo | null) | null>(null);

  const tryClose = useCallback(() => {
    if (onMinimizeConversion && runningSnapshotRef.current) {
      const info = runningSnapshotRef.current();
      if (info) { onMinimizeConversion(info); return; }
    }
    onClose();
  }, [onClose, onMinimizeConversion]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      if (helpOpen) setHelpOpen(false);
      else tryClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [tryClose, helpOpen]);

  return (
    <Overlay onClick={(e) => { if (e.target === e.currentTarget) tryClose(); }}>
      <Modal onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
        <ModalHeader>
          <ModalTitle>Media Converter</ModalTitle>
          <QmbmBtn onClick={() => setHelpOpen((v) => !v)} title="What does this do?">?</QmbmBtn>
          <CloseBtn onClick={tryClose} title="Close">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </CloseBtn>
        </ModalHeader>

        <TabBar>
          <Tab $active={tab === "image"} onClick={() => setTab("image")} title="Convert images (webp / jpeg / png / gif)">Image</Tab>
          <Tab $active={tab === "video"} onClick={() => setTab("video")} title="Convert videos (h264 / h265 / vp9 / gif)">Video</Tab>
        </TabBar>

        <Body>
          {tab === "image"
            ? <ImageTab onFileConverted={(f) => { onFileConverted(f); onClose(); }} />
            : <VideoTab
                onFileConverted={(f) => { onFileConverted(f); onClose(); }}
                onHandoff={onMinimizeConversion ? (info) => { onMinimizeConversion(info); onClose(); } : undefined}
                setIsRunningRef={(cb) => { runningSnapshotRef.current = cb; }}
              />
          }
        </Body>

        {helpOpen && <QmbmHelp tab={tab} onClose={() => setHelpOpen(false)} />}
      </Modal>
    </Overlay>
  );
}

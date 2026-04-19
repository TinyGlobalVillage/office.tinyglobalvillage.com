"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { WaveformIcon, StopIcon, CancelIcon, SendIcon } from "./icons";

const MAX_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const BAR_COUNT = 48;
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch { /* ignore */ }
  }
  return "";
}

function fmtDur(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

const Wrap = styled.div<{ $accent: string }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--t-surface);
  border: 1px solid ${(p) => p.$accent}55;
  box-shadow: 0 0 12px ${(p) => p.$accent}33;
`;

const RecDot = styled.span<{ $accent: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${(p) => p.$accent};
  animation: recPulse 1s ease-in-out infinite;

  @keyframes recPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }
`;

const WaveBox = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 28px;
  overflow: hidden;
`;

const Bar = styled.span<{ $h: number; $accent: string }>`
  width: 3px;
  height: ${(p) => Math.max(3, p.$h)}px;
  border-radius: 2px;
  background: ${(p) => p.$accent};
  opacity: 0.85;
  transition: height 80ms linear;
`;

const TimeLabel = styled.span`
  font-size: 0.75rem;
  color: var(--t-text);
  font-variant-numeric: tabular-nums;
  min-width: 42px;
  text-align: right;
`;

const ActionBtn = styled.button<{ $accent?: string; $danger?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid ${(p) => p.$danger ? "rgba(255, 90, 90, 0.5)" : (p.$accent ?? "#4ade80") + "55"};
  background: ${(p) => p.$danger ? "rgba(255, 90, 90, 0.12)" : (p.$accent ?? "#4ade80") + "22"};
  color: ${(p) => p.$danger ? "#ff6b6b" : (p.$accent ?? "#4ade80")};
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.1s;

  &:hover {
    box-shadow: 0 0 10px ${(p) => p.$danger ? "rgba(255, 90, 90, 0.45)" : (p.$accent ?? "#4ade80") + "66"};
  }
  &:active { transform: scale(0.94); }
  &:disabled { opacity: 0.5; cursor: default; box-shadow: none; }
`;

const MicTrigger = styled.button<{ $accent: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border-radius: 0.75rem;
  background: ${(p) => p.$accent}22;
  border: 1px solid ${(p) => p.$accent}55;
  color: ${(p) => p.$accent};
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.1s;

  &:hover { box-shadow: 0 0 8px ${(p) => p.$accent}66; }
  &:active { transform: scale(0.94); }
`;

type Props = {
  accent: string;
  onSend: (blob: Blob, mimeType: string, durationMs: number) => void | Promise<void>;
  disabled?: boolean;
};

export default function VoiceRecorder({ accent, onSend, disabled }: Props) {
  const [state, setState] = useState<"idle" | "recording" | "stopping" | "preview">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(BAR_COUNT).fill(3));
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewMime, setPreviewMime] = useState("");
  const [previewDur, setPreviewDur] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const rafRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    rafRef.current = 0;
    tickRef.current = null;
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
    try { audioCtxRef.current?.close(); } catch { /* ignore */ }
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    if (state !== "idle" || disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || "audio/webm" });
        const dur = Date.now() - startedAtRef.current;
        setPreviewBlob(blob);
        setPreviewMime(rec.mimeType || mime || "audio/webm");
        setPreviewDur(dur);
        setState("preview");
        cleanup();
      };
      rec.start(250);
      startedAtRef.current = Date.now();
      setState("recording");
      setElapsed(0);
      setBars(Array(BAR_COUNT).fill(3));

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const h = Math.min(26, Math.round(3 + rms * 72));
        setBars((prev) => [...prev.slice(1), h]);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      tickRef.current = setInterval(() => {
        const e = Date.now() - startedAtRef.current;
        setElapsed(e);
        if (e >= MAX_DURATION_MS) {
          stopRecording();
        }
      }, 100);
    } catch (err) {
      console.error("[VoiceRecorder] start failed", err);
      cleanup();
      setState("idle");
      alert("Could not access microphone.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, disabled, cleanup]);

  const stopRecording = useCallback(() => {
    if (state !== "recording") return;
    setState("stopping");
    try { recorderRef.current?.stop(); } catch { /* ignore */ }
  }, [state]);

  const cancel = useCallback(() => {
    try { recorderRef.current?.stop(); } catch { /* ignore */ }
    cleanup();
    chunksRef.current = [];
    setPreviewBlob(null);
    setPreviewMime("");
    setPreviewDur(0);
    setState("idle");
  }, [cleanup]);

  const sendPreview = useCallback(async () => {
    if (!previewBlob) return;
    await onSend(previewBlob, previewMime, previewDur);
    setPreviewBlob(null);
    setPreviewMime("");
    setPreviewDur(0);
    setState("idle");
  }, [previewBlob, previewMime, previewDur, onSend]);

  if (state === "idle") {
    return (
      <MicTrigger
        type="button"
        $accent={accent}
        onClick={startRecording}
        disabled={disabled}
        title="Record voice memo"
      >
        <WaveformIcon size={16} />
      </MicTrigger>
    );
  }

  return (
    <Wrap $accent={accent}>
      <RecDot $accent={accent} />
      <WaveBox>
        {bars.map((h, i) => (
          <Bar key={i} $h={h} $accent={accent} />
        ))}
      </WaveBox>
      <TimeLabel>{fmtDur(elapsed || previewDur)}</TimeLabel>
      <ActionBtn $danger onClick={cancel} title="Cancel" type="button">
        <CancelIcon size={14} />
      </ActionBtn>
      {state === "recording" && (
        <ActionBtn $accent={accent} onClick={stopRecording} title="Stop" type="button">
          <StopIcon size={14} />
        </ActionBtn>
      )}
      {state === "preview" && (
        <ActionBtn $accent={accent} onClick={sendPreview} title="Send voice memo" type="button">
          <SendIcon size={14} />
        </ActionBtn>
      )}
    </Wrap>
  );
}

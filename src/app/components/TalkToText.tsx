"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import styled from "styled-components";
import { MicIcon, StopIcon } from "./icons";

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
];

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of MIME_CANDIDATES) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch { /* ignore */ }
  }
  return "";
}

type SRResult = { transcript: string };
type SRResultEntry = { [index: number]: SRResult; isFinal: boolean };
type SREvent = { resultIndex: number; results: ArrayLike<SRResultEntry> };
type SRInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SRCtor = new () => SRInstance;

function getSpeechRecognitionCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const Btn = styled.button<{ $accent: string; $active: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border-radius: 0.75rem;
  background: ${(p) => p.$active ? p.$accent + "33" : p.$accent + "14"};
  border: 1px solid ${(p) => p.$active ? p.$accent : p.$accent + "55"};
  color: ${(p) => p.$accent};
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.1s;
  position: relative;

  &:hover { box-shadow: 0 0 8px ${(p) => p.$accent}66; }
  &:active { transform: scale(0.94); }
  &:disabled { opacity: 0.5; cursor: default; }

  ${(p) => p.$active && `
    &::after {
      content: "";
      position: absolute;
      inset: -2px;
      border-radius: inherit;
      border: 1px solid ${p.$accent}aa;
      animation: ttt-pulse 1.2s ease-in-out infinite;
    }

    @keyframes ttt-pulse {
      0%, 100% { transform: scale(1); opacity: 0.8; }
      50% { transform: scale(1.12); opacity: 0.2; }
    }
  `}
`;

type Props = {
  accent: string;
  model: string;
  onTranscript: (text: string) => void;
  onError?: (msg: string) => void;
  onActiveChange?: (active: boolean) => void;
  disabled?: boolean;
};

export default function TalkToText({ accent, model, onTranscript, onError, onActiveChange, disabled }: Props) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");

  useEffect(() => {
    onActiveChange?.(state !== "idle");
  }, [state, onActiveChange]);

  // SpeechRecognition (primary, streaming)
  const recognitionRef = useRef<SRInstance | null>(null);
  const deliveredRef = useRef<string>("");

  // MediaRecorder fallback (whisper-cli)
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const stopSR = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  const stopFallback = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try { rec.stop(); } catch { /* ignore */ }
    }
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
  }, []);

  useEffect(() => () => { stopSR(); stopFallback(); }, [stopSR, stopFallback]);

  const startSR = useCallback((Ctor: SRCtor) => {
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    recognitionRef.current = rec;
    deliveredRef.current = "";

    rec.onresult = (event) => {
      // Only emit finalised segments so the composer doesn't see duplicate
      // interim text. Finals arrive roughly when the speaker pauses.
      let finalDelta = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const entry = event.results[i];
        if (entry.isFinal) finalDelta += entry[0].transcript;
      }
      const trimmed = finalDelta.trim();
      if (trimmed) {
        deliveredRef.current = (deliveredRef.current + " " + trimmed).trim();
        onTranscript(trimmed);
      }
    };
    rec.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        onError?.(`Speech: ${e.error}`);
      }
    };
    rec.onend = () => {
      setState("idle");
      recognitionRef.current = null;
    };
    try {
      rec.start();
      setState("recording");
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Speech start failed");
      setState("idle");
      recognitionRef.current = null;
    }
  }, [onTranscript, onError]);

  const startFallback = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        setState("transcribing");
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || "audio/webm" });
        chunksRef.current = [];
        try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
        streamRef.current = null;
        try {
          const fd = new FormData();
          const ext = (rec.mimeType || mime || "webm").includes("ogg") ? "ogg" : "webm";
          fd.append("audio", new File([blob], `stt.${ext}`, { type: rec.mimeType || mime || "audio/webm" }));
          fd.append("model", model);
          const res = await fetch("/api/chat/transcribe", { method: "POST", body: fd });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) onError?.(data.error ?? `Transcribe failed (HTTP ${res.status})`);
          else if (data.text) onTranscript(data.text);
        } catch (e) {
          onError?.(e instanceof Error ? e.message : "Transcription error");
        } finally {
          setState("idle");
        }
      };
      rec.start(250);
      setState("recording");
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Mic access denied");
      setState("idle");
    }
  }, [model, onTranscript, onError]);

  const start = useCallback(async () => {
    if (state !== "idle" || disabled) return;
    const SR = getSpeechRecognitionCtor();
    if (SR) startSR(SR);
    else await startFallback();
  }, [state, disabled, startSR, startFallback]);

  const stop = useCallback(() => {
    if (recognitionRef.current) stopSR();
    else stopFallback();
  }, [stopSR, stopFallback]);

  const toggle = useCallback(() => {
    if (state === "recording") stop();
    else if (state === "idle") start();
  }, [state, start, stop]);

  const title =
    state === "recording" ? "Stop & transcribe"
    : state === "transcribing" ? "Transcribing…"
    : "Talk to text";

  return (
    <Btn
      type="button"
      $accent={accent}
      $active={state === "recording"}
      onClick={toggle}
      disabled={disabled || state === "transcribing"}
      title={title}
    >
      {state === "recording" ? <StopIcon size={14} /> : <MicIcon size={16} />}
    </Btn>
  );
}

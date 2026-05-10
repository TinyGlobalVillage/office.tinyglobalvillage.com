"use client";

/**
 * Voicemail section for the Front Desk SystemToolsModal.
 *
 * Two controls:
 *   1. Auto-route-to-voicemail toggle — sets `office/voicemail_mode` in
 *      FreeSWITCH mod_db ("always" vs "fallback"). The dialplan reads it
 *      at the start of every inbound call.
 *   2. Greeting record/playback — uses MediaRecorder to capture the user's
 *      voice in the browser, converts to WAV, uploads to the API, which
 *      stores the file at telephony/data/voicemails/greeting.wav.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";

type Mode = "fallback" | "always";

// ── Styled ───────────────────────────────────────────────────────

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`;

const Label = styled.div`
  font-size: 0.85rem;
  color: var(--t-text);
`;

const Hint = styled.div`
  font-size: 0.7rem;
  color: var(--t-textGhost);
  margin-top: 0.2rem;
`;

const ToggleTrack = styled.button<{ $on: boolean }>`
  appearance: none;
  border: none;
  cursor: pointer;
  width: 38px;
  height: 20px;
  border-radius: 10px;
  position: relative;
  background: ${({ $on }) =>
    $on
      ? `linear-gradient(90deg, rgba(${rgb.cyan}, 0.3), rgba(${rgb.cyan}, 0.15))`
      : "rgba(120,120,120,0.25)"};
  box-shadow: ${({ $on }) =>
    $on
      ? `inset 0 0 6px rgba(${rgb.cyan}, 0.15), 0 0 8px rgba(${rgb.cyan}, 0.1)`
      : "inset 0 1px 3px rgba(0,0,0,0.2)"};
  transition: background 0.25s ease;
  flex-shrink: 0;
`;

const ToggleKnob = styled.div<{ $on: boolean }>`
  position: absolute;
  top: 2px;
  left: ${({ $on }) => ($on ? "20px" : "2px")};
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: ${({ $on }) => ($on ? colors.cyan : "#888")};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  transition: left 0.2s ease, background 0.25s ease;
`;

const Btn = styled.button<{ $variant?: "primary" | "danger" | "ghost" }>`
  appearance: none;
  border: 1px solid
    ${({ $variant }) =>
      $variant === "danger"
        ? `rgba(${rgb.pink}, 0.4)`
        : $variant === "primary"
          ? `rgba(${rgb.cyan}, 0.4)`
          : "rgba(255,255,255,0.15)"};
  background: ${({ $variant }) =>
    $variant === "danger"
      ? `rgba(${rgb.pink}, 0.08)`
      : $variant === "primary"
        ? `rgba(${rgb.cyan}, 0.08)`
        : "transparent"};
  color: ${({ $variant }) =>
    $variant === "danger" ? colors.pink : $variant === "primary" ? colors.cyan : "var(--t-text)"};
  border-radius: 6px;
  padding: 0.4rem 0.7rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.15s ease;
  &:hover:not(:disabled) {
    background: ${({ $variant }) =>
      $variant === "danger"
        ? `rgba(${rgb.pink}, 0.16)`
        : $variant === "primary"
          ? `rgba(${rgb.cyan}, 0.16)`
          : "rgba(255,255,255,0.06)"};
  }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const Status = styled.div<{ $tone?: "ok" | "err" | "rec" }>`
  font-size: 0.7rem;
  color: ${({ $tone }) =>
    $tone === "err" ? colors.pink : $tone === "rec" ? colors.pink : $tone === "ok" ? colors.cyan : "var(--t-textGhost)"};
`;

// ── Component ────────────────────────────────────────────────────

export default function VoicemailSection() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [modeBusy, setModeBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [hasGreeting, setHasGreeting] = useState<boolean | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [statusTone, setStatusTone] = useState<"ok" | "err" | "rec" | undefined>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Initial load: settings + check greeting existence.
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/frontdesk/voicemail/settings");
        if (r.ok) {
          const j = (await r.json()) as { mode: Mode };
          setMode(j.mode);
        }
      } catch {
        /* ignore */
      }
      try {
        const r2 = await fetch("/api/frontdesk/voicemail/greeting", { method: "HEAD" });
        setHasGreeting(r2.ok);
      } catch {
        setHasGreeting(false);
      }
    })();
  }, []);

  const flipMode = useCallback(async (next: Mode) => {
    setModeBusy(true);
    try {
      const r = await fetch("/api/frontdesk/voicemail/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      setMode(next);
      setStatus(next === "always" ? "All inbound calls now route to voicemail." : "Inbound calls ring the softphone first.");
      setStatusTone("ok");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
      setStatusTone("err");
    } finally {
      setModeBusy(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    setStatus("");
    setStatusTone(undefined);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // MediaRecorder records as webm/ogg in browsers, NOT as WAV. We get
      // a webm blob, then convert to WAV via the AudioContext below.
      const rec = new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const webmBlob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        try {
          const wavBlob = await webmToWav(webmBlob);
          setRecordedBlob(wavBlob);
          setRecordedUrl(URL.createObjectURL(wavBlob));
          setStatus("Recorded — preview, then save or re-record.");
          setStatusTone("ok");
        } catch (err) {
          setStatus("Conversion failed: " + (err instanceof Error ? err.message : String(err)));
          setStatusTone("err");
        }
      };
      rec.start();
      setRecording(true);
      setStatus("Recording… click Stop when done.");
      setStatusTone("rec");
    } catch (err) {
      setStatus("Mic access denied: " + (err instanceof Error ? err.message : String(err)));
      setStatusTone("err");
    }
  }, [recordedUrl]);

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }, []);

  const saveGreeting = useCallback(async () => {
    if (!recordedBlob) return;
    setStatus("Uploading…");
    setStatusTone(undefined);
    try {
      const r = await fetch("/api/frontdesk/voicemail/greeting", {
        method: "POST",
        headers: { "Content-Type": "audio/wav" },
        body: recordedBlob,
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Upload failed");
      setStatus("Greeting saved — callers will hear this on no-answer.");
      setStatusTone("ok");
      setHasGreeting(true);
      setRecordedBlob(null);
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
        setRecordedUrl(null);
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
      setStatusTone("err");
    }
  }, [recordedBlob, recordedUrl]);

  const deleteGreeting = useCallback(async () => {
    if (!confirm("Delete the saved greeting? Callers will hear the default message.")) return;
    try {
      const r = await fetch("/api/frontdesk/voicemail/greeting", { method: "DELETE" });
      if (!r.ok) throw new Error("Delete failed");
      setHasGreeting(false);
      setStatus("Greeting deleted — default will play.");
      setStatusTone("ok");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
      setStatusTone("err");
    }
  }, []);

  return (
    <Wrap>
      <Row>
        <div>
          <Label>Auto-route every call to voicemail</Label>
          <Hint>
            On = skip ring, every caller goes to voicemail.
            Off = ring softphone first, voicemail kicks in on no-answer.
          </Hint>
        </div>
        <ToggleTrack
          type="button"
          $on={mode === "always"}
          aria-pressed={mode === "always"}
          aria-label="Auto-route to voicemail"
          disabled={modeBusy || mode === null}
          onClick={() => flipMode(mode === "always" ? "fallback" : "always")}
        >
          <ToggleKnob $on={mode === "always"} />
        </ToggleTrack>
      </Row>

      <Row>
        <div>
          <Label>Voicemail greeting</Label>
          <Hint>
            {hasGreeting === null
              ? "Checking…"
              : hasGreeting
                ? "Custom greeting saved."
                : "No custom greeting — callers hear the default."}
          </Hint>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {!recording && !recordedBlob && (
            <>
              {hasGreeting && (
                <audio
                  controls
                  src={`/api/frontdesk/voicemail/greeting?t=${hasGreeting ? Date.now() : 0}`}
                  style={{ height: "32px" }}
                />
              )}
              <Btn $variant="primary" onClick={startRecording}>
                {hasGreeting ? "Re-record" : "Record"}
              </Btn>
              {hasGreeting && (
                <Btn $variant="danger" onClick={deleteGreeting}>Delete</Btn>
              )}
            </>
          )}
          {recording && (
            <Btn $variant="danger" onClick={stopRecording}>● Stop</Btn>
          )}
          {!recording && recordedBlob && recordedUrl && (
            <>
              <audio controls src={recordedUrl} style={{ height: "32px" }} />
              <Btn $variant="primary" onClick={saveGreeting}>Save</Btn>
              <Btn onClick={startRecording}>Redo</Btn>
            </>
          )}
        </div>
      </Row>

      {status && <Status $tone={statusTone}>{status}</Status>}
    </Wrap>
  );
}

// ── webm → WAV converter ────────────────────────────────────────
// AudioContext can decode webm/opus; we re-encode the PCM samples as a
// 16-bit mono 8 kHz WAV (the format FreeSWITCH plays back natively).

async function webmToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  const ctx = new AC();
  const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));

  // Downsample to 8 kHz mono — the rate FreeSWITCH dialplans default to.
  const targetRate = 8000;
  const offline = new (window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext)(
    1,
    Math.ceil(decoded.duration * targetRate),
    targetRate
  );
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();

  // Encode AudioBuffer → 16-bit PCM WAV.
  const numChannels = 1;
  const samples = rendered.getChannelData(0);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  let off = 0;
  function writeStr(s: string) { for (let i = 0; i < s.length; i++) view.setUint8(off++, s.charCodeAt(i)); }
  function writeU32(v: number) { view.setUint32(off, v, true); off += 4; }
  function writeU16(v: number) { view.setUint16(off, v, true); off += 2; }

  writeStr("RIFF");
  writeU32(36 + samples.length * 2);
  writeStr("WAVE");
  writeStr("fmt ");
  writeU32(16);
  writeU16(1); // PCM
  writeU16(numChannels);
  writeU32(targetRate);
  writeU32(targetRate * numChannels * 2);
  writeU16(numChannels * 2);
  writeU16(16);
  writeStr("data");
  writeU32(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }

  await ctx.close();
  return new Blob([buffer], { type: "audio/wav" });
}

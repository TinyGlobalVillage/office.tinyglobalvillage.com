"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { PlayIcon, PauseIcon } from "./icons";

const BAR_COUNT = 36;

// Deterministic pseudo-waveform derived from the file URL. Real peak extraction
// would require decoding the whole file in-browser; this keeps the UI snappy
// for every playback without a network hit.
function pseudoWaveform(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bars: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    const n = Math.abs(h) % 100;
    bars.push(6 + (n / 100) * 18);
  }
  return bars;
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const Wrap = styled.div<{ $accent: string }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 6px 10px;
  border-radius: 12px;
  background: ${(p) => p.$accent}14;
  border: 1px solid ${(p) => p.$accent}44;
  max-width: 280px;
`;

const PlayBtn = styled.button<{ $accent: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: ${(p) => p.$accent};
  color: #0a0a0a;
  cursor: pointer;
  flex-shrink: 0;

  &:hover { box-shadow: 0 0 10px ${(p) => p.$accent}88; }
  &:active { transform: scale(0.94); }
`;

const WaveTrack = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 26px;
  cursor: pointer;
  position: relative;
`;

const Bar = styled.span<{ $h: number; $active: boolean; $accent: string }>`
  width: 3px;
  height: ${(p) => p.$h}px;
  border-radius: 2px;
  background: ${(p) => (p.$active ? p.$accent : "var(--t-textFaint)")};
  opacity: ${(p) => (p.$active ? 1 : 0.55)};
  transition: background 80ms linear;
`;

const Time = styled.span`
  font-size: 0.6875rem;
  color: var(--t-textMuted);
  font-variant-numeric: tabular-nums;
  min-width: 34px;
  text-align: right;
`;

type Props = {
  url: string;
  accent?: string;
};

export default function VoicePlayer({ url, accent = "#4ade80" }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const bars = useMemo(() => pseudoWaveform(url), [url]);

  useEffect(() => {
    const audio = new Audio(url);
    audio.preload = "metadata";
    audioRef.current = audio;
    const onLoaded = () => setDuration(audio.duration || 0);
    const onTime = () => setCurrent(audio.currentTime || 0);
    const onEnd = () => { setPlaying(false); setCurrent(0); };
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audioRef.current = null;
    };
  }, [url]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, [playing]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * duration;
    setCurrent(a.currentTime);
  }, [duration]);

  const progress = duration > 0 ? current / duration : 0;
  const activeIdx = Math.floor(progress * BAR_COUNT);

  return (
    <Wrap $accent={accent}>
      <PlayBtn $accent={accent} onClick={toggle} title={playing ? "Pause" : "Play"}>
        {playing ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
      </PlayBtn>
      <WaveTrack onClick={seek}>
        {bars.map((h, i) => (
          <Bar key={i} $h={h} $active={i <= activeIdx} $accent={accent} />
        ))}
      </WaveTrack>
      <Time>{fmtTime(duration - current || duration || 0)}</Time>
    </Wrap>
  );
}

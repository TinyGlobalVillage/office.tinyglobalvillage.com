"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import styled from "styled-components";
import { getAvPrimed, primeAvPermission } from "@tgv/module-video-calls/meetings/av/avPermission";
import useCallToken from "./useCallToken";
import "@livekit/components-styles";

const LiveKitRoom = dynamic(
  () => import("@livekit/components-react").then(m => m.LiveKitRoom),
  { ssr: false }
);
const VideoConference = dynamic(
  () => import("@livekit/components-react").then(m => m.VideoConference),
  { ssr: false }
);

export type CallSurfaceProps = {
  room: string;
  mode?: "active" | "observer";
  layout?: "full" | "strip";
  /** Initial camera publish state. Defaults to false when mode="observer", true otherwise. */
  video?: boolean;
  onLeave?: () => void;
  children?: React.ReactNode;
};

const Wrap = styled.div<{ $layout: "full" | "strip" }>`
  overflow: hidden;
  position: relative;
  display: flex;

  ${p => p.$layout === "full"
    ? `flex: 1; min-height: 0;`
    : `flex: 0 0 12rem; min-height: 4.5rem;`}

  --lk-bg: var(--t-bg);
  --lk-fg: var(--t-text);

  /* LiveKit's stock control bar picks icon+label vs icon-only off the WINDOW
     width (760px media query), not this pane — inside a drawer the labels
     overflow and clip (mic/camera pushed out of view). Make the pane a size
     container: wrapping is the floor so every control stays reachable at any
     width, and under 36rem the labels drop to icon-only. Each label is a text
     node beside the button's svg, so zeroing font-size hides it without
     touching icon geometry — except StartAudio (autoplay unlock), which is
     text-ONLY and would turn into an empty pill. */
  container-type: inline-size;

  .lk-control-bar {
    flex-wrap: wrap;
    justify-content: center;
    row-gap: 0.25rem;
  }

  @container (max-width: 36rem) {
    .lk-control-bar .lk-button:not(.lk-start-audio-button) {
      font-size: 0;
      gap: 0;
    }
  }
`;

const StatusPad = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  font-size: 0.8125rem;
  color: var(--t-textMuted);
  text-align: center;
`;

const ErrorPad = styled(StatusPad)`
  color: #f87171;
`;

const FriendlyError: Record<string, string> = {
  banned:       "You were removed from this room and can't rejoin.",
  full:         "This room is full.",
  forbidden:    "You don't have access to this room.",
  "not-found":  "That room no longer exists.",
  unauthorized: "Sign in to join this call.",
  server:       "Call server unavailable — try again in a moment.",
  unknown:      "Couldn't connect to the call.",
};

export default function CallSurface({
  room,
  mode = "active",
  layout = "full",
  video,
  onLeave,
  children,
}: CallSurfaceProps) {
  const { token, url, error, loading } = useCallToken(room);
  const observer = mode === "observer";
  const initialVideo = video ?? !observer;
  const initialAudio = !observer;

  // Meet's av primer (one getUserMedia({audio,video}) = ONE browser prompt).
  // Hold connect until it settles so LiveKit's per-device acquisition lands on
  // an already-answered permission instead of prompting mic and camera
  // separately. Observers publish nothing at join; priming re-runs on the flip
  // to active so the in-room toggles can't double-prompt later either.
  const [avSettled, setAvSettled] = useState(() => getAvPrimed());
  useEffect(() => {
    if (observer || getAvPrimed()) {
      setAvSettled(true);
      return;
    }
    let alive = true;
    void primeAvPermission().finally(() => { if (alive) setAvSettled(true); });
    return () => { alive = false; };
  }, [observer]);

  const body = useMemo(() => {
    if (error) {
      return <ErrorPad>✕ {FriendlyError[error.code] ?? error.message}</ErrorPad>;
    }
    if (loading || !token || !url) {
      return <StatusPad>Connecting…</StatusPad>;
    }
    if (!avSettled) {
      return <StatusPad>Waiting for camera &amp; microphone permission…</StatusPad>;
    }
    return (
      <LiveKitRoom
        serverUrl={url}
        token={token}
        connect
        video={initialVideo}
        audio={initialAudio}
        onDisconnected={onLeave}
        style={{ height: "100%", width: "100%" }}
      >
        <VideoConference />
        {children}
      </LiveKitRoom>
    );
  }, [token, url, error, loading, avSettled, initialVideo, initialAudio, onLeave, children]);

  return <Wrap $layout={layout} data-call-room={room}>{body}</Wrap>;
}

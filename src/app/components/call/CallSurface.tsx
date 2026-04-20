"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import styled from "styled-components";
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

  const body = useMemo(() => {
    if (error) {
      return <ErrorPad>✕ {FriendlyError[error.code] ?? error.message}</ErrorPad>;
    }
    if (loading || !token || !url) {
      return <StatusPad>Connecting…</StatusPad>;
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
  }, [token, url, error, loading, initialVideo, initialAudio, onLeave, children]);

  return <Wrap $layout={layout} data-call-room={room}>{body}</Wrap>;
}

"use client";

import styled, { css } from "styled-components";
import { colors, rgb, type GlowColor } from "../../theme";
import { PhoneIcon, VideoIcon, MicIcon, StopIcon } from "../icons";

type Variant = "call" | "video" | "mute-mic" | "mute-cam" | "leave";
type Accent = "green" | "pink" | "cyan" | "red" | "violet" | "gold" | "orange";

export type CallButtonProps = {
  variant: Variant;
  accent?: Accent;
  size?: "sm" | "md";
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
};

const accentMix = (accent: Accent) => {
  const color = colors[accent as GlowColor];
  const trio = rgb[accent as GlowColor];
  return css`
    background: rgba(${trio}, 0.14);
    border-color: rgba(${trio}, 0.45);
    color: ${color};
    text-shadow: 0 0 6px rgba(${trio}, 0.7);

    &:hover:not(:disabled) {
      background: rgba(${trio}, 0.28);
      box-shadow: 0 0 10px rgba(${trio}, 0.5);
    }

    [data-theme="light"] & { text-shadow: none; }
  `;
};

const Btn = styled.button<{ $accent: Accent; $size: "sm" | "md"; $active: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
  line-height: 1;
  padding: 0;

  width:  ${p => p.$size === "sm" ? "1.75rem" : "2.125rem"};
  height: ${p => p.$size === "sm" ? "1.75rem" : "2.125rem"};

  ${p => accentMix(p.$accent)}

  ${p => p.$active && css`
    box-shadow: 0 0 10px rgba(${rgb[p.$accent as GlowColor]}, 0.45);
  `}

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  svg {
    width: ${p => p.$size === "sm" ? 13 : 15}px;
    height: ${p => p.$size === "sm" ? 13 : 15}px;
  }
`;

export default function CallButton({
  variant,
  accent,
  size = "md",
  active = false,
  disabled = false,
  onClick,
  title,
}: CallButtonProps) {
  const defaultAccent: Accent =
    variant === "leave" ? "red" :
    (variant === "mute-mic" || variant === "mute-cam") ? (active ? "red" : "green") :
    "green";
  const resolvedAccent = accent ?? defaultAccent;

  const icon =
    variant === "call"     ? <PhoneIcon /> :
    variant === "video"    ? <VideoIcon /> :
    variant === "mute-mic" ? (active ? <StopIcon /> : <MicIcon />) :
    variant === "mute-cam" ? (active ? <StopIcon /> : <VideoIcon />) :
    variant === "leave"    ? <PhoneIcon /> :
    null;

  return (
    <Btn
      type="button"
      $accent={resolvedAccent}
      $size={size}
      $active={active}
      disabled={disabled}
      onClick={onClick}
      title={title ?? variant}
    >
      {icon}
    </Btn>
  );
}

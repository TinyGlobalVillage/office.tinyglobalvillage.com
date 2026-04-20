"use client";

import styled, { css } from "styled-components";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { colors, rgb, type GlowColor } from "../theme";

type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  accent?: GlowColor;
  color?: string;
  size?: Size | "row";
  children?: ReactNode;
};

const dims: Record<"sm" | "md" | "lg" | "row", { box: string; font: string; radius: string }> = {
  sm:  { box: "1.5rem",   font: "0.8125rem", radius: "0.375rem" },
  md:  { box: "2.125rem", font: "1.0625rem", radius: "0.5rem"   },
  lg:  { box: "2.75rem",  font: "1.25rem",   radius: "0.625rem" },
  row: { box: "2rem",     font: "0.9375rem", radius: "0.5rem"   },
};

const Btn = styled.button<{ $accent: GlowColor; $color?: string; $size: "sm" | "md" | "lg" | "row" }>`
  ${(p) => {
    const d = dims[p.$size];
    return css`
      width: ${d.box};
      height: ${d.box};
      font-size: ${d.font};
      border-radius: ${d.radius};
    `;
  }}
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

  ${(p) => p.$color
    ? css`
        background: color-mix(in srgb, ${p.$color} 14%, transparent);
        border: 1px solid color-mix(in srgb, ${p.$color} 45%, transparent);
        color: ${p.$color};
      `
    : css`
        background: rgba(${rgb[p.$accent]}, 0.14);
        border: 1px solid rgba(${rgb[p.$accent]}, 0.45);
        color: ${colors[p.$accent]};
        text-shadow: 0 0 6px rgba(${rgb[p.$accent]}, 0.7);
      `}

  &:hover:not(:disabled) {
    ${(p) => p.$color
      ? css`
          background: color-mix(in srgb, ${p.$color} 28%, transparent);
          box-shadow: 0 0 10px color-mix(in srgb, ${p.$color} 50%, transparent);
        `
      : css`
          background: rgba(${rgb[p.$accent]}, 0.28);
          box-shadow: 0 0 10px rgba(${rgb[p.$accent]}, 0.5);
        `}
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  [data-theme="light"] & {
    text-shadow: none;
  }

  @media (max-width: 768px) {
    ${(p) =>
      p.$size === "md" &&
      css`
        width: 2.75rem;
        height: 2.75rem;
        font-size: 1.1875rem;
        border-radius: 0.625rem;
      `}
  }
`;

export default function NeonX({
  accent = "pink",
  color,
  size = "md",
  title = "Close",
  "aria-label": ariaLabel,
  children,
  ...rest
}: Props) {
  return (
    <Btn
      type="button"
      $accent={accent}
      $color={color}
      $size={size}
      title={title}
      aria-label={ariaLabel ?? title}
      {...rest}
    >
      {children ?? "\u2715"}
    </Btn>
  );
}

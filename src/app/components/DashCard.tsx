import type { ReactNode } from "react";
import styled from "styled-components";
import { colors, rgb, type GlowColor } from "@/app/theme";

interface DashCardProps {
  title: string;
  subtitle?: string;
  glow?: GlowColor;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

const Card = styled.div<{ $glow: GlowColor }>`
  border-radius: 1rem;
  padding: 1.5rem;
  cursor: pointer;
  height: 100%;
  background: rgba(${(p) => rgb[p.$glow]}, 0.04);
  border: 1px solid rgba(${(p) => rgb[p.$glow]}, 0.15);
  box-shadow: 0 0 24px rgba(${(p) => rgb[p.$glow]}, 0.08);
  transition: box-shadow 0.2s, background 0.2s;

  &:hover {
    background: rgba(${(p) => rgb[p.$glow]}, 0.08);
    box-shadow: 0 0 32px rgba(${(p) => rgb[p.$glow]}, 0.15);
  }

  [data-theme="light"] & {
    background: rgba(${(p) => rgb[p.$glow]}, 0.03);
    border-color: rgba(${(p) => rgb[p.$glow]}, 0.1);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);

    &:hover {
      background: rgba(${(p) => rgb[p.$glow]}, 0.06);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }
  }
`;

const Title = styled.h3<{ $glow: GlowColor }>`
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin: 0 0 0.25rem;
  color: ${(p) => colors[p.$glow]};
`;

const Subtitle = styled.p`
  font-size: 0.75rem;
  color: var(--t-textMuted);
  margin: 0 0 1rem;
`;

export default function DashCard({
  title,
  subtitle,
  glow = "cyan",
  children,
  className = "",
  onClick,
  style,
}: DashCardProps) {
  return (
    <Card $glow={glow} className={className} onClick={onClick} style={style}>
      <Title $glow={glow}>{title}</Title>
      {subtitle && <Subtitle>{subtitle}</Subtitle>}
      {children}
    </Card>
  );
}

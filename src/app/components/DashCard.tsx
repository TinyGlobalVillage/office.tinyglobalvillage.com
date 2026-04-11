import type { ReactNode } from "react";

type GlowColor = "pink" | "cyan" | "gold";

interface DashCardProps {
  title: string;
  subtitle?: string;
  glow?: GlowColor;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function DashCard({
  title,
  subtitle,
  glow = "cyan",
  children,
  className = "",
  onClick,
}: DashCardProps) {
  return (
    <div
      className={`card-tgv glow-${glow} p-6 cursor-pointer ${className}`}
      onClick={onClick}
    >
      <h3
        className="text-sm font-bold uppercase tracking-widest mb-1"
        style={{
          color:
            glow === "pink"
              ? "#ff4ecb"
              : glow === "gold"
              ? "#f7b700"
              : "#00bfff",
        }}
      >
        {title}
      </h3>
      {subtitle && (
        <p className="text-xs text-white/50 mb-4">{subtitle}</p>
      )}
      {children}
    </div>
  );
}

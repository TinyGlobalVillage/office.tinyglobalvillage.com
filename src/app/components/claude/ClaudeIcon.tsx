type Props = {
  size?: number;
  color?: string;
};

export default function ClaudeIcon({ size = 28, color = "#d97757" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Claude"
    >
      {/* Stylized 8-point starburst — Anthropic-inspired mark */}
      <g fill={color}>
        <path d="M16 2 L17.4 13.2 L16 14.6 L14.6 13.2 Z" />
        <path d="M30 16 L18.8 17.4 L17.4 16 L18.8 14.6 Z" />
        <path d="M16 30 L14.6 18.8 L16 17.4 L17.4 18.8 Z" />
        <path d="M2 16 L13.2 14.6 L14.6 16 L13.2 17.4 Z" />
        <path d="M25.9 6.1 L19 14 L17 14 L18 12 Z" opacity="0.85" />
        <path d="M25.9 25.9 L18 19 L18 17 L20 18 Z" opacity="0.85" />
        <path d="M6.1 25.9 L13 18 L15 18 L14 20 Z" opacity="0.85" />
        <path d="M6.1 6.1 L14 13 L14 15 L12 14 Z" opacity="0.85" />
        <circle cx="16" cy="16" r="2.4" />
      </g>
    </svg>
  );
}

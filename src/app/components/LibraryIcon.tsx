"use client";

export default function LibraryIcon({ size = 28, color = "#a78bfa" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Stacked books — three spines */}
      <rect x="5" y="6" width="5" height="20" rx="1" stroke={color} strokeWidth="1.6" />
      <rect x="11" y="9" width="5" height="17" rx="1" stroke={color} strokeWidth="1.6" fill={color} fillOpacity="0.18" />
      <rect x="17" y="4" width="5" height="22" rx="1" stroke={color} strokeWidth="1.6" />
      {/* Tilted book leaning at the end */}
      <g transform="rotate(12 26 16)">
        <rect x="23.5" y="8" width="5" height="18" rx="1" stroke={color} strokeWidth="1.6" fill={color} fillOpacity="0.35" />
      </g>
      {/* Shelf line */}
      <line x1="3" y1="27" x2="29" y2="27" stroke={color} strokeWidth="1.4" opacity="0.6" />
    </svg>
  );
}

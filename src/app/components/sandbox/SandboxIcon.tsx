"use client";

export default function SandboxIcon({ size = 28, color = "#ff4ecb" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Sandbox / play-pen visual: dotted frame with interactive squares */}
      <rect x="3" y="3" width="26" height="26" rx="4" stroke={color} strokeWidth="1.6" strokeDasharray="3 2" opacity="0.55" />
      <rect x="8" y="8" width="7" height="7" rx="1.5" fill={color} opacity="0.85" />
      <rect x="17" y="8" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.4" />
      <rect x="8" y="17" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.4" />
      <rect x="17" y="17" width="7" height="7" rx="1.5" fill={color} opacity="0.45" />
    </svg>
  );
}

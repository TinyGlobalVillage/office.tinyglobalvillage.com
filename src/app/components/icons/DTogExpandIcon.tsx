import { SVGProps } from "react";

export default function DTogExpandIcon({
  side,
  size = 16,
  ...rest
}: { side: "left" | "right"; size?: number } & SVGProps<SVGSVGElement>) {
  const pts = side === "left" ? "17,8 17,18 22,13" : "7,8 7,18 2,13";
  const barX = side === "left" ? 2 : 11;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <rect x="2" y="4" width="20" height="2" rx="1" />
      <rect x={barX} y="10" width="11" height="2" rx="1" />
      <rect x={barX} y="14" width="11" height="2" rx="1" />
      <rect x="2" y="20" width="20" height="2" rx="1" />
      <polygon points={pts} />
    </svg>
  );
}

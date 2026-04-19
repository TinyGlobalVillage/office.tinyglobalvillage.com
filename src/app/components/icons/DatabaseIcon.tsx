import { SVGProps } from "react";

export default function DatabaseIcon({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <ellipse cx="12" cy="5" rx="8" ry="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M4 5v7c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 12v7c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

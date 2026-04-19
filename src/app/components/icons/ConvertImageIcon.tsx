import { SVGProps } from "react";

export default function ConvertImageIcon({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <rect x="3" y="5" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="7.5" cy="9.5" r="1.25" fill="currentColor" />
      <path d="M17 13l-4-4-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 19h6M18 16l3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

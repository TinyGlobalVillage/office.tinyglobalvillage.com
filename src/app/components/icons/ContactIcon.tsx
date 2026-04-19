import { SVGProps } from "react";

export default function ContactIcon({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="11" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M7 17.5c.8-2 2.8-3 5-3s4.2 1 5 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

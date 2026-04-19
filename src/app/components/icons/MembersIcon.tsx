import { SVGProps } from "react";

export default function MembersIcon({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <circle cx="12" cy="7" r="3" />
      <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="4.5" cy="9.5" r="2" />
      <path d="M1 18.5c0-2 1.5-3.5 3.5-3.5" />
      <circle cx="19.5" cy="9.5" r="2" />
      <path d="M23 18.5c0-2-1.5-3.5-3.5-3.5" />
    </svg>
  );
}

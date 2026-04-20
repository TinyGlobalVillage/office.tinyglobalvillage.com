import { SVGProps } from "react";

export default function DrawerSessionsIcon({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3z" />
    </svg>
  );
}

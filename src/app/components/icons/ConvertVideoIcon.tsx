import { SVGProps } from "react";

export default function ConvertVideoIcon({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <rect x="3" y="6" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M16 9l4-2v8l-4-2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M15 19h6M18 16l3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

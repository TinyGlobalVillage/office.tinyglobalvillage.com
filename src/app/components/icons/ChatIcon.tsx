import { SVGProps } from "react";

export default function ChatIcon({ size = 14, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path
        d="M1 1h12v9H8l-3 3V10H1V1z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="4.5" cy="5.5" r="0.8" fill="currentColor" />
      <circle cx="7" cy="5.5" r="0.8" fill="currentColor" />
      <circle cx="9.5" cy="5.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

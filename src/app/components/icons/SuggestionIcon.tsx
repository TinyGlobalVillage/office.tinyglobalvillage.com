import { SVGProps } from "react";

export default function SuggestionIcon({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path
        d="M12 2a7 7 0 0 0-4 12.5c.7.9 1 1.8 1 2.5v1h6v-1c0-.7.3-1.6 1-2.5A7 7 0 0 0 12 2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M9 19h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 22h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

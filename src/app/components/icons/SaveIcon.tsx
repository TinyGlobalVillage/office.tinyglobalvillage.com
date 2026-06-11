import { SVGProps } from "react";

export default function SaveIcon({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
      <path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 4v5h6V4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <rect x="8" y="13" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

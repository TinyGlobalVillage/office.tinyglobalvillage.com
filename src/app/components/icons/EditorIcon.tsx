import { SVGProps } from "react";

export default function EditorIcon({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path d="M4 4h12l4 4v12H4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 4v4h4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 13l-2 2 2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 13l2 2-2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 11l-2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

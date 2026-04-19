import { SVGProps } from "react";

export default function StorageIcon({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M3 7l9 4 9-4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 11v10" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

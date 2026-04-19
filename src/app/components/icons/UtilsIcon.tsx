import { SVGProps } from "react";

export default function UtilsIcon({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
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
        d="M14.7 6.3a4 4 0 0 0-5.4 5.1l-6 6 2.3 2.3 6-6a4 4 0 0 0 5.1-5.4L14 10l-2-2 2.7-1.7z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

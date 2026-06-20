import { SVGProps } from "react";

// Lotus / wellness mark for the Studio (appointments + classes) suite.
export default function LotusIcon({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
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
      <path d="M12 4c2 2.2 3 4.6 3 7 0 1.2-.4 2.3-1 3.2-1.2-.7-2-2.3-2-4.2 0-2 .8-4.2 0-6Z" />
      <path d="M12 14.2c-.6-.9-1-2-1-3.2 0-2.4 1-4.8 3-7-0.8 1.8 0 4 0 6 0 1.9-.8 3.5-2 4.2Z" />
      <path d="M4 11c2.4.2 4.3 1.4 5.5 3.4M20 11c-2.4.2-4.3 1.4-5.5 3.4" />
      <path d="M4 14.5c1.3 3 4.3 4.5 8 4.5s6.7-1.5 8-4.5" />
    </svg>
  );
}

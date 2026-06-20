import { SVGProps } from "react";

export default function ChartIcon({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
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
      <path d="M4 4v15a1 1 0 0 0 1 1h15" />
      <path d="M8 16v-3M12 16v-6M16 16v-4M20 16V8" />
    </svg>
  );
}

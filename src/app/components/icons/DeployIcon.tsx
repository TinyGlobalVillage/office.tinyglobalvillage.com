import { SVGProps } from "react";

export default function DeployIcon({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <g transform="rotate(45 12 12)">
        <path
          d="M12 2c2.5 2.5 4 5.5 4 9v6H8v-6c0-3.5 1.5-6.5 4-9z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="10" r="1.8" stroke="currentColor" strokeWidth="2" />
        <path
          d="M8 14l-3 4 3 1v-5zM16 14l3 4-3 1v-5z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M10 19l2 3 2-3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

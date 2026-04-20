import { SVGProps } from "react";

export default function CloudIcon({
  size = 32,
  ...rest
}: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...rest}
    >
      <path
        d="M8.2 20.5h16.2a5.8 5.8 0 0 0 1.3-11.45 7.6 7.6 0 0 0 -14.55-2.1 5.2 5.2 0 0 0 -2.95 9.8 5.2 5.2 0 0 0 0 3.75z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.2 20.5h16.2a5.8 5.8 0 0 0 1.3-11.45 7.6 7.6 0 0 0 -14.55-2.1 5.2 5.2 0 0 0 -2.95 9.8 5.2 5.2 0 0 0 0 3.75z"
        fill="currentColor"
        fillOpacity="0.08"
      />
    </svg>
  );
}
